# `supabase/` — Banco de dados PostgreSQL + PostGIS

> Schema, migrations e edge functions do SAIFEN, prontos para aplicar
> via [Supabase CLI](https://supabase.com/docs/guides/local-development).
>
> **Status:** stub. Nada está provisionado ainda — todo o sistema
> funciona em fallback nos JSONs estáticos de `shared/heatmaps/`.

## Estrutura

```
supabase/
├── config.toml                       # config do Supabase CLI
├── migrations/                       # SQL versionado, aplicado em ordem
│   ├── 20260621000001_enable_postgis.sql
│   ├── 20260621000002_create_crimes.sql
│   ├── 20260621000003_create_heatmap_grid.sql
│   └── 20260621000004_create_views_and_rpcs.sql
├── seed.sql                          # dados mock para dev local
└── functions/                        # edge functions (Deno)
    └── .gitkeep
```

## Provisionamento

### Opção A — Cloud Supabase (recomendado para MVP)

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Habilite extensão PostGIS no painel SQL.
3. Aplique as migrations manualmente no SQL Editor (cole conteúdo de
   cada arquivo em `migrations/` em ordem) **ou** instale o CLI e rode:

```bash
brew install supabase/tap/supabase
supabase link --project-ref <ref>
supabase db push
```

4. Crie um `.env` na raiz do monorepo:

```bash
# .env (NÃO commitar)
SUPABASE_URL=https://xxxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1...   # service_role (apenas pipeline)
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1...      # anon (web/mobile)
```

5. Popule o banco:

```bash
python pipeline/scripts/push_to_supabase.py --truncate
```

### Opção B — Supabase local (Docker)

```bash
supabase start             # sobe Postgres + Studio em localhost
supabase db reset          # aplica migrations + seed.sql
```

## Schema

| tabela            | propósito                                                 |
|-------------------|-----------------------------------------------------------|
| `crimes`          | uma linha por boletim de ocorrência (POINT + metadata)    |
| `heatmap_grid`    | células da grade KDE (POLYGON + density ∈ [0,1])          |
| `pipeline_runs`   | histórico de execuções do pipeline (audit log)            |

## RPCs (PostgreSQL functions chamadas via `client.rpc`)

| nome                       | quem usa  | propósito                                       |
|----------------------------|-----------|-------------------------------------------------|
| `get_heatmap_grid(type)`   | web/mobile| retorna o último heatmap_grid filtrado por tipo |
| `get_summary()`            | web/mobile| estatísticas (`shared/summary.json` no banco)   |
| `nearby_crimes(lat,lng,m)` | mobile    | crimes num raio de `m` metros (para alertas GPS)|

## Realtime

A tabela `crimes` tem `replica identity FULL` para que o app mobile
possa emitir BOs e o web reflita em tempo real (futuro).

## RLS

Migration `20260621000004_create_views_and_rpcs.sql` habilita
Row Level Security:

- `crimes`        — SELECT público; INSERT/UPDATE/DELETE só com service_role.
- `heatmap_grid`  — SELECT público; escrita só com service_role.
- `pipeline_runs` — apenas service_role.

## Re-deploy de migrations via CI

Veja `.github/workflows/supabase-migrate.yml` — disparo manual
(`workflow_dispatch`) para evitar destrutividade acidental.
