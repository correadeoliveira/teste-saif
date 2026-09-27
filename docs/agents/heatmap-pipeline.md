# Playbook: atualizar dados SSP e heatmap

> **Purpose:** instruir um coding agent a (1) verificar se a fonte XLSX existe, (2) rodar o pipeline que atualiza os dados e (3) regenerar o heatmap no modelo espacial vigente, sem treinar no app.
> **Audience:** coding agents (Cursor, Codex, Claude Code). Humanos: usar os mesmos comandos.
> **Cwd obrigatório:** raiz do monorepo (`teste-saif/`).
> **Modelo default:** `kde` (MVP). Não usar `kriging` no caminho de update.

Cross-refs: [AGENTS.md](../../AGENTS.md) · [pipeline/README.md](../../pipeline/README.md) · [data/README.md](../../data/README.md) · [shared/README.md](../../shared/README.md)

---

## 1. O que este fluxo faz

O app **não treina**. Ele só lê JSON estático em `shared/heatmaps/` (via `/shared/...` no Vite).

O treino é CLI Python, local:

```
data/raw/*.xlsx
        → ingest (SHA-256 + schema + manifest)
        → preprocess (parquet + summary + grade)
        → evaluate (split temporal intra-2026)
        → fit modelo (kde)
        → heatmap slices (tipo × período)
        → shared/heatmaps/* + shared/current_run.json
```

Comando canônico: `python -m saifen_pipeline update` (idempotente). Atalhos equivalentes: `npm run train` e `./tools/run-pipeline.sh`.

---

## 2. Modelo vigente

| Flag `--model` | Status | Quando usar |
|----------------|--------|-------------|
| `kde` | **default / MVP** | Update de heatmap. SciPy `gaussian_kde`. Bandwidth default `scott`. |
| `baseline` | implementado | Comparação de chão (contagem em grade ~H3 res 8, `GRID_CELL_DEG=0.0065`). |
| `kriging` | **stub** | Proibido no update. `fit()` levanta `NotImplementedError` (exit 2). |

Constantes em `pipeline/saifen_pipeline/config.py`:

- `SOURCE_YEAR = 2026`
- `PIPELINE_VERSION = 0.2.0`
- `KDE_BANDWIDTH = "scott"`
- `KDE_GRID_SIZE = 200`
- `HEATMAP_CRIME_TYPES = (furto, roubo, outros)`
- `PERIODS = (manha, tarde, noite, madrugada)`

Idempotência: fingerprint = SHA-256 da fonte + nome do modelo + params. Se bater com `shared/current_run.json` e não houver `--force`, o CLI loga `update.skip` e **não** reescreve heatmaps.

Use `--force` quando: o XLSX mudou mas o hash não foi detectado, os JSON em `shared/heatmaps/` estão ausentes/stale, ou o usuário pediu regenerar.

---

## 3. Pré-requisitos (agente deve checar nesta ordem)

Rodar na raiz. Falhou um passo → parar e reportar; não pular para o update.

```bash
# 3.1 raiz do repo
test -f package.json && test -d pipeline/saifen_pipeline

# 3.2 venv
test -d .venv || python3 -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate
python -c "import pandas, numpy, scipy, openpyxl, pyarrow" 2>/dev/null \
  || pip install -r pipeline/requirements.txt

export PYTHONPATH="$PWD/pipeline${PYTHONPATH:+:$PYTHONPATH}"
```

Fonte bruta (não há download automático; portal SSP é SPA):

| Prioridade | Path | Produto |
|------------|------|---------|
| 1 (preferido) | `data/raw/SPDadosCriminais_2026.xlsx` | BOs georreferenciados |
| 2 (atual no repo) | `data/raw/CelularesSubtraidos_2026.xlsx` | recorte temático celulares |

`ingest.resolve_source` escolhe **spdados > celulares** se ambos existirem. Ano: 2026.

```bash
# 3.3 fonte existe?
ls -lh data/raw/*2026.xlsx
test -f data/raw/SPDadosCriminais_2026.xlsx \
  || test -f data/raw/CelularesSubtraidos_2026.xlsx
```

Se nenhum XLSX: **não inventar dados**. Dizer ao usuário para dropar o arquivo em `data/raw/` a partir de https://www.ssp.sp.gov.br/estatistica/consultas. Exit.

Não misturar RES 160/516 (agregado, sem lat/lng) com microdados. RES não alimenta heatmap.

---

## 4. Verificar se os dados existem e são válidos

### 4.1 Ingest (checksum + sheet + geo)

```bash
python -m saifen_pipeline ingest --year 2026
```

Sucesso: log JSON `event=ingest.ok` e arquivo `data/raw/manifest.json`.

Campos que o agente deve ler no stdout / manifest:

| Campo | Significado |
|-------|-------------|
| `file` | nome do XLSX escolhido |
| `product` | `celulares` ou `spdados` |
| `sha256` | fingerprint da fonte |
| `n_rows` | linhas na sheet de dados |
| `data_sheet` | ex. `CELULAR_2026` |
| `geo_missing` / `geo_zero` | qualidade geo (não imputar) |

Exit 1: arquivo ausente, sheet sem LATITUDE/LONGITUDE, schema inválido. Corrigir a fonte; não mascarar com `--allow-invalid` no fluxo de update.

### 4.2 Cache processado (opcional)

```bash
test -f data/processed/celulares_clean.parquet && echo processed_ok || echo processed_missing
test -f data/features/crime_aggregate.parquet && echo features_ok || echo features_missing
```

Parquet ausente é normal antes do primeiro `preprocess`/`update`. Não é bloqueio se o próximo passo for `update`.

`heatmap` / `train` / `evaluate` **sozinhos** exigem o parquet (`FileNotFoundError` → “rode preprocess”).

### 4.3 Artefatos atuais vs fonte

```bash
python - <<'PY'
import json
from pathlib import Path
run = Path("shared/current_run.json")
print("current_run", "exists" if run.exists() else "MISSING")
if run.exists():
    d = json.loads(run.read_text())
    print("model", d.get("model"))
    print("source_file", d.get("source_file"))
    print("source_sha256", d.get("source_sha256"))
    print("run_id", d.get("run_id"))
heat = Path("shared/heatmaps/heatmap_points.json")
print("heatmap_points", "exists" if heat.exists() else "MISSING")
PY
```

Se `current_run.json` existe e `model != kde` no caminho default, o heatmap publicado **não** é o MVP. Regenerar com `--model kde --force`.

---

## 5. Update do heatmap (comando principal)

Preferir o atalho (cria venv se faltar, seta `PYTHONPATH`, chama `update`):

```bash
# pulou se fingerprint igual ao current_run
npm run train

# regenera sempre
npm run train:force
```

Equivalente:

```bash
./tools/run-pipeline.sh
./tools/run-pipeline.sh --force

python -m saifen_pipeline update --year 2026 --model kde
python -m saifen_pipeline update --year 2026 --model kde --force
```

O que `update` executa internamente (não reimplementar na mão a menos que o usuário peça um estágio só):

1. `ingest`
2. se fingerprint == current e não `--force` → `update.skip`, exit 0
3. `preprocess` (xlsx → `data/processed/celulares_clean.parquet` + `shared/summary.json` + features)
4. `evaluate` (split por mês intra-2026; pode logar `evaluate.skip`)
5. `model.fit` + `generate_artifacts` (KDE + fatias)
6. `shared/runs/<run_id>/` + `shared/current_run.json`

Flags úteis (não usar sem pedido):

| Flag | Efeito |
|------|--------|
| `--force` | ignora idempotência |
| `--model kde\|baseline\|kriging` | default `kde` |
| `--bandwidth scott\|silverman\|<float>` | KDE |
| `--bandwidth-m <float>` | KDE em metros (converte p/ graus) |
| `--no-per-type` / `--no-per-period` | não gera fatias |
| `--no-bbox` | não filtra São Paulo capital |
| `--year 2026` | default do config |

Estágios isolados (só se o usuário pedir debug):

```bash
python -m saifen_pipeline preprocess --year 2026
python -m saifen_pipeline train --model kde
python -m saifen_pipeline evaluate --model kde
python -m saifen_pipeline heatmap --model kde
python -m saifen_pipeline publish
```

Duração típica no XLSX real (~32 MB, ~115k linhas brutas): da ordem de 1–2 min no `update --force` (ingest lê o Excel duas vezes). Não matar o processo cedo.

---

## 6. Verificar se o heatmap foi publicado

Sucesso do update: log `event=update.ok` com `artifact=shared/heatmaps`.

```bash
python - <<'PY'
import json, sys
from pathlib import Path

root = Path("shared")
required = [
    root / "current_run.json",
    root / "summary.json",
    root / "heatmaps" / "heatmap_points.json",
    root / "heatmaps" / "heatmap_grid.geojson",
]
types = ("furto", "roubo", "outros")
periods = ("manha", "tarde", "noite", "madrugada")
for t in types:
    required.append(root / "heatmaps" / f"heatmap_points__{t}.json")
    for p in periods:
        required.append(root / "heatmaps" / f"heatmap_points__{t}__{p}.json")

missing = [str(p) for p in required if not p.exists()]
run = json.loads((root / "current_run.json").read_text()) if (root / "current_run.json").exists() else {}
print("model", run.get("model"))
print("model_version", run.get("model_version"))
print("source_file", run.get("source_file"))
print("run_id", run.get("run_id"))
print("missing", missing or "none")
if run.get("model") != "kde":
    sys.exit(2)
if missing:
    sys.exit(1)
print("heatmap_update_ok")
PY
```

Contrato de `heatmap_points*.json` (não quebrar):

```json
{
  "meta": { "generator": "saifen_pipeline", "crime_type": "all|furto|roubo|outros", "period": "all|manha|tarde|noite|madrugada" },
  "count": 10000,
  "points": [[lat, lng, weight]]
}
```

`weight` ∈ [0, 1]. Consumidor: `src/data/HeatmapLoader.js` e `web/src/data/HeatmapLoader.js` (`/shared/heatmaps/...`).

Fatia tipo×período pode faltar se `n < 3` ou KDE colinear (`heatmap.slice_skip`). Não tratar isso como falha total se `heatmap_points.json` e os três tipos existirem.

`shared/runs/` é gitignored. `current_run.json` + `shared/heatmaps/` + `shared/summary.json` são a interface versionável.

---

## 7. Testes do pipeline (não substitui o update no XLSX real)

```bash
source .venv/bin/activate
export PYTHONPATH="$PWD/pipeline"
cd pipeline && pytest
```

Os testes usam fixture XLSX mínima, **não** o arquivo de 32 MB. Pytest verde ≠ heatmap de produção atualizado.

---

## 8. Falhas e o que fazer

| Sintoma | Causa | Ação |
|---------|-------|------|
| `FileNotFoundError` nenhum `.xlsx` | `data/raw/` vazio | pedir drop do XLSX 2026; não baixar “no chute” |
| `Nenhuma sheet de dados com LATITUDE/LONGITUDE` | produto errado (ex. RES 160) | trocar arquivo; não adaptar RES para heatmap |
| `update.skip` mas UI velha | fingerprint igual / artefato stale | `npm run train:force` |
| `Ordinary Kriging não é o MVP` | `--model kriging` | rerodar `--model kde` |
| `{parquet} não existe` | `heatmap` sem preprocess | `update` ou `preprocess` antes |
| UI sem ruas / “API KEY REQUIRED” | tiles Carto | mapa-base é OSM em `src/map/LocalBasemap.js`; não misturar com pipeline |
| Heatmap mock no mapa | Vite não serve `/shared/` ou JSON ausente | conferir `vite.config.ts` `serveShared()` e os arquivos da seção 6 |
| `evaluate.skip` | split temporal sem meses suficientes | update ainda pode publicar heatmap; reportar métricas ausentes |

Logs: uma linha JSON por evento (`ingest.ok`, `preprocess.ok`, `evaluate.ok`, `heatmap.points`, `publish.ok`, `update.ok` / `update.skip`).

---

## 9. Regras para o agente

- **Fazer:** checar XLSX → ingest → `update` (`kde`) → validar `current_run.json` + JSON de pontos.
- **Não fazer:** treinar no browser; chamar SSP/Carto/Mapbox/Supabase no fluxo default; usar `--model kriging`; imputar lat/lng; misturar RES 160 com microdados; commitar sem o usuário pedir; inventar XLSX de teste no lugar da fonte real quando o usuário pediu update de produção.
- **Disclaimer do artefato (obrigatório, já gravado em meta):** incidência observada de BOs georreferenciados. Não é probabilidade individual nem estatística oficial RES 160/516.
- **App:** `npm run dev` só consome artefatos. Depois do update, hard refresh em http://localhost:5173/ se o Vite já estiver no ar.
