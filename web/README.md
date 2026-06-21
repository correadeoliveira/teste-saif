# `web/` — Frontend Web (Leaflet → Mapbox GL JS)

> Cliente web cyberpunk que consome os artefatos KDE gerados em
> `shared/heatmaps/*` pelo pipeline Python e (futuramente) o Supabase
> para dados em tempo real.

## Como rodar localmente

O frontend é puro HTML + ES6 modules — sem build step. Mas precisa de
um HTTP server para que os imports funcionem e para resolver
`/shared/heatmaps/*` a partir da raiz do monorepo.

```bash
# Da raiz do monorepo:
./tools/dev-web.sh           # → http://localhost:8000/web/
```

Ou manualmente:

```bash
cd <root>                    # raiz do monorepo, NÃO web/
python3 -m http.server 8000
open http://localhost:8000/web/
```

> Servir a partir da raiz é essencial para `/shared/...` resolver.

## Estrutura

```
web/
├── index.html                # entrypoint
├── style.css                 # tema CRT/cyberpunk
├── assets/                   # imagens, ícones, fontes locais
└── src/
    ├── main.js               # bootstrap (cria App)
    ├── config/
    │   └── env.js            # URL Supabase, feature flags (futuro)
    ├── core/
    │   └── App.js            # orquestrador
    ├── data/
    │   ├── HeatmapLoader.js  # fetch /shared/heatmaps/*.json (+ cache)
    │   ├── SupabaseClient.js # cliente Supabase (fallback no estático)
    │   └── MockData.js       # fallback completo (rodar sem pipeline)
    ├── map/
    │   ├── CrimeMap.js       # Leaflet wrapper
    │   ├── LayerManager.js   # toggle de camadas (heatmap, safepoints…)
    │   ├── MarkerManager.js  # POIs (farmácias, delegacias, hospitais)
    │   ├── RouteManager.js   # rotas seguras
    │   ├── FlowLayer.js      # densidade de pessoas
    │   └── LightingLayer.js  # iluminação noturna
    └── ui/
        ├── BootScreen.js     # CRT init sequence
        ├── AlertSystem.js    # toasts + feed
        ├── HUDController.js  # HUD principal
        ├── FilterSystem.js   # filtros de tipo/período
        └── RiskAnalyzer.js   # narrativa de risco
```

## Cadeia de fallbacks (ordem de prioridade)

```
1. Supabase (RPC `get_heatmap_grid`)        ← futuro, se SUPABASE_URL configurado
2. /shared/heatmaps/heatmap_points.json     ← gerado pelo pipeline Python
3. src/data/MockData.js (crimeHeatData)     ← sempre disponível, sem dependência
```

Se nada estiver disponível, o app mostra a simulação local sem
quebrar — o footer indica qual fonte está ativa.

## Deploy (futuro)

- **Vercel/Netlify**: configurar root como a raiz do monorepo
  (precisa de `/shared/` acessível). Adicionar `vercel.json` redirects
  se necessário.
- **GitHub Pages**: usar `actions/deploy-pages` apontando para a raiz
  do monorepo, mas filtrando para servir só `web/` e `shared/`.

## Migração para Mapbox GL JS

O `CrimeMap.js` encapsula Leaflet. Para migrar:

1. Adicionar fonte `mapbox-gl` no `index.html`.
2. Trocar `L.heatLayer(points)` por `map.addSource('heat', {type:'geojson', data:'/shared/heatmaps/heatmap_grid.geojson'})`.
3. Usar `heatmap-weight: ['get', 'density']` no paint.

A interface pública de `CrimeMap` (init, applyFilters, loadRealHeatmap)
permanece a mesma para não quebrar `App.js`.
