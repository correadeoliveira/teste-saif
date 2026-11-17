create or replace function public.report_crime(
    p_lat double precision,
    p_lng double precision,
    p_crime_type text default 'outros',
    p_device_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    v_type   text;
    v_hour   integer;
    v_period text;
    v_bo     text;
    v_id     bigint;
    v_wait   integer;
    v_now    timestamptz;
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

    -- Keep the rate-limit check and insert in the same per-device critical section.
    perform pg_advisory_xact_lock(hashtextextended(p_device_id::text, 20260621));
    v_now := clock_timestamp();

    select greatest(
        0,
        120 - floor(extract(epoch from (v_now - max(ingested_at))))::int
    )
    into v_wait
    from public.crimes
    where reported_by_device = p_device_id
      and source_file = 'mobile-panic'
      and ingested_at > v_now - interval '2 minutes';

    if coalesce(v_wait, 0) > 0 then
        return json_build_object(
            'ok', false,
            'error', 'rate_limited',
            'retry_after_sec', v_wait
        );
    end if;

    v_hour := extract(hour from timezone('America/Sao_Paulo', v_now))::int;
    v_period := case
        when v_hour between 6 and 11 then 'manha'
        when v_hour between 12 and 17 then 'tarde'
        when v_hour between 18 and 23 then 'noite'
        else 'madrugada'
    end;

    v_bo := 'PANIC-' || gen_random_uuid()::text;

    insert into public.crimes (
        bo_number, lat, lng, crime_type, period, occurred_at,
        city, source_file, reported_by_device, ingested_at
    ) values (
        v_bo, p_lat, p_lng, v_type, v_period, v_now,
        'S.PAULO', 'mobile-panic', p_device_id, v_now
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
