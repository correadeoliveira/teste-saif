# AGENTS.md

> **Purpose:** índice operacional para coding agents neste monorepo (SAIFEN). Dados SSP-SP → pipeline Python local → heatmap estático → app só consome.
> **Não treinar no app.** Treino é CLI.

## Playbook principal

Atualizar fonte, checar existência e regenerar heatmap no modelo vigente (**kde**):

→ **[docs/agents/heatmap-pipeline.md](docs/agents/heatmap-pipeline.md)**

Qualidade (testes, ruff, CI, contrato `shared/`):

→ **[docs/agents/quality.md](docs/agents/quality.md)**

A referência visual para mudanças na interface está em **[DESIGN.md](DESIGN.md)**.

## Comandos rápidos (raiz do repo)

```bash
# 1) a fonte 2026 está em data/raw?
ls data/raw/*2026.xlsx

# 2) ingest (SHA-256 + schema)
source .venv/bin/activate
export PYTHONPATH="$PWD/pipeline"
python -m saifen_pipeline ingest --year 2026

# 3) update heatmap (modelo default = kde)
npm run train
# para reconstruir um inventário válido:
npm run train:force
```

Equivalente: `./tools/run-pipeline.sh` e `./tools/run-pipeline.sh --force`.

Verificar publicação:

```bash
test -f shared/current_run.json
test -f shared/heatmaps/heatmap_points.json
python -c "import json; print(json.load(open('shared/current_run.json'))['model'])"
# esperado: kde
```

## Modelo

| Nome | Uso |
|------|-----|
| `kde` | default / MVP — use isto no update |
| `baseline` | chão de contagem em grade |
| `kriging` | stub — **não** rodar no update |

## Layout que o agente precisa

| Path | Papel |
|------|--------|
| `data/raw/*.xlsx` | input humano (versionado) |
| `data/processed/` | parquet cache (gitignored) |
| `shared/heatmaps/` | JSON Leaflet.heat (interface app) |
| `shared/current_run.json` | run publicado + fingerprint |
| `pipeline/saifen_pipeline/cli.py` | subcommands `ingest` … `update` |
| `shared/web/heatmap-loader.js` | contrato de heatmap dos clientes React e HTML/JS |
| `mobile/src/services/heatmap.ts` | RPC, JSON estático, cache de origem verificada e demonstração |

## Outros docs

- [docs/agents/quality.md](docs/agents/quality.md) — pytest, ruff, testes mobile, supabase-ci, schemas
- [pipeline/README.md](pipeline/README.md) — CLI, testes, notebooks
- [data/README.md](data/README.md) — produtos SSP (não misturar RES 160 com microdados)
- [shared/README.md](shared/README.md) — contrato dos JSON
- [tools/README.md](tools/README.md) — `run-pipeline.sh`, `dev-web.sh`
- [mobile/README.md](mobile/README.md) · [web/README.md](web/README.md) · [supabase/README.md](supabase/README.md)

## Regras

- Cwd = raiz do monorepo.
- Ano da fonte = 2026 (`SOURCE_YEAR`).
- Preferir `SPDadosCriminais_2026.xlsx` se existir; senão `CelularesSubtraidos_2026.xlsx`.
- Não baixar SSP automaticamente (sem permalink).
- Não commitar sem pedido explícito do usuário.
- Commits: conventional commits (`feat`, `fix`, `chore`, `docs`, `refactor`, `test`).
