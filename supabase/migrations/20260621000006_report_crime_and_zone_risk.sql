-- ═══════════════════════════════════════════════════
-- SAIFEN — Migration 006
-- Relato de BO pelo app (botão de pânico) + risco de zona
--
-- MVP sem login: RPCs com SECURITY DEFINER + GRANT anon.
-- p_device_id NÃO é identidade (o cliente escolhe o UUID);
-- serve só para rate limit. Trocar quando houver auth.
-- ═══════════════════════════════════════════════════

alter table public.crimes
    add column if not exists reported_by_device uuid;

create index if not exists crimes_reported_by_device_idx
    on public.crimes (reported_by_device, ingested_at desc)
    where reported_by_device is not null;

comment on column public.crimes.reported_by_device is
    'Device que emitiu o BO pelo app (botão de pânico). Null nos registros da SSP.';

-- ─── report_crime: INSERT via RPC (anon) ───────────────────────────
-- Chamada: POST /rest/v1/rpc/report_crime
-- Rate limit: 1 relato / device / 2 minutos. device_id obrigatório.

create or replace function public.report_crime(
    p_lat double precision,
    p_lng double precision,
    p_crime_type text default 'outros',
    p_device_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
    v_type   text;
    v_hour   integer;
    v_period text;
    v_bo     text;
    v_id     bigint;
    v_wait   integer;
begin
    -- SECURITY DEFINER ignora RLS. GRANT anon é MVP sem login.
    if p_device_id is null then
        return json_build_object('ok', false, 'error', 'device_required');
    end if;

    if p_lat is null or p_lng is null
       or p_lat < -90 or p_lat > 90
       or p_lng < -180 or p_lng > 180 then
        return json_build_object('ok', false, 'error', 'invalid_coords');
    end if;

    v_type := lower(coalesce(p_crime_type, 'outros'));
    if v_type not in ('furto', 'roubo', 'outros') then
        v_type := 'outros';
    end if;

    select greatest(
        0,
        120 - floor(extract(epoch from (now() - max(ingested_at))))::int
    )
    into v_wait
    from public.crimes
    where reported_by_device = p_device_id
      and source_file = 'mobile-panic'
      and ingested_at > now() - interval '2 minutes';

    if coalesce(v_wait, 0) > 0 then
        return json_build_object(
            'ok', false,
            'error', 'rate_limited',
            'retry_after_sec', v_wait
        );
    end if;

    v_hour := extract(hour from timezone('America/Sao_Paulo', now()))::int;
    v_period := case
        when v_hour between 6 and 11 then 'manha'
        when v_hour between 12 and 17 then 'tarde'
        when v_hour between 18 and 23 then 'noite'
        else 'madrugada'
    end;

    v_bo := 'PANIC-' || uuid_generate_v4()::text;

    insert into public.crimes (
        bo_number, lat, lng, crime_type, period, occurred_at,
        city, source_file, reported_by_device
    ) values (
        v_bo, p_lat, p_lng, v_type, v_period, now(),
        'S.PAULO', 'mobile-panic', p_device_id
    )
    returning id into v_id;

    return json_build_object(
        'ok', true,
        'id', v_id,
        'bo_number', v_bo,
        'crime_type', v_type,
        'period', v_period
    );
end;
$$;

comment on function public.report_crime(double precision, double precision, text, uuid) is
    'MVP: SECURITY DEFINER + GRANT anon. p_device_id é obrigatório para rate limit, '
    'não é prova de identidade.';

-- ─── zone_risk: densidade KDE + crimes próximos (alertas GPS) ──────

create or replace function public.zone_risk(
    p_lat double precision,
    p_lng double precision,
    p_radius_meters integer default 250
)
returns json
language sql
stable
as $$
    with params as (
        select least(greatest(coalesce(p_radius_meters, 250), 50), 2000) as radius
    ),
    pt as (
        select st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography as g
    ),
    nearby as (
        select count(*)::int as n
        from public.crimes c, pt, params
        where st_dwithin(c.geom, pt.g, params.radius)
    ),
    dens as (
        select coalesce(max(h.density), 0)::real as d
        from public.heatmap_grid h, pt
        where h.crime_type = 'all'
          and st_dwithin(h.cell, pt.g, 80)
    )
    select json_build_object(
        'nearby_count', nearby.n,
        'max_density', dens.d,
        'radius_meters', params.radius,
        'level', case
            when dens.d >= 0.75 or nearby.n >= 20 then 'critical'
            when dens.d >= 0.40 or nearby.n >= 8 then 'high'
            when dens.d >= 0.20 or nearby.n >= 3 then 'medium'
            else 'low'
        end
    )
    from nearby, dens, params;
$$;

comment on function public.zone_risk(double precision, double precision, integer) is
    'Classificação low/medium/high/critical. Raio clampado em [50, 2000] m. '
    'Limiares iguais a mobile/src/services/zone.ts.';

grant execute on function public.report_crime(double precision, double precision, text, uuid)
    to anon, authenticated;
grant execute on function public.zone_risk(double precision, double precision, integer)
    to anon, authenticated;
