-- ═══════════════════════════════════════════════════
-- SAIFEN — Migration 004
-- Views, RPCs e RLS
-- ═══════════════════════════════════════════════════

-- ─── RPCs consumidas pelo web/mobile ───────────────────────────────

-- get_heatmap_grid: retorna GeoJSON-like da grade atual filtrada por tipo
create or replace function public.get_heatmap_grid(p_crime_type text default 'all')
returns json
language sql stable
as $$
    select json_build_object(
        'type', 'FeatureCollection',
        'metadata', json_build_object(
            'crime_type', p_crime_type,
            'count', count(*),
            'generated_at', max(generated_at)
        ),
        'features', coalesce(json_agg(
            json_build_object(
                'type', 'Feature',
                'properties', json_build_object('density', density),
                'geometry', st_asgeojson(cell)::json
            )
        ), '[]'::json)
    )
    from public.heatmap_grid
    where crime_type = p_crime_type;
$$;

-- get_summary: snapshot do summary.json
create or replace function public.get_summary()
returns json
language sql stable
as $$
    select json_build_object(
        'total_incidents', count(*),
        'by_crime_type', (
            select json_object_agg(crime_type, c)
            from (select crime_type, count(*) c from public.crimes group by 1) x
        ),
        'by_period', (
            select json_object_agg(coalesce(period, 'null'), c)
            from (select period, count(*) c from public.crimes group by 1) x
        ),
        'date_range', json_build_object(
            'min', min(occurred_at),
            'max', max(occurred_at)
        )
    )
    from public.crimes;
$$;

-- nearby_crimes: crimes num raio de N metros (alertas GPS do mobile)
create or replace function public.nearby_crimes(
    p_lat double precision,
    p_lng double precision,
    p_radius_meters integer default 500
)
returns table (
    id bigint,
    lat double precision,
    lng double precision,
    crime_type text,
    period text,
    occurred_at timestamptz,
    distance_meters double precision
)
language sql stable
as $$
    select
        c.id, c.lat, c.lng, c.crime_type, c.period, c.occurred_at,
        st_distance(c.geom, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) as distance_meters
    from public.crimes c
    where st_dwithin(c.geom, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_meters)
    order by distance_meters
    limit 200;
$$;

-- ─── Row Level Security ────────────────────────────────────────────

alter table public.crimes        enable row level security;
alter table public.heatmap_grid  enable row level security;
alter table public.pipeline_runs enable row level security;

-- crimes: leitura pública, escrita só com service_role
drop policy if exists "crimes_read_public" on public.crimes;
create policy "crimes_read_public" on public.crimes
    for select using (true);

-- heatmap_grid: leitura pública
drop policy if exists "heatmap_grid_read_public" on public.heatmap_grid;
create policy "heatmap_grid_read_public" on public.heatmap_grid
    for select using (true);

-- pipeline_runs: apenas service_role (sem policies = só superuser)

-- Grants para RPCs
grant execute on function public.get_heatmap_grid(text) to anon, authenticated;
grant execute on function public.get_summary()         to anon, authenticated;
grant execute on function public.nearby_crimes(double precision, double precision, integer)
    to anon, authenticated;
