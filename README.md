# ＳＡＩＦＥＮ

*System designation: Urban Risk Analysis Protocol.*

> **CLASSIFIED COMMUNICATION. AUTHORIZATION LEVEL 4 REQUIRED.**
>
> *Notice: This repository and all its contents are strictly a test environment. The data contained herein is an experimental simulation. Do not attempt to extrapolate real-world patterns from this localized trial. You are being monitored.*

---

# INITIATION SEQUENCE

From the repository root, a single command sets up Python, runs the data
pipeline when needed, starts the local server, and opens the web app:

```bash
./tools/start.sh
```

That script will:

1. Create `.venv` and install `pipeline/requirements.txt` (first run only)
2. Build heatmaps into `shared/` (skipped if cache is fresh; ~40s on first run)
3. Serve the monorepo at `http://localhost:8000`
4. Open `http://localhost:8000/web/` in your default browser

Press **Ctrl+C** to stop the server.

### Options

| flag | effect |
|------|--------|
| `./tools/start.sh --force` | Rebuild heatmaps before serving |
| `./tools/start.sh --port 3000` | Use a different port |
| `./tools/start.sh --no-open` | Start server without opening the browser |

### Requirements

- **Python 3.9+** (for the pipeline and HTTP server)
- **Raw data** in `data/raw/` (e.g. `CelularesSubtraidos_2026.xlsx`) — already included in this repo

### Manual steps (optional)

If you prefer to run each step yourself:

```bash
./tools/run-pipeline.sh --force   # generate shared/heatmaps/*
./tools/dev-web.sh                  # server only → http://localhost:8000/web/
```

Mobile and Supabase are optional — see [`mobile/README.md`](mobile/README.md) and [`supabase/README.md`](supabase/README.md).

---

# VISUAL OVERRIDE (Context 4)

Interface mimics legacy CRT monitoring systems. 

- **Primary Signature:** Phosphor Green (`#00FF9F` / `#39FF14`) against absolute black.
- **Typography:** Share Tech Mono + VT323.
- **Artifacts:** Scanlines, subtle grids, phosphor glow. No saturated neon.
- **Tone:** Analytical. Cold. Factual. No gamification protocols.

---

# CAPABILITIES

### RISK ANALYSIS
- **Dynamic Risk Levels** — Computed in real-time. We see where you look.
- **Demographic Vulnerability** — Identifies target profiles per sector and timestamp.
- **Automated Intelligence** — Auto-generated threat assessments based on variables.

### PARAMETER FILTERS
- **Incident Types:** Theft, Robbery, Assault, Aggression, Trafficking.
- **Temporal Slices:** Morning, Afternoon, Night, Late Night.
- **Sectors:** Sé, República, Luz, Paulista, Liberdade, Bela Vista, Consolação, Anhangabaú.

### TACTICAL LAYERS
- **Incident Heatmap** — Intensity dictates risk.
- **24/7 Safe Zones** — Monitored locations.
- **Entity Flow** — Pedestrian density overlays.
- **Illumination Grid** — Visibility mapping for night operations.
- **Transit Networks** — Active transport links and final departure times.
- **Verified Routes** — Secure paths confirmed by operatives.

---

## // VISÃO

Monorepo do MVP SAIFEN. Quatro camadas, uma interface (`shared/`):

```
                        ┌─────────────────────┐
                        │  data/raw/*.xlsx    │  (SSP-SP, drop manual)
                        └──────────┬──────────┘
                                   │
                                   ▼
   ┌───────────────────────────────────────────────────────────┐
   │                      pipeline/                            │   PYTHON
   │  saifen_pipeline = loader → cleaner → kde → exporter      │
   │  scripts/ + notebooks/ + tests/                           │
   └──────────────┬───────────────────────┬────────────────────┘
                  │                       │
                  │ (gera)                │ (opt-in: push)
                  ▼                       ▼
   ┌──────────────────────────┐   ┌──────────────────────────┐
   │  shared/                 │   │  supabase/               │   POSTGIS
   │   heatmaps/*.json|geojson│◄──┤  migrations + RPCs + RLS │
   │   summary.json           │   │  (config.toml, seed.sql) │
   └─────┬──────────────┬─────┘   └──────────┬───────────────┘
         │              │                    │
         ▼              ▼                    ▼
   ┌──────────┐   ┌──────────┐         ┌──────────────┐
   │  web/    │   │  mobile/ │ ◄─ GPS  │ Realtime RPC │
   │ Leaflet  │   │  Expo+RN │ ─ POST  │  (BO stream) │
   └──────────┘   └──────────┘         └──────────────┘
   JS ES6 mod      TypeScript
```

Cada componente é **autônomo** (poderia virar repo independente), tem
seu próprio `README.md` e se conecta aos outros via:

- **dados estáticos**: pasta `shared/` (versionada, regenerada pelo pipeline)
- **dados dinâmicos**: Supabase (futuro)

---

## // ESTRUTURA

```
saifen/
├── README.md                                 # ← você está aqui
├── .gitignore  .env.example
│
├── pipeline/         PYTHON  ── workflow de dados (SSP → heatmaps)
│   ├── pyproject.toml  requirements.txt
│   ├── saifen_pipeline/  config loader cleaner kde exporter integrations/
│   ├── scripts/  process_xlsx generate_heatmap run_pipeline push_to_supabase
│   ├── notebooks/  01_exploracao  02_limpeza  03_kde_heatmap
│   └── tests/    pytest
│
├── data/             DADOS BRUTOS  ── inputs originais
│   ├── raw/        CelularesSubtraidos_*.xlsx     (versionado)
│   └── processed/  *.parquet                      (cache, .gitignored)
│
├── shared/           ARTEFATOS  ── interface pipeline ↔ apps
│   ├── summary.json
│   └── heatmaps/  heatmap_points*.json  heatmap_grid.geojson  crimes.geojson
│
├── web/              FRONTEND WEB  ── Leaflet hoje, Mapbox amanhã
│   ├── index.html  style.css  assets/
│   └── src/  main.js  core/  data/  map/  ui/  config/
│
├── mobile/           APP MOBILE  ── Expo + React Native (stub)
│   ├── package.json  app.json  tsconfig.json  App.tsx
│   └── src/  services/{supabase,heatmap,location}  screens/  theme/
│
├── supabase/         BANCO  ── PostgreSQL + PostGIS (stub)
│   ├── config.toml  seed.sql
│   ├── migrations/  20260621_*_*.sql
│   └── functions/   (edge functions)
│
├── tools/            DEV TOOLING
│   ├── start.sh          one command: setup + pipeline + server + browser
│   ├── dev-web.sh        HTTP server only
│   └── run-pipeline.sh   Python pipeline only
│
└── .github/workflows/
    ├── pipeline.yml          rebuild heatmaps em push de data/raw ou pipeline/
    ├── web-ci.yml            lint do web/
    ├── mobile-ci.yml         typecheck do mobile/
    └── supabase-migrate.yml  workflow_dispatch manual
```

---

## // QUICKSTART

> Prefer English? See **[How to run](#how-to-run)** above.

```bash
git clone <repo> saifen && cd saifen
./tools/start.sh
```

### Passos manuais (opcional)

```bash
cd mobile
npm install
npm start                              # abre Expo Dev Tools
```

### 4. (Opcional) Provisionar Supabase

Veja [`supabase/README.md`](supabase/README.md).

---

## // FLUXOS DE DADOS

### Inputs → Heatmaps

```
data/raw/CelularesSubtraidos_2026.xlsx          (32 MB, SSP-SP)
   │
   │  pipeline/saifen_pipeline.loader
   ▼
df_raw (115.818 linhas × 55 colunas)
   │
   │  pipeline/saifen_pipeline.cleaner
   │    filtra bbox SP capital + dedup NUM_BO
   ▼
df_clean (57.497 linhas × 12 colunas canônicas)
   │
   ├─→ data/processed/celulares_clean.parquet     (cache .gitignored)
   ├─→ shared/summary.json                        (stats: 29k furto, 19k roubo)
   │
   │  pipeline/saifen_pipeline.kde + exporter
   ▼
shared/heatmaps/
   ├─ heatmap_points.json           (10k pontos, Leaflet.heat)
   ├─ heatmap_points__furto.json    (5k pontos, fatiado)
   ├─ heatmap_points__roubo.json    (5k pontos, fatiado)
   ├─ heatmap_grid.geojson          (40k células 200×200, Mapbox/PostGIS)
   └─ crimes.geojson                (5k pontos individuais)
```

### Heatmaps → Apps

```
shared/heatmaps/*.json
       │
       │  HTTP (servido por tools/dev-web.sh / Vercel / Netlify)
       │
       ├─→  web/src/data/HeatmapLoader.js     →  CrimeMap.js
       │
       └─→  mobile/src/services/heatmap.ts    →  MapScreen.tsx (Heatmap layer)
```

### Cadeia de fallback (web e mobile)

```
1. Supabase RPC          ← se SUPABASE_URL configurado
2. fetch /shared/...     ← gerado pelo pipeline (default)
3. MockData              ← hardcoded, garante o app rodar offline
```

---

## // CI/CD

| workflow                | dispara em                    | o que faz                              |
|-------------------------|-------------------------------|----------------------------------------|
| `pipeline.yml`          | push em `data/raw/` ou `pipeline/`, ou semanal | roda pipeline + tests, commita `shared/` |
| `web-ci.yml`            | push em `web/`                | valida HTML + sanidade de imports      |
| `mobile-ci.yml`         | push em `mobile/`             | `tsc --noEmit`                         |
| `supabase-migrate.yml`  | `workflow_dispatch` (manual)  | aplica migrations no ambiente alvo     |

---

## // ROADMAP



## // VISUAL OVERRIDE

Interface mimics legacy CRT monitoring systems. Phosphor green
(`#00FF9F` / `#39FF14`) sobre preto absoluto, fontes Share Tech Mono +
VT323. A paleta vive em `web/style.css` e `mobile/src/theme/colors.ts`.

*End of transmission. Disconnect immediately after reading.*
