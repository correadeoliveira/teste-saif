# CLAUDE.md — SAIFEN

> Mapa completo do monorepo SAIFEN para coding agents.
> Índice operacional rápido: [`AGENTS.md`](AGENTS.md) · Playbook do pipeline: [`docs/agents/heatmap-pipeline.md`](docs/agents/heatmap-pipeline.md)
> Este arquivo **descreve**; o `AGENTS.md` **instrui**. Não duplique procedures aqui — se um contradiz o outro, o `AGENTS.md` + `docs/agents/` vencem.

---

## 1. O que é

**SAIFEN** é um sistema de análise de risco urbano para São Paulo. Monorepo com
duas metades deliberadamente desacopladas:

```
data/raw/*.xlsx                    fonte humana (SSP-SP, versionada)
        │
        ▼
pipeline/saifen_pipeline           Python CLI: ingest → preprocess → evaluate
        │                          → fit (KDE) → fatias tipo×período → publish
        ▼
shared/heatmaps/*.json             artefato ESTÁTICO, versionado  ◄── a "interface"
shared/summary.json                  │
shared/current_run.json             │
shared/behavior/model.json          │
        │                           │
        ├──► src/          (web React/Vite — app OFICIAL)
        ├──► web/          (web vanilla ES6 — LEGADO, descontinuado)
        ├──► mobile/       (Expo / React Native)
        └──► Supabase      (PostGIS — opcional, fora do fluxo default)
```

### A regra de ouro

> **"O app não treina."** Todo treino/modelo é **CLI Python local**.
> O app web e o mobile apenas leem JSON estático de `shared/`.

Essa regra aparece em 4 lugares (`AGENTS.md`, `docs/agents/heatmap-pipeline.md`,
`pipeline/README.md`, `shared/README.md`). Não a quebre: nunca chame `fit()`,
`gaussian_kde` ou scikit-learn de dentro de um componente React ou de um
serviço mobile.

---

## 2. Mapa do repo

```
teste-saif/
├── src/                    ★ app web OFICIAL (React 18 + Vite 6 + Tailwind v4)
│   ├── app/App.tsx         componente único de 1034 linhas, abas mapa|pontos|stats
│   ├── app/components/     Questionnaire.tsx, RealMap.tsx
│   ├── map/                10 módulos Leaflet imperativos (CrimeMap é o orquestrador)
│   ├── data/               HeatmapLoader.js (consome /shared), MockData.js, SupabaseClient.js
│   ├── config/env.js       feature flags + paths dos artefatos
│   ├── styles/             index.css, theme.css, tailwind.css, fonts.css
│   ├── vendor/             leaflet-heat.umd.js
│   └── imports/            assets soltos do import do Figma + contexto4.md
│
├── web/                    ⚠ app web LEGADO (vanilla ES6, sem build) — 21 arquivos
│   ├── index.html, style.css (35 KB, tema CRT)
│   └── src/{core,map,data,ui,config}/
│
├── mobile/                 app Expo 52 / RN 0.76
│   ├── src/screens/        9 telas (Enrollment → Result, + Debug/SensorTest)
│   ├── src/services/       10 serviços (sensors, inference, imuMerge, …)
│   ├── assets/behavior/    bundle do modelo de comportamento
│   └── scripts/parity-check.cjs
│
├── pipeline/
│   ├── saifen_pipeline/    ★ crimes → KDE (pandas/numpy/scipy)
│   │   ├── cli.py          subcommands: ingest preprocess evaluate train heatmap publish update
│   │   ├── config.py       paths, bbox de SP, constantes, schema SSP
│   │   ├── adapters/       celulares.py, spdados.py
│   │   ├── models/         kde.py (default), baseline.py, kriging.py (STUB)
│   │   ├── kde.py, heatmap.py, cleaner.py, exporter.py, evaluate.py
│   │   └── integrations/supabase.py
│   ├── behavior/           ★ IMU → features → Logistic Regression (irmão, sklearn)
│   ├── scripts/            wrappers legados sem `-m`
│   ├── notebooks/          01_exploracao, 02_limpeza, 03_kde_heatmap
│   └── tests/              pytest com fixture XLSX mínima
│
├── data/
│   ├── raw/                .xlsx VERSIONADO + manifest.json (gitignored)
│   ├── processed/          parquet cache (gitignored)
│   ├── features/           agregados de grade (gitignored)
│   └── behavior/{raw,incoming,processed}/ pipeline de comportamento (dados)
│
├── shared/                 ★ INTERFACE pipeline → apps (gerado, mas versionado)
│   ├── current_run.json    run publicado + fingerprint
│   ├── summary.json        estatísticas agregadas
│   ├── heatmaps/           18 arquivos (Leaflet.heat + GeoJSON)
│   ├── behavior/           model.json, metrics.json, parity_fixture.json
│   └── runs/<run_id>/      histórico local (GITIGNORED)
│
├── supabase/               config.toml, seed.sql, 4 migrations (PostGIS)
├── tools/                  start.sh, dev-web.sh, run-pipeline.sh
├── docs/agents/            playbook do heatmap
├── dist/                   build do Vite (inclui dist/shared/ via closeBundle)
│
├── vite.config.ts          ★ serveShared() + figmaAssetResolver()
├── index.html              entrypoint do app React
├── AGENTS.md               índice operacional (canônico)
├── ATTRIBUTIONS.md         shadcn/ui (MIT) + fotos Unsplash
└── pnpm-workspace.yaml     workspace de 1 pacote; .nvmrc = 20
```

Rodrigues: `Riffles/`, `ruffles/`, `js/`, `prompt1/`, `guidelines/`, `docs soltos`
— ver [§10 Higiene do repo](#10-higiene-do-repo).

---

## 3. Comandos

```bash
# ── Web (app oficial) ────────────────────────────────────────────
npm install
npm run dev            # Vite em http://localhost:5173
npm run preview        # build de produção em http://localhost:4174

# ── Pipeline (o "treino" é sempre aqui) ─────────────────────────
npm run train          # = tools/run-pipeline.sh → `saifen_pipeline update`
npm run train:force    # regenera ignorando o fingerprint (--force)

# ── Servidor estático da raiz (necessário p/ mobile em dev) ────
./tools/dev-web.sh     # python3 -m http.server na RAIZ, porta 8000
./tools/start.sh       # venv → pipeline → :8000 → abre o browser

# ── Python direto ───────────────────────────────────────────────
test -d .venv || python3 -m venv .venv
source .venv/bin/activate
export PYTHONPATH="$PWD/pipeline${PYTHONPATH:+:$PYTHONPATH}"
python -m saifen_pipeline update --year 2026 --model kde
cd pipeline && pytest

# ── Pipeline de comportamento (pacote IRMÃO, não misture) ──────
cd pipeline/behavior
make setup && make generate-demo && make preprocess
make train && make evaluate && make export-model
```

### Portas

| Porta | Quem | Nota |
|------|------|------|
| 5173 | `npm run dev` (Vite) | `strictPort: true` |
| 4174 | `npm run preview` (Vite) | tem que estar **fora** do bloco `server` no `vite.config.ts`, senão o Vite ignora e cai no 4173 |
| 4173 | **reservado** | landing page SAIFEN SECURITY em `~/Documentos/Projeto Padrão` |
| 8000 | `tools/start.sh` / `dev-web.sh` | serve a **raiz** do monorepo (essencial p/ `/shared/...` resolver) |

### Versões

Node **20** (`.nvmrc`); mobile exige `>=18 <23`. CI usa Python **3.11**.

---

## 4. Pipeline de heatmap (resumo)

Playbook operacional passo-a-passo, com troubleshooting e verificação:
**[`docs/agents/heatmap-pipeline.md`](docs/agents/heatmap-pipeline.md)**.
Aqui só o essential.

### Fonte

Prioridade: `data/raw/SPDadosCriminais_2026.xlsx` (BOs georreferenciados) >
`data/raw/CelularesSubtraidos_2026.xlsx`. `ingest.resolve_source` escolhe
automaticamente. **Hoje o repo usa o segundo.**

> Não há download automático: o portal de consultas da SSP-SP é uma SPA sem
> URL GET documentada. Se faltar o XLSX, **peça o arquivo ao usuário — nunca
> invente dados de teste** quando ele pediu update de produção.

### Modelo

| `--model` | Status | Nota |
|-----------|--------|------|
| `kde` | **default / MVP** | `scipy.stats.gaussian_kde`, bandwidth `scott` |
| `baseline` | implementado | contagem em grade (`GRID_CELL_DEG = 0.0065` ≈ 720 m) |
| `kriging` | **STUB** | `fit()` levanta `NotImplementedError`. **Proibido no update** |

Constantes em `pipeline/saifen_pipeline/config.py`:

```
SOURCE_YEAR         = 2026          PIPELINE_VERSION = "0.2.0"
KDE_GRID_SIZE       = 200           KDE_BANDWIDTH   = "scott"
KDE_MIN_DENSITY     = 0.05          GRID_CELL_DEG   = 0.0065
SP_BBOX             = (-46.83, -23.78, -46.36, -23.39)   # SP capital
SP_CENTER           = (-23.5505, -46.6333)                # (lat, lng)
HEATMAP_CRIME_TYPES = ("furto", "roubo", "outros")
PERIODS             = ("manha", "tarde", "noite", "madrugada")
```

### Idempotência

`fingerprint = SHA-256(fonte) + nome do modelo + params`. Se bater com
`shared/current_run.json` e não houver `--force`, o CLI loga `update.skip` e
**não** reescreve nada. Use `--force` quando o XLSX mudou sem o hash mudar, os
JSON de `shared/heatmaps/` estão stale, ou o usuário pediu.

### Estágios de `update`

`ingest` → checagem de fingerprint → `preprocess` (xlsx→parquet+summary+features)
→ `evaluate` (split temporal intra-2026; pode dar `evaluate.skip`) →
`fit` + `generate_artifacts` (KDE + 12 fatias) → `shared/runs/<run_id>/` +
`shared/current_run.json`.

Logs são **uma linha JSON por evento**: `ingest.ok`, `preprocess.ok`,
`evaluate.ok`, `heatmap.points`, `publish.ok`, `update.ok` / `update.skip`.

### Estado publicado hoje

`shared/current_run.json` → run `20260927T122558Z_d857153eff88ab5e`, model `kde`,
fonte `CelularesSubtraidos_2026.xlsx` (sha `982405a2…`), 27/09/2026.
`shared/summary.json` → **55.611 incidentes** (furto 28.476 / roubo 18.863 /
outros 8.272); bairros no topo: Pinheiros 2167, Centro 1310, Bela Vista 1255,
Vila Mariana 1200.

---

## 5. Contrato dos artefatos

**Não quebrar sem bump de versão.** Especificação completa em
[`shared/README.md`](shared/README.md).

`shared/heatmaps/heatmap_points*.json` (18 arquivos: 1 agregado + 3 por tipo +
12 por tipo×período):

```json
{
  "meta":  { "generator": "saifen_pipeline", "crime_type": "all|furto|roubo|outros",
             "period": "all|manha|tarde|noite|madrugada" },
  "count": 10000,
  "points": [[lat, lng, weight]]        // weight ∈ [0, 1]
}
```

Consumidores: `src/data/HeatmapLoader.js`, `web/src/data/HeatmapLoader.js`,
`mobile/src/services/*` (fallback). Fatia tipo×período pode faltar se `n < 3`
(KDE colinear → `heatmap.slice_skip`) — **não** trate como falha total.

`shared/behavior/model.json` — LogReg sobre features de IMU:

```json
{ "version": "1.0.0", "type": "logistic_regression",
  "feature_names": ["ax_mean", "…", "sma_accel"],
  "scaler": { "mean": [], "scale": [] },
  "coef": [], "intercept": 0, "threshold": 0.5,
  "window_ms": 2000, "overlap": 0.5, "sample_rate_hz": 50,
  "label_positive": "genuine" }
```

> **Disclaimer obrigatório** (já gravado em `meta` de todos os artefatos):
> *"Incidência observada de boletins de ocorrência georreferenciados. Não é
> probabilidade individual nem a estatística oficial RES 160/516."*

Não misturar **RES 160/516** (agregado, sem lat/lng — não alimenta heatmap de
pontos) com microdados. Detalhes: [`data/README.md`](data/README.md).

---

## 6. Web — o que você precisa saber

### `vite.config.ts` faz duas coisas que não pode perder

1. **`serveShared()`** — plugin próprio. No dev, expõe `shared/` como
   `/shared/` via middleware. No `closeBundle`, copia `shared/` inteiro para
   `dist/shared/`. Sem isso o heatmap não carrega e o build de produção não tem
   artefato. *(O symlink `public/shared` foi removido no commit `7555c3e` —
   era quebrado.)*
2. **`figmaAssetResolver()`** — resolve imports `figma:asset/*` para
   `src/assets/`. Resíduo do Figma Make; não remova sem passar por tudo que
   importa.

### `src/app/App.tsx`

1034 linhas, **um componente só**, com abas `"mapa" | "pontos" | "stats"`.
Filtros são `Set<string>` para tipo / camada / horário / grupo.
`Questionnaire.tsx` aparece na primeira visita (`useState(true)`) e some para
sempre depois de `onComplete`. Mapas são Leaflet imperativos, com `RealMap.tsx`
como ponte React↔imperativo.

Camadas de mapa: `heat`, `safe`, `luz`, `bus` (mais `ContactsLayer` para contatos
de segurança em tempo real, via Supabase). O mapa-base é **OSM local**
(`LocalBasemap.js`) — sem Carto/Mapbox/Google, sem API key.

### Dois frontends web (⚠ a maior armadilha do repo)

| | `src/` (raiz) | `web/` |
|---|---|---|
| Stack | React 18 + Vite 6 + TS/JSX | HTML + ES6 modules, **sem build** |
| Status | **oficial** (commit `387794c`) | **legado, descontinuado** |
| Como rodar | `npm run dev` (5173) | `./tools/dev-web.sh` → `/web/` (8000) |
| Arquivos | — | 21 arquivos versionados |

Eles **compartilham código duplicado**:

```
data/HeatmapLoader.js   IDÊNTICO
data/SupabaseClient.js  IDÊNTICO
map/FlowLayer.js        IDÊNTICO
data/MockData.js        divergiu (~51 linhas)
map/CrimeMap.js         divergiu (~58 linhas)
```

> ⚠️ **Consequência:** todo bug fix no `src/` precisa ser aplicado **também** em
> `web/src/`, ou o legado fica quebrado. Antes de editar um arquivo
> compartilhado, confira os dois caminhos.

Pior: `tools/start.sh`, `tools/dev-web.sh` e `.github/workflows/web-ci.yml`
apontam **todos** para o `web/` legado, não para o app oficial. Ou seja, o
"one command to run" do repo abre a versão descontinuada.

---

## 7. Mobile

Expo 52 / RN 0.76 / react-native-maps 1.18. Fluxo de telas:
`Enrollment → Verification → ProfileReady → Collecting → Home → Map → Result`
(+ `DebugScreen`, `SensorTestScreen`).

- Sensores: `expo-sensors` (acelerômetro + giroscópio) em `services/sensors.ts`,
  agregação/merge em `imuMerge.ts`, extração de features em `features.ts`.
- Inferência **local e on-device** em `inference.ts`, lendo o
  `shared/behavior/model.json` empacotado em `mobile/assets/behavior/`.
- Split do treino é **por `session_id`**: janelas da mesma sessão nunca
  aparecem em train e test.
- `npm run test:parity` compila a TS com `tsconfig.parity.json` e roda
  `scripts/parity-check.cjs` comparando a inferência **TypeScript vs Python**.
  Se mexer em `inference.ts` ou no modelo, rode isso.

Sensores mocks: `services/syntheticImu.ts` + `make generate-demo` no Python
(para desenvolvimento sem dispositivo).

---

## 8. Supabase (opcional)

4 migrations em ordem: `enable_postgis` → `create_crimes` →
`create_heatmap_grid` → `create_views_and_rpcs`. Workflow
`supabase-migrate.yml` é **`workflow_dispatch` apenas** (migrations destrutivas
nunca automáticas em push), com gate de aprovação por `environment`.

`src/config/env.js` tem `USE_SUPABASE: false` — o app cai no fallback
`/shared/heatmaps/*.json`. **Não chame Supabase no fluxo default.**

Segredos: `.env.example` é o template. **NUNCA** commite `.env` nem
`SUPABASE_SERVICE_KEY`; `SUPABASE_ANON_KEY` é pública por design e vai em
`window.__SAIFEN_SUPABASE_ANON_KEY__`.

---

## 9. Identidade visual

Tema atual: **preto + amarelo**.

```
--background #05070b   --accent/--signal #ffcb00   --foreground #ece9e3
--secondary  #0b0e14   --border #1b2028            --danger #ff2200
```

Fontes: `Bebas Neue` (display), `Space Mono` (mono), `Barlow` (texto),
`Noto Sans JP` (japonês).

A paleta é a mesma da landing page SAIFEN SECURITY
(`~/Documentos/Projeto Padrão`) — commit `2a5ce00` "retema para preto e amarelo".

> ⚠️ **Os documentos de design em `prompt1/`, `guidelines/` e
> `src/imports/contexto4.md` ainda exigem VERDE FOSFOROSO (`#00FF9F`, `#39FF14`,
> `#00FF41`) e o tom "terminal CRT". Isso foi superado pelo retema amarelo.**
> Não reverta para verde com base nesses arquivos — eles estão desatualizados.
> Se precisar revalidar a direção visual, pergunte ao usuário.

---

## 10. Higiene do repo

Coisas que **existem e não são o que o nome sugere**. Não é preciso corrigir
para trabalhar, mas não gaste tempo procurando o "app real" nelas.

| Caminho | O que é de verdade |
|---------|--------------------|
| `README.md` (raiz) | **Lixo do Figma.** Diz "CLI Terminal Dashboard", aponta para um link do Figma. Não é a doc do projeto. |
| `package.json` → `name` | `"@figma/my-make-file"` — resíduo do Figma Make. |
| `ATTRIBUTIONS.md` | shadcn/ui (MIT) + Unsplash. Legítimo. |
| `Riffles/` **e** `ruffles/` | **A mesma coisa duas vezes**, diferindo só por caixa: `cyberpunk`, `deadsec`, `macroblank`, `new-era`, `SecretSauce`. Material de referência visual, ~dezenas de MB versionados. Provável duplicata acidental. |
| `js/map/CrimeMap.js` | Arquivo de **1 linha**, órfão. Não é o `CrimeMap` real. |
| `src/imports/` | Assets soltos do import do Figma (`.jpg`/`.gif` com hash md5) + `contexto4.md`. |
| `prompt1/`, `guidelines/` | Briefing de design do Figma. Desatualizado (ver §9). |
| `streets.json` | **0 bytes.** |
| `result.json`, `query.txt`, `new_mock_data.txt` | Scratch de análise, sem dono. |
| `fetch_osm.py`, `fetch_osm_simple.py`, `fetch_streets.py`, `parse_streets.py` | Scripts soltos na raiz, fora de `tools/` e do pacote. |
| `postcss.config.mjs` | Vazio (`export default {}`) — Tailwind v4 é via `@tailwindcss/vite`. Placeholder do Figma. |
| `data/processed/`, `data/features/` | Vazios (só `.gitkeep`) — cache local, regenerável. |
| `shared/runs/` | Gitignored por design. `current_run.json` + `shared/heatmaps/` são a interface versionável. |

### Dívidas técnicas conhecidas

1. **CI não cobre o app web oficial.** `web-ci.yml` só dispara em `paths: web/**`
   e valida `web/index.html` — e o passo do `tidy` termina em `|| true`, então
   nunca falha. O `src/` React não tem lint, typecheck, test nem build-check.
2. **`tools/start.sh` abre o legado.** Aponta para `http://localhost:8000/web/`.
3. **Código duplicado entre `src/` e `web/src/`** sem fonte única de verdade.
4. **`App.tsx` tem 1034 linhas** num componente só, com paleta hard-coded
   (`const G = {…}`) em vez de tokens.
5. **`App.tsx:12` diz `// ── PHOSPHOR GREEN PALETTE ──`** mas a paleta é
   amarela. Comentário não atualizado no commit `2a5ce00`.
6. **`summary.json` tem `"nan": 165`** em `by_period` — 165 linhas com período
   não parseável, sem tratamento no pipeline.
7. **Sem `.venv` e sem cache parquet** no estado atual (regenerável).
8. **Não existe `README.md` de verdade na raiz** — só o stub do Figma.

---

## 11. Regras para agents

**Fazer**

- Trabalhar sempre com **cwd = raiz do monorepo**.
- Para atualizar dados: seguir `docs/agents/heatmap-pipeline.md` na ordem
  (checar XLSX → `ingest` → `update --model kde` → validar `shared/`).
- Consumir `shared/*.json` a partir do app; nunca recalcular o heatmap no cliente.
- Usar `--force` quando o artefato parecer stale.
- Commits em **conventional commits** (`feat`, `fix`, `chore`, `docs`,
  `refactor`, `test`), como no histórico existente.

**Não fazer**

- ❌ Treinar no browser/app. Treino é CLI.
- ❌ Rodar `--model kriging` (é stub; levanta `NotImplementedError`).
- ❌ Baixar a SSP automaticamente (portal é SPA, sem permalink) nem **inventar
  XLSX de teste** quando o usuário pediu update de produção.
- ❌ Imputar lat/lng ausentes (`geo_missing`/`geo_zero` se reportam, não se
  consertam).
- ❌ Misturar RES 160/516 (agregado) com microdados no heatmap de pontos.
- ❌ Chamar Supabase / Carto / Mapbox no fluxo default.
- ❌ **Commitar sem pedido explícito do usuário.**
- ❌ Editar `dist/` à mão (gerado).
- ❌ Editar `shared/heatmaps/*.json` à mão (gerado; rode o pipeline).
- ❌ Assumir que a paleta é verde fosforoso só porque `contexto4.md` diz isso.

---

## 12. Índice de docs

| Doc | Assunto |
|-----|---------|
| [`AGENTS.md`](AGENTS.md) | Índice operacional rápido (canônico) |
| [`docs/agents/heatmap-pipeline.md`](docs/agents/heatmap-pipeline.md) | Playbook: trocar fonte → regenerar heatmap + troubleshooting |
| [`shared/README.md`](shared/README.md) | Contrato dos JSON de `shared/` |
| [`data/README.md`](data/README.md) | Produtos da SSP, o que não misturar |
| [`pipeline/README.md`](pipeline/README.md) | CLI Python, notebooks, testes |
| [`pipeline/behavior/README.md`](pipeline/behavior/README.md) | Pipeline de comportamento (IMU) |
| [`tools/README.md`](tools/README.md) | `start.sh`, `dev-web.sh`, `run-pipeline.sh` |
| [`supabase/README.md`](supabase/README.md) | Setup do Supabase local |
| [`web/README.md`](web/README.md) | App legado (vanilla) — descontinuado |
