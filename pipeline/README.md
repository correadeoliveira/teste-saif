# `pipeline/` — Workflow Python

> Componente Python do monorepo SAIFEN. Lê planilhas brutas da SSP-SP em
> `data/raw/*.xlsx`, gera artefatos KDE em `shared/heatmaps/*` consumidos
> pelos apps web/mobile, e (opcionalmente) sincroniza com o Supabase.

```
┌───────────────────────────┐
│  data/raw/*.xlsx          │  ←── SSP-SP (input bruto)
└─────────┬─────────────────┘
          │ loader
          ▼
┌───────────────────────────┐
│  saifen_pipeline.cleaner  │  filtros + categorias + dedup
└─────────┬─────────────────┘
          │
          ▼
┌───────────────────────────┐
│  data/processed/*.parquet │  ←── cache local (.gitignored)
└─────────┬─────────────────┘
          │ kde + exporter
          ▼
┌───────────────────────────┐
│  shared/heatmaps/*        │  ←── output versionado, lido por web+mobile
│  shared/summary.json      │
└─────────┬─────────────────┘
          │ (opcional)
          ▼
┌───────────────────────────┐
│  Supabase (PostGIS)       │  ←── push_to_supabase.py
└───────────────────────────┘
```

## Setup

```bash
cd pipeline/
python3 -m venv ../.venv && source ../.venv/bin/activate
pip install -e ".[notebooks,supabase]"     # pacote + extras
```

> Você pode também rodar `pip install -r requirements.txt` se preferir
> evitar instalação editável.

## CLI

`update` valida o SHA-256 da fonte, a versão do pipeline, os parâmetros e os
hashes dos artefatos publicados antes de reutilizar o resultado. Os apps
consomem os artefatos publicados em `shared/`.

```bash
python -m saifen_pipeline update      # fluxo completo
python -m saifen_pipeline ingest      # checksum + schema + manifest
python -m saifen_pipeline preprocess  # xlsx → parquet e resumo em data/processed/
python -m saifen_pipeline train       # --model kde|baseline|kriging
python -m saifen_pipeline evaluate --compare    # contagem, Scott e KDE em metros
python -m saifen_pipeline heatmap     # diagnóstico em data/processed/heatmaps/
python -m saifen_pipeline publish     # republica a última execução validada
```

Playbook para coding agents (checar XLSX → ingest → update kde → validar `shared/`):

[docs/agents/heatmap-pipeline.md](../docs/agents/heatmap-pipeline.md) · [AGENTS.md](../AGENTS.md)

Da raiz do monorepo:

```bash
./tools/run-pipeline.sh          # = update
./tools/run-pipeline.sh --force
npm run train
```

Equivalente sem `-m`:

```bash
python pipeline/scripts/run_pipeline.py
python pipeline/scripts/ingest.py
python pipeline/scripts/process_xlsx.py
python pipeline/scripts/generate_heatmap.py
```

## Avaliação temporal

A grade fixa de São Paulo inclui células vazias. O treino usa os meses
anteriores, a validação usa o penúltimo mês e o teste usa o último. Para
bases mais curtas, o corte usa datas inteiras. Hit Rate@10% é a parcela
de ocorrências do período nas 10% de células com maior score. Para MAE e
RMSE, a quantidade estimada de ocorrências vem da taxa diária do treino.

Comparação reproduzida com `CelularesSubtraidos_2026.xlsx`, 55.611
ocorrências após limpeza e 14.491 no teste de abril de 2026.

| Modelo | Hit Rate@10% na validação | Hit Rate@10% no teste |
|---|---:|---:|
| Contagem por célula | 51,6% | 54,3% |
| KDE Scott | 44,8% | 48,2% |
| KDE 250 m | 50,3% | 53,4% |

`evaluate --compare` escolhe o candidato KDE pela validação e avalia esse
candidato, Scott e a contagem no teste. `update` usa Scott por padrão.
O mapa representa a incidência observada de BOs georreferenciados.

## Notebooks

```bash
jupyter lab pipeline/notebooks/
```

| notebook | propósito |
|----------|-----------|
| `01_exploracao.ipynb`  | primeiro contato com a base bruta, sanity checks |
| `02_limpeza.ipynb`     | roda `cleaner.clean()`, gera parquet |
| `03_kde_heatmap.ipynb` | KDE + visualização + export `shared/heatmaps/*` |

## Testes e CI

```bash
cd pipeline/
pip install -e ".[test]" ruff
ruff check .
ruff format --check .
pytest -q --cov=saifen_pipeline --cov-fail-under=70
```

- **pipeline-ci** (PR/push em `pipeline/**`): ruff + pytest + contrato JSON em `shared/schema/`. Não gera heatmap.
- **pipeline.yml** (push relevante na `main` ou execução manual): pytest **antes** do treino KDE. Publica `shared/heatmaps/`, `shared/current_run.json` e `shared/summary.json` na `main`.

Behavior (sklearn) é pacote irmão: `cd pipeline/behavior && pytest -q`.

Playbook: [docs/agents/quality.md](../docs/agents/quality.md).

## Layout interno

```
pipeline/
├── pyproject.toml                       # pacote instalável (KDE / crimes)
├── requirements.txt                     # alternativa sem pip install -e
├── saifen_pipeline/                     # heatmap SSP-SP
├── behavior/                            # IMU → LR → model.json (irmão, sklearn)
├── scripts/
├── notebooks/
└── tests/
```

Reconhecimento comportamental (acelerômetro/giroscópio) **não** entra neste
pacote. Ver [behavior/README.md](behavior/README.md). `npm run train` na raiz
continua sendo só o KDE.

## Adicionando uma nova fonte de dados

1. Coloque o `.xlsx` em `data/raw/`.
2. Se a estrutura for igual à da SSP-SP, basta rodar `saifen-pipeline`.
3. Se for uma fonte nova:
   - Adicione um novo `loader_<fonte>.py` em `saifen_pipeline/`
   - Mapeie para o schema canônico de `cleaner.CLEAN_COLUMNS`
   - Adicione um teste em `tests/`
