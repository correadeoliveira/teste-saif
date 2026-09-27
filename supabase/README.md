# `supabase/` — Banco de dados PostgreSQL + PostGIS

> Schema e migrations do SAIFEN, aplicados via
> [Supabase CLI](https://supabase.com/docs/guides/local-development).
>
> **Status:** schema versionado (migrations 001–006). Sem projeto cloud
> obrigatório — web e mobile caem nos JSON de `shared/heatmaps/`. Pânico e
> zona crítica usam RPCs quando `EXPO_PUBLIC_SUPABASE_*` está definido.

## Estrutura

```
supabase/
├── config.toml
├── migrations/
│   ├── 20260621000001_enable_postgis.sql
│   ├── 20260621000002_create_crimes.sql
│   ├── 20260621000003_create_heatmap_grid.sql
│   ├── 20260621000004_create_views_and_rpcs.sql
│   ├── 20260621000005_create_behavior_profiles.sql
│   └── 20260621000006_report_crime_and_zone_risk.sql
├── tests/
│   ├── check_sql.py              # contrato estático (CI, sem Docker)
│   ├── roles.sql                 # opcional: roles anon no Postgres
│   └── rpcs.sql                  # opcional: RPCs se houver PostGIS
├── seed.sql
└── functions/
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
| `behavior_profiles` | cupom de enrollment IMU por device (sem JSONL bruto)    |

## RPCs (PostgreSQL functions chamadas via `client.rpc`)

| nome                       | quem usa  | propósito                                       |
|----------------------------|-----------|-------------------------------------------------|
| `get_heatmap_grid(type)`   | web/mobile| retorna o último heatmap_grid filtrado por tipo |
| `get_summary()`            | web/mobile| estatísticas (`shared/summary.json` no banco)   |
| `nearby_crimes(lat,lng,m)` | mobile    | crimes num raio de `m` metros (para alertas GPS)|
| `report_crime(lat,lng,type,device)` | mobile | botão de pânico — INSERT rate-limited (`POST /rest/v1/rpc/report_crime`) |
| `zone_risk(lat,lng,m)`     | mobile    | densidade KDE + contagem de BOs → low/medium/high/critical |

## Realtime

A tabela `crimes` tem `replica identity FULL` para que o app mobile
possa emitir BOs e o web reflita em tempo real.

## RLS

Migration `20260621000004_create_views_and_rpcs.sql` habilita
Row Level Security:

- `crimes`        — SELECT público; INSERT direto só com service_role.
  Relatos do app passam pela RPC `report_crime` (`SECURITY DEFINER`,
  device_id **obrigatório**, 1 BO / device / 2 min, `source_file = mobile-panic`).
  `GRANT anon` é MVP **sem login**: o UUID do aparelho não é identidade.
- `heatmap_grid`  — SELECT público; escrita só com service_role.
- `pipeline_runs` — apenas service_role.
- `behavior_profiles` — SELECT/INSERT/UPDATE anon (MVP, sem login). JSONL IMU **não** sobe.

`zone_risk` clampa o raio em `[50, 2000]` m. Limiares `low/medium/high/critical`
são os mesmos de `mobile/src/services/zone.ts`.

## Testes SQL

Sem Docker. Contrato estático (CI):

```bash
python3 supabase/tests/check_sql.py
```

`rpcs.sql` só faz sentido com Postgres+PostGIS; não entra no CI por enquanto.

## Re-deploy de migrations via CI

Veja `.github/workflows/supabase-migrate.yml` — disparo manual
(`workflow_dispatch`) para evitar destrutividade acidental.
