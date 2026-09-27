# SAIFEN

Sistema de análise de risco urbano: microdados SSP-SP viram heatmap KDE estático; web e mobile só consomem. Treino **não** roda no app.

```
data/raw/*.xlsx  →  pipeline (Python)  →  shared/heatmaps/*.json
                                            ├─ web/   (Leaflet)
                                            └─ mobile/ (Expo)
                     supabase/ (PostGIS, opcional: RPC + pânico)
```

## Layout

| Pasta | Papel |
|-------|--------|
| [`pipeline/`](pipeline/README.md) | CLI KDE + pacote irmão IMU (`pipeline/behavior/`) |
| [`shared/`](shared/README.md) | Contrato versionado (JSON do heatmap e `model.json`) |
| [`web/`](web/README.md) | Cliente HTML/JS |
| [`mobile/`](mobile/README.md) | App Expo (mapa, pânico, zona, IMU) |
| [`supabase/`](supabase/README.md) | Migrations PostGIS + RPCs |
| [`data/`](data/README.md) | Planilhas SSP (não misturar com RES 160) |
| [`tools/`](tools/README.md) | `dev-web.sh`, `run-pipeline.sh` |

## Como rodar

**Web** (servir a raiz do monorepo, não `web/`):

```bash
./tools/dev-web.sh          # http://localhost:8000/web/
```

**Pipeline KDE** (Node não treina):

```bash
source .venv/bin/activate
export PYTHONPATH="$PWD/pipeline"
npm run train               # ou ./tools/run-pipeline.sh
```

**Mobile** (Node ≥ 22.13, Expo Go no MVP):

```bash
cd mobile && nvm use 22 && npm install && npx expo start
```

Detalhes: [`mobile/README.md`](mobile/README.md). Background GPS precisa de build EAS.

## Qualidade

O que rodar localmente e o que o CI exige: **[`docs/agents/quality.md`](docs/agents/quality.md)**.

Índice para coding agents: [`AGENTS.md`](AGENTS.md).
