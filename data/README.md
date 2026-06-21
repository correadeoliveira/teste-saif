# `data/` — Dados brutos e processados

## Estrutura

```
data/
├── raw/                                 # ←── inputs originais (VERSIONADO)
│   └── CelularesSubtraidos_<ANO>.xlsx   #     SSP-SP
└── processed/                           # ←── cache do pipeline (.gitignored)
    └── celulares_clean.parquet
```

## Convenção de naming

| pasta         | quem escreve   | quem lê                          | versionado? |
|---------------|----------------|----------------------------------|-------------|
| `raw/`        | humano (drop)  | `pipeline/saifen_pipeline.loader`| **sim**     |
| `processed/`  | pipeline       | pipeline (cache rápido)          | **não**     |

## Adicionando um novo arquivo bruto

1. Baixe o `.xlsx` em [SSP-SP — Transparência](https://www.ssp.sp.gov.br/transparenciassp/Consulta.aspx).
2. Salve em `data/raw/CelularesSubtraidos_<ANO>.xlsx`.
3. Rode `tools/run-pipeline.sh --force` para reprocessar.
4. Commit do `.xlsx` + dos artefatos gerados em `shared/`.

> Arquivos `.xlsx` ficam versionados (~32MB cada). Para inputs maiores
> que 100MB, considere Git LFS antes de comitar.
