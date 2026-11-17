# Playbook de atualização do heatmap SSP-SP

Rode da raiz do monorepo. O caminho padrão lê a fonte SSP-SP 2026 e
publica um heatmap KDE com bandwidth Scott. Os apps consomem o artefato
publicado pelo CLI.

## Fonte e ambiente

1. Coloque a fonte em `data/raw/`. O CLI prefere
   `SPDadosCriminais_2026.xlsx` e usa `CelularesSubtraidos_2026.xlsx` como
   alternativa. Obtenha a planilha pelo [portal da SSP-SP](https://www.ssp.sp.gov.br/estatistica/consultas).
   O pipeline requer microdados com coordenadas.
2. Confira a fonte e o ambiente Python.

   ```bash
   ls -lh data/raw/*2026.xlsx
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -e pipeline
   python -m saifen_pipeline ingest --year 2026
   ```

O evento `ingest.ok` informa arquivo, SHA-256, total de linhas e contagem
de coordenadas vazias e zeradas. O manifesto local fica em
`data/raw/manifest.json`. Em caso de schema inválido, corrija a fonte e
repita a ingestão.

## Atualização e verificação

```bash
npm run train
# Equivalentes
./tools/run-pipeline.sh
python -m saifen_pipeline update --year 2026 --model kde
```

O CLI valida a planilha, limpa e agrega registros, avalia o modelo em
cortes temporais e ajusta o KDE com os dados completos. Gera heatmap,
grade e resumo em staging, valida os arquivos, grava o inventário e
publica o manifesto por último.

A reutilização exige que SHA-256 da fonte, versão, parâmetros e inventário
publicado coincidam. Um arquivo ausente ou divergente provoca reconstrução.
Use `npm run train:force` para reconstruir deliberadamente um inventário válido.

O evento `update.ok` informa a duração e o run publicado. Confira:

```bash
test -s shared/heatmaps/heatmap_points.json
test -s shared/heatmaps/heatmap_grid.geojson
test -s shared/summary.json
python -c "import json; print(json.load(open('shared/current_run.json'))['model'])"
```

As fatias por tipo e período são opcionais quando faltam pontos suficientes.
`heatmap.slice_skip` registra o recorte omitido. Os clientes usam a fatia
mais ampla disponível e mostram qual foi carregada. O peso KDE é relativo à
distribuição da fatia. O mapa descreve incidência observada de BOs
georreferenciados.

## Avaliação e diagnóstico

```bash
python -m saifen_pipeline preprocess --year 2026
python -m saifen_pipeline evaluate --compare
python -m saifen_pipeline heatmap --model kde
```

`preprocess` e `heatmap` geram saídas de diagnóstico em `data/processed/`.
Use `evaluate --compare` para comparar a contagem e as variantes KDE com
a grade fixa. O [README do pipeline](../../pipeline/README.md) explica a
métrica, o corte temporal e os resultados na fonte 2026.

`--bandwidth` aceita `scott`, `silverman` ou um fator numérico de
covariância. `--bandwidth-m` usa um kernel métrico isotrópico. Os ajustes
experimentais ficam disponíveis pela CLI. O update padrão usa Scott e o
modelo `kriging` é reservado para uma implementação futura.

## Recuperação e CI

Se uma publicação falhar ou for interrompida, o próximo `update` ou
`publish` recupera a cópia anterior antes de proceder. A CLI troca cada
arquivo de forma atômica. A referência publicada é `current_run.json`.
Os snapshots completos ficam em `shared/runs/` e
`python -m saifen_pipeline publish` reaplica o último snapshot validado.

O workflow de publicação roda os testes, serializa builds do mesmo ref,
mostra métricas e qualidade da fonte no resumo, e publica os artefatos
gerados em um commit no `main`. Se a ponta da branch avançar durante a
execução e o push falhar, reexecute o workflow na revisão atual.
