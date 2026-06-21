-- ═══════════════════════════════════════════════════
-- SAIFEN — Migration 003
-- Tabela `heatmap_grid` — células KDE com densidade normalizada
--
-- Reflete pipeline/saifen_pipeline/exporter.write_heatmap_grid
-- ═══════════════════════════════════════════════════

create table if not exists public.heatmap_grid (
    id           bigserial primary key,
    crime_type   text not null default 'all'
                 check (crime_type in ('all','furto','roubo','outros')),
    density      real not null check (density between 0 and 1),
    cell         geography(polygon, 4326) not null,
    generated_at timestamptz not null default now(),
    pipeline_run uuid                                          -- FK opcional para pipeline_runs
);

create index if not exists heatmap_grid_cell_gix
    on public.heatmap_grid using gist (cell);

create index if not exists heatmap_grid_type_idx
    on public.heatmap_grid (crime_type, generated_at desc);

comment on table public.heatmap_grid is
    'Grade KDE por tipo de crime. Substituída inteiramente a cada ' ||
    'execução do pipeline (truncate + insert).';

-- ═══════════════════════════════════════════════════
-- Tabela `pipeline_runs` — audit log das execuções
-- ═══════════════════════════════════════════════════

create table if not exists public.pipeline_runs (
    id            uuid primary key default uuid_generate_v4(),
    started_at    timestamptz not null default now(),
    finished_at   timestamptz,
    rows_in       integer,
    rows_out      integer,
    n_heatmap_cells integer,
    n_crimes      integer,
    source_files  text[],
    pipeline_version text,
    notes         text
);

comment on table public.pipeline_runs is
    'Audit log das execuções do pipeline Python. ' ||
    'Útil para rastrear quando o heatmap atual foi gerado.';
