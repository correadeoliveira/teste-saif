# `data/` — Dados brutos e processados

## Estrutura

```
data/
├── raw/                                 # inputs originais (VERSIONADO)
│   ├── CelularesSubtraidos_<ANO>.xlsx   # produto C — celulares subtraídos
│   ├── SPDadosCriminais_<ANO>.xlsx      # produto B — BOs georreferenciados (preferido)
│   └── manifest.json                    # gerado pelo ingest (gitignore)
├── processed/                           # cache do pipeline (.gitignored)
│   └── celulares_clean.parquet
└── features/                            # agregados de grade (.gitignored)
    └── crime_aggregate.parquet
```

## Três produtos da SSP (não misturar)

1. **RES 160 / RES 516** — estatística oficial agregada (município / unidade policial, sem lat/lng). Não alimenta o heatmap de pontos.
2. **Dados criminais (`SPDadosCriminais_YYYY.xlsx`)** — microdados de BOs com coordenadas. Alvo preferido do heatmap. Baixe o ano mais recente (2026) em [Consultas](https://www.ssp.sp.gov.br/estatistica/consultas).
3. **Celulares / veículos / objetos subtraídos** — recortes temáticos. O repositório já contém `CelularesSubtraidos_2026.xlsx` e o pipeline usa esse arquivo até o produto 2 ser dropado em `raw/`.

O heatmap representa incidência observada de BOs georreferenciados. **Não** é a estatística oficial RES 160 nem probabilidade individual.

## Convenção

| pasta         | quem escreve   | quem lê                          | versionado? |
|---------------|----------------|----------------------------------|-------------|
| `raw/*.xlsx`  | humano (drop)  | `saifen_pipeline.ingest`         | **sim**     |
| `raw/manifest.json` | ingest   | humanos / CI                     | não         |
| `processed/`  | pipeline       | pipeline                         | **não**     |
| `features/`   | pipeline       | pipeline (baseline / eval)       | **não**     |

## Atualizar a base

1. Baixe o `.xlsx` em [SSP-SP — Consultas](https://www.ssp.sp.gov.br/estatistica/consultas) (não há permalink estável).
2. Salve em `data/raw/SPDadosCriminais_2026.xlsx` (preferido) ou `CelularesSubtraidos_2026.xlsx`.
3. Rode `npm run train` ou `./tools/run-pipeline.sh`.
4. Commit do `.xlsx` + artefatos em `shared/heatmaps/` e `shared/current_run.json`.

Não há download automático: o portal de consultas é uma SPA sem URL GET documentada.
