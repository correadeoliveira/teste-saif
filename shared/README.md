# `shared/` — Artefatos gerados (pipeline → apps)

> Esta pasta é a **interface** entre o pipeline Python e os clientes
> JS/TS. Tudo aqui é **gerado**, mas **versionado** para que web e
> mobile funcionem sem precisar rodar o pipeline localmente.

## Conteúdo

```
shared/
├── schema/                      # JSON Schema (CI) — não quebrar sem bump
│   ├── heatmap_points.schema.json
│   ├── current_run.schema.json
│   └── behavior_model.schema.json
├── summary.json
├── current_run.json
├── heatmaps/
├── runs/<run_id>/               # gitignored
└── behavior/
```

### `behavior/model.json`

Contrato do baseline de reconhecimento comportamental (não é heatmap):

```json
{
  "version": "1.0.0",
  "type": "logistic_regression",
  "feature_names": ["ax_mean", "...", "sma_accel"],
  "scaler": { "mean": [], "scale": [] },
  "coef": [],
  "intercept": 0,
  "threshold": 0.5,
  "window_ms": 2000,
  "overlap": 0.5,
  "sample_rate_hz": 50,
  "label_positive": "genuine"
}
```

Gerado por `make -C pipeline/behavior export-model`. O heatmap KDE **não** escreve nesta pasta.

## Contratos (não quebre sem bump de versão)

### `heatmap_points.json` / `heatmap_points__<type>.json`

```json
{
  "meta":   { "generator": "saifen_pipeline", "generated_at": "...", "version": "0.1.0",
              "crime_type": "all|furto|roubo|outros", "period": "all|..." },
  "count":  10000,
  "points": [[lat, lng, weight∈[0,1]], ...]
}
```

### `heatmap_grid.geojson`

```json
{
  "type": "FeatureCollection",
  "bbox": [min_lng, min_lat, max_lng, max_lat],
  "metadata": { "grid_size": 200, "n_points": 57497, "bandwidth": 0.045 },
  "features": [
    { "type": "Feature",
      "properties": { "density": 0.87 },
      "geometry": { "type": "Polygon", "coordinates": [[[lng,lat], ...]] } }
  ]
}
```

### `summary.json`

```json
{
  "meta": { ... },
  "total_incidents": 57497,
  "by_crime_type": { "furto": 29403, "roubo": 19357, "outros": 8737 },
  "by_period":     { "manha": ..., "tarde": ..., "noite": ..., "madrugada": ... },
  "top_neighborhoods": { "PINHEIROS": 2206, ... },
  "top_phone_brands": { "Apple": 23838, ... },
  "date_range": { "min": "...", "max": "..." },
  "bbox": [...]
}
```

## Como esses arquivos são produzidos

```
pipeline/saifen_pipeline/exporter.py
    ├── write_heatmap_points()   → heatmap_points*.json
    ├── write_heatmap_grid()     → heatmap_grid.geojson
    ├── write_crimes_geojson()   → crimes.geojson
    └── write_summary()          → summary.json
```

## Quem consome

| arquivo              | web                                  | mobile                          | supabase            |
|----------------------|--------------------------------------|---------------------------------|---------------------|
| `heatmap_points*`    | `HeatmapLoader.js`                   | `services/heatmap.ts` (fallback)| —                   |
| `heatmap_grid.geojson` | (futuro Mapbox)                    | (futuro Mapbox)                 | `heatmap_grid` table|
| `crimes.geojson`     | (debug)                              | (debug)                         | `crimes` table      |
| `summary.json`       | `BootScreen.js` + `App._renderDataSourceInfo` | TBD                  | RPC `get_summary()` |

## Zona crítica e pânico (app ↔ SQL)

Classificação `low / medium / high / critical` (densidade KDE + contagem de BOs no raio):

- Cliente: `mobile/src/services/zone.ts` (`classifyZone`)
- Banco: RPC `zone_risk` (migration 006). Raio default 250 m, clamp `[50, 2000]`.
- Relato: RPC `report_crime` (device_id obrigatório, 1 BO / 2 min). Offline: fila em `crimes.ts`.

Não alterar limiares num lado só. Testes: `mobile/src/services/zone.test.ts` e `supabase/tests/rpcs.sql`.

O CI (`pipeline-ci`) valida os JSON commitados contra `shared/schema/` — não precisa re-treinar o KDE.
