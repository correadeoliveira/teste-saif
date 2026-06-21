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

Cada script é idempotente e pode ser chamado de qualquer pasta:

```bash
saifen-pipeline          # tudo (process + heatmap)
saifen-process           # só xlsx → parquet + summary
saifen-heatmap           # só parquet → heatmaps
saifen-supabase          # opt-in: parquet/geojson → Supabase
```

Equivalente sem instalação editável:

```bash
python pipeline/scripts/run_pipeline.py
python pipeline/scripts/process_xlsx.py
python pipeline/scripts/generate_heatmap.py
python pipeline/scripts/push_to_supabase.py
```

## Notebooks

```bash
jupyter lab pipeline/notebooks/
```

| notebook | propósito |
|----------|-----------|
| `01_exploracao.ipynb`  | primeiro contato com a base bruta, sanity checks |
| `02_limpeza.ipynb`     | roda `cleaner.clean()`, gera parquet |
| `03_kde_heatmap.ipynb` | KDE + visualização + export `shared/heatmaps/*` |

## Testes

```bash
cd pipeline/
pytest
```

## Layout interno

```
pipeline/
├── pyproject.toml                       # pacote instalável
├── requirements.txt                     # alternativa sem pip install -e
├── saifen_pipeline/
│   ├── config.py                        # paths (ROOT, DATA, OUTPUT) + constantes
│   ├── loader.py                        # leitura de .xlsx SSP-SP
│   ├── cleaner.py                       # limpeza + dedup + summary
│   ├── kde.py                           # gaussian_kde 2D (point + grid)
│   ├── exporter.py                      # JSON/GeoJSON/Parquet
│   └── integrations/
│       └── supabase.py                  # cliente compartilhado
├── scripts/                             # CLIs idempotentes
├── notebooks/                           # exploração / prototipação
└── tests/                               # pytest
```

## Adicionando uma nova fonte de dados

1. Coloque o `.xlsx` em `data/raw/`.
2. Se a estrutura for igual à da SSP-SP, basta rodar `saifen-pipeline`.
3. Se for uma fonte nova:
   - Adicione um novo `loader_<fonte>.py` em `saifen_pipeline/`
   - Mapeie para o schema canônico de `cleaner.CLEAN_COLUMNS`
   - Adicione um teste em `tests/`
