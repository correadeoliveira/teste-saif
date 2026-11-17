# `web/` — Frontend Web (Leaflet → Mapbox GL JS)

> Cliente web cyberpunk que consome os artefatos KDE gerados em
> `shared/heatmaps/*` pelo pipeline Python e (futuramente) o Supabase
> para dados em tempo real.

## Como rodar localmente

Os dois clientes usam o contrato de `/shared/heatmaps/` e o loader em
`shared/web/heatmap-loader.js`. Use Node 22 na raiz do monorepo.

```bash
npm ci
npm run dev          # React/Vite em http://localhost:5173/
./tools/dev-web.sh   # HTML/JS em http://127.0.0.1:8000/web/
npm run build       # React + artefatos públicos em dist/
npm run preview     # React de produção em http://localhost:4174/
```

O HTTP server de `dev-web.sh` serve os arquivos públicos do cliente HTML/JS
e do heatmap. Para um aparelho na rede de desenvolvimento, rode
`SAIFEN_WEB_HOST=0.0.0.0 ./tools/dev-web.sh` e use o IP local no
`EXPO_PUBLIC_SHARED_BASE` do mobile.

No React, **FILTROS** abre a gaveta a partir do mapa. Ela compartilha as
seleções da aba **STATS** e salva as preferências no navegador. **FLUXO** e
**ROTAS** ativam as camadas de demonstração. A barra superior mostra a
região do mapa e o horário de São Paulo. O questionário guarda as respostas
localmente e pode usar `POST /api/behavior-profile` no Vite local com origem
do próprio servidor. Esse endpoint valida JSON e tamanho e grava em
`data/profiles/`.

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

## Fontes e fallbacks

Os dois clientes validam a fatia pedida e tentam, em ordem, tipo e período,
tipo completo, heatmap geral e demonstração. O HTML/JS mostra a origem na
barra de contexto. A legenda do React mostra a fatia carregada quando a
camada de calor tem uma escala calculada. `shared/summary.json` descreve
o total da base SSP-SP. O console registra a origem, duração, contagem e
ocorrência de fallback do carregamento.
O React usa Canvas 2D para manter a camada de calor disponível quando o
navegador não consegue inicializar WebGL.
Com **HEAT** ativo, tocar no mapa mostra o peso da amostra mais próxima da
fatia em até 500 m ou indica que o recorte carregado não tem amostra ali.

## CI

O CI valida o HTML e os imports relativos, testa o loader e os fallbacks,
compila o Vite e abre os dois clientes em Chromium com as respostas de
rede simuladas. O smoke test abre as gavetas por toque, aplica filtros,
verifica as camadas simuladas e confere o desenho com WebGL desativado.
[Playbook de qualidade](../docs/agents/quality.md).

## Deploy (futuro)

- **React/Vite**: publicar `dist/`, que já inclui os artefatos públicos.
- **HTML/JS**: publicar `web/`, `shared/web/` e os artefatos públicos definidos em `tools/public-files.mjs`.

## Migração para Mapbox GL JS

O `CrimeMap.js` encapsula Leaflet. Para migrar:

1. Adicionar fonte `mapbox-gl` no `index.html`.
2. Trocar `L.heatLayer(points)` por `map.addSource('heat', {type:'geojson', data:'/shared/heatmaps/heatmap_grid.geojson'})`.
3. Usar `heatmap-weight: ['get', 'density']` no paint.

A interface pública de `CrimeMap` (init, applyFilters, loadRealHeatmap)
permanece a mesma para não quebrar `App.js`.
