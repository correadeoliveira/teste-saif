-- ═══════════════════════════════════════════════════
-- SAIFEN — Migration 002
-- Tabela `crimes` — uma linha por boletim de ocorrência
--
-- Schema espelha pipeline/saifen_pipeline/cleaner.CLEAN_COLUMNS.
-- ═══════════════════════════════════════════════════

create table if not exists public.crimes (
    id            bigserial primary key,
    bo_number     text,                    -- NUM_BO da SSP-SP (chave natural)
    lat           double precision not null,
    lng           double precision not null,
    crime_type    text not null check (crime_type in ('furto','roubo','outros')),
    period        text check (period in ('manha','tarde','noite','madrugada')),
    occurred_at   timestamptz,
    neighborhood  text,
    city          text,
    street        text,
    police_unit   text,
    phone_brand   text,
    source_file   text,
    ingested_at   timestamptz not null default now(),

    -- Coluna gerada: usa GEOGRAPHY (sphere) p/ queries de raio em metros
    geom geography(point, 4326) generated always as (
        st_setsrid(st_makepoint(lng, lat), 4326)::geography
    ) stored
);

-- Índices ──────────────────────────────────────────────────────────
create unique index if not exists crimes_bo_number_unique
    on public.crimes (bo_number)
    where bo_number is not null;

create index if not exists crimes_geom_gix
    on public.crimes using gist (geom);

create index if not exists crimes_type_period_idx
    on public.crimes (crime_type, period);

create index if not exists crimes_occurred_at_idx
    on public.crimes (occurred_at desc);

-- Realtime ─────────────────────────────────────────────────────────
-- App mobile pode emitir BOs em tempo real; web reflete na hora.
alter table public.crimes replica identity full;

comment on table public.crimes is
    'Boletins de ocorrência (SSP-SP + reports do app mobile). ' ||
    'Ingerido por pipeline/scripts/push_to_supabase.py.';
