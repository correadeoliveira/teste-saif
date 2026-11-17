# SAIFEN

Sistema de análise de risco urbano: microdados SSP-SP viram heatmap KDE estático; web e mobile só consomem. Treino **não** roda no app.

```
data/raw/*.xlsx  →  pipeline (Python)  →  shared/heatmaps/*.json
                                            ├─ src/    (React/Vite + Leaflet)
                                            ├─ web/    (HTML/JS + Leaflet)
                                            └─ mobile/ (Expo)
                     supabase/ (PostGIS, opcional: RPC + pânico)
```

## Layout

| Pasta | Papel |
|-------|--------|
| [`pipeline/`](pipeline/README.md) | CLI KDE + pacote irmão IMU (`pipeline/behavior/`) |
| [`shared/`](shared/README.md) | Contrato versionado (JSON do heatmap e `model.json`) |
| [`src/` e `web/`](web/README.md) | Clientes React/Vite e HTML/JS com loader compartilhado |
| [`mobile/`](mobile/README.md) | App Expo (mapa, pânico, zona, IMU) |
| [`supabase/`](supabase/README.md) | Migrations PostGIS + RPCs |
| [`data/`](data/README.md) | Planilhas SSP (não misturar com RES 160) |
| [`tools/`](tools/README.md) | `dev-web.sh`, `run-pipeline.sh` |

## Como rodar

**Web** (Node 22):

```bash
npm ci
npm run dev                  # React em http://localhost:5173/
./tools/dev-web.sh            # HTML/JS em http://127.0.0.1:8000/web/
```

**Pipeline KDE** (Node não treina):

```bash
source .venv/bin/activate
export PYTHONPATH="$PWD/pipeline"
npm run train               # ou ./tools/run-pipeline.sh
```

**Mobile** (Node ≥ 22.13, Expo Go no MVP):

```bash
cd mobile && nvm use 22 && npm ci && npx expo start
```

Detalhes: [`mobile/README.md`](mobile/README.md). Background GPS precisa de build EAS.

## Arquitetura em execução

O pipeline Python publica o heatmap e o resumo depois de validar os
artefatos. Os clientes web compartilham o loader em `shared/web/` e exibem
a fatia carregada. No mobile, o mapa usa Supabase, JSON estático ou cache
verificado antes da demonstração. A avaliação GPS usa fontes reais, e a
verificação IMU executa o modelo de demonstração empacotado no Expo.

## Qualidade

O que rodar localmente e o que o CI exige: **[`docs/agents/quality.md`](docs/agents/quality.md)**.

Índice para coding agents: [`AGENTS.md`](AGENTS.md).
