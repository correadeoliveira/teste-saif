import L from './leafletSetup.js';
import { SP_CENTER, DEFAULT_ZOOM, crimeHeatData, crimesByType } from '../data/MockData.js';
import { heatmapLoader, HeatmapLoader } from '../data/HeatmapLoader.js';
import { RouteManager } from './RouteManager.js';
import { MarkerManager } from './MarkerManager.js';
import { FlowLayer } from './FlowLayer.js';
import { LightingLayer } from './LightingLayer.js';
import { ContactsLayer } from './ContactsLayer.js';
import { createLocalBasemap } from './LocalBasemap.js';
import { computeRiskScale, fallbackScale } from './riskScale.js';

export class CrimeMap {
    constructor() {
        this.map = null;
        this.heatLayer = null;
        this.routeManager = null;
        this.markerManager = null;
        this.flowLayer = null;
        this.lightingLayer = null;
        this.contactsLayer = null;
        this._activeFilters = { types: [], period: 'all' };
        this._heatmapLoader = heatmapLoader;
        this._realDataLoaded = false;
        this._currentDatasetKey = null;
    }

    init() {
        this.map = L.map('map', {
            center: SP_CENTER,
            zoom: DEFAULT_ZOOM,
            zoomControl: false,
            attributionControl: false,
            maxZoom: 18,
            minZoom: 11,
            preferCanvas: true
        });

        this.baseLayerNoLabels = createLocalBasemap(L, { labels: false });
        this.baseLayerLabels = createLocalBasemap(L, { labels: true });

        // Initialize with labels layer
        this.baseLayerLabels.addTo(this.map);

        this.heatLayer = L.heatLayer(crimeHeatData, {
            radius: 12,
            blur: 10,
            // maxZoom é reescrito a cada zoom (ver _applyZoomUniform) para
            // zerar o fator f = 1/2^(maxZoom - zoom) do leaflet.heat. Deixar
            // 17 fazia a intensidade variar 4x entre zoom 12 e 14.
            maxZoom: this.map.getZoom(),
            max: 1.0,
            gradient: fallbackScale().gradient,
        }).addTo(this.map);
        this._currentDatasetKey = 'mock:all';
        this._riskScale = null;
        this._kernelMeters = 110;
        this._loadSeq = 0;
        this._prefetchStarted = false;
        // Teto de intensidade. Zerar o fator f do leaflet.heat tira a
        // dependência de zoom, mas deixa pontos sobrepostos somarem acima de
        // 1.0 e saturarem tudo em vermelho. `max` é o clamp contra o qual a
        // soma do bucket é comparada, então é ele que controla a saturação.
        // Constante, logo não reintroduz dependência de zoom. Calibrado pela
        // distribuição de pixels do canvas.
        this._intensityMax = 1.7;
        // O loader já tem fallback interno para o mock, então o mapa é
        // capaz de servir dado real desde já. Sem isto, o efeito de filtros
        // roda antes da 1ª carga resolver e cai no ramo do mock.
        this._realDataLoaded = true;

        this.map.on('zoomend', this._applyZoomUniform, this);

        this.markerManager = new MarkerManager(this.map);
        this.markerManager.addAllMarkers();

        this.routeManager = new RouteManager(this.map);
        this.routeManager.prepareSafeRoutes();

        this.flowLayer = new FlowLayer(this.map);
        this.lightingLayer = new LightingLayer(this.map);

        this.contactsLayer = new ContactsLayer(this.map);
        this.contactsLayer.init();

        this.setupEvents();
    }

    getMap() { return this.map; }

    /**
     * Deixa o heatmap uniforme em todo o mapa e estável entre zooms.
     *
     * O leaflet.heat tem DUAS dependências de zoom que quebram a leitura:
     *
     *  1. `radius` é em pixels, então a área geográfica coberta por cada
     *     ponto muda com o zoom (dá zoom in, a mancha encolhe).
     *  2. `_redraw` multiplica o peso por f = 1/2^(maxZoom - zoom), então a
     *     INTENSIDADE muda com o zoom — era a maior das duas, e é o que
     *     fazia o mesmo lugar parecer couro e vermelho em níveis distintos.
     *
     * A correção é fixar as duas em espaço geográfico. O raio do kernel vem
     * da própria grade do KDE (célula de ~240 x 217 m), não de um chute, e o
     * `maxZoom` é reescrito para o zoom corrente, o que faz f = 1/2^0 = 1.
     */
    _applyZoomUniform() {
        const layer = this.heatLayer;
        if (!layer || !this.map) return;
        // A camada só ganha `_map` quando entra no Leaflet. Como o heatmap
        // inicia desligado, chamar redraw() fora do mapa estoura em
        // `_map._animating` e derrubava o load inteiro para o ramo do mock.
        const onMap = this.map.hasLayer(layer);

        const zoom = this.map.getZoom();
        const lat = this.map.getCenter().lat;
        const metersPerPixel =
            156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);

        // 110 m: menor que a célula de ~240 m da grade do KDE. Kernel maior que a
        // célula faz os pontos se tocarem e o canvas cobrir o mapa inteiro,
        // escondendo o basemap justamente nas zonas de baixo risco.
        const radius = this._kernelMeters / metersPerPixel;
        const clamped = Math.max(2.5, Math.min(56, radius));

        layer.options.maxZoom = zoom;   // zera f
        layer.options.radius = clamped;
        layer.options.blur = clamped * 0.8;
        if (onMap) {
            if (layer._heat) layer._updateOptions();
            layer.redraw();
        }
    }

    /**
     * Carrega o heatmap real gerado pelo pipeline Python e atualiza o layer.
     * Faz fallback silencioso no mock se o JSON não estiver disponível
     * (ex: rodando sem ter executado `python scripts/run_pipeline.py`).
     *
     * @param {string} crimeType  'all' | 'furto' | 'roubo' | 'outros'
     * @returns {Promise<{count:number, source:'real'|'mock'}>}
     */
    async loadRealHeatmap(crimeType = 'all', period = 'all') {
        const typeKey = HeatmapLoader.slicesAvailableFor(crimeType) ? crimeType : 'all';
        const periodKey = HeatmapLoader.periodsAvailableFor(period) ? period : 'all';
        const datasetKey = `real:${typeKey}:${periodKey}`;
        if (datasetKey === this._currentDatasetKey) {
            return { count: this.heatLayer._latlngs?.length ?? 0, source: 'real' };
        }
        // Token de sequência: no mount, init() dispara loadRealHeatmap('all')
        // e o efeito de filtros dispara outra carga ao mesmo tempo. Sem isso,
        // a que resolve por último sobrescreve a desejada e a fatia filtrada
        // nunca aparece. Só a requisição mais recente pode aplicar.
        const seq = ++this._loadSeq;

        try {
            const { points, count } = await this._heatmapLoader.loadPoints(typeKey, periodKey);
            if (seq !== this._loadSeq) return { count, source: 'stale' };

            // `setLatLngs` chama `redraw()`, que exige a camada no mapa. Fora
            // dela (heatmap desligado) escrevemos `_latlngs` direto: os dados
            // ficam prontos e o desenho acontece quando o usuário ligar.
            if (this.map.hasLayer(this.heatLayer)) this.heatLayer.setLatLngs(points);
            else this.heatLayer._latlngs = points;

            // Recalcula a escala por fatia: a distribuição de pesos muda
            // entre "tudo", só furto, só noite etc., e os cortes por quantil
            // acompanham essa mudança em vez de usar faixas fixas.
            const scale = computeRiskScale(points, this._intensityMax);
            if (scale) {
                this._riskScale = scale;
                // `setOptions` também dispara `redraw()`; ver comentário acima.
                if (this.map.hasLayer(this.heatLayer)) {
                    this.heatLayer.setOptions({
                        gradient: scale.gradient,
                        max: this._intensityMax,
                    });
                } else {
                    this.heatLayer.options.gradient = scale.gradient;
                    this.heatLayer.options.max = this._intensityMax;
                }
            }
            this._applyZoomUniform();

            this._realDataLoaded = true;
            this._currentDatasetKey = datasetKey;

            // Aquece as demais fatias uma vez, ocioso, para a troca de filtro
            // na aba STATS não virar um fetch na frente do usuário.
            if (!this._prefetchStarted) {
                this._prefetchStarted = true;
                this._heatmapLoader.prefetch();
            }

            document.dispatchEvent(new CustomEvent('heatmap:loaded', {
                detail: {
                    count, crimeType: typeKey, period: periodKey, source: 'real',
                    scale,
                },
            }));
            return { count, source: 'real', scale };
        } catch (err) {
            console.warn('[CrimeMap] Heatmap real indisponível, usando mock.', err);
            this.heatLayer.setLatLngs(crimeHeatData);
            this._currentDatasetKey = 'mock:all';
            this._riskScale = null;
            document.dispatchEvent(new CustomEvent('heatmap:loaded', {
                detail: { count: crimeHeatData.length, crimeType: 'all', source: 'mock', error: String(err) },
            }));
            return { count: crimeHeatData.length, source: 'mock' };
        }
    }

    applyFilters(filters) {
        this._activeFilters = filters;
        this._rebuildHeatmap(filters);
        this.markerManager.applyFilters(filters);
        if (this.flowLayer.isVisible()) {
            this.flowLayer.update(filters.period || 'all');
        }
    }

    _rebuildHeatmap(filters) {
        if (this._realDataLoaded) {
            const { types, period } = filters;
            const slicedSelection =
                types && types.length === 1 && HeatmapLoader.slicesAvailableFor(types[0])
                    ? types[0]
                    : 'all';
            const periodSel =
                period && HeatmapLoader.periodsAvailableFor(period) ? period : 'all';
            this.loadRealHeatmap(slicedSelection, periodSel);
            return;
        }

        const { types, period } = filters;
        const allTypes = ['furto', 'roubo', 'outros'];
        const activeTypes = (types && types.length > 0) ? types : allTypes;
        const filtered = crimesByType.filter(c => {
            const typeOk = activeTypes.includes(c.type);
            const periodOk = (!period || period === 'all') ? true : c.time === period;
            return typeOk && periodOk;
        });

        const heatData = filtered.length > 0
            ? filtered.map(c => [c.lat, c.lng, c.intensity])
            : crimeHeatData;

        this.heatLayer.setLatLngs(heatData);
    }

    showHeatmap(visible) {
        if (visible) {
            if (!this.map.hasLayer(this.heatLayer)) this.map.addLayer(this.heatLayer);
            if (!this.map.hasLayer(this.baseLayerNoLabels)) this.map.addLayer(this.baseLayerNoLabels);
            if (this.map.hasLayer(this.baseLayerLabels)) this.map.removeLayer(this.baseLayerLabels);
            this._applyZoomUniform();
        } else {
            if (this.map.hasLayer(this.heatLayer)) this.map.removeLayer(this.heatLayer);
            if (!this.map.hasLayer(this.baseLayerLabels)) this.map.addLayer(this.baseLayerLabels);
            if (this.map.hasLayer(this.baseLayerNoLabels)) this.map.removeLayer(this.baseLayerNoLabels);
        }
    }

    updateCustomPoints(blockedSafePoints, customSafePoints, customRiskAreas) {
        // Pass to marker manager
        if (this.markerManager) {
            this.markerManager.updateCustomSafePoints(blockedSafePoints, customSafePoints);
        }

        // Handle custom risk areas
        if (!this.customRiskLayer) {
            this.customRiskLayer = L.layerGroup().addTo(this.map);
        }
        this.customRiskLayer.clearLayers();

        customRiskAreas.forEach(area => {
            const circle = L.circle([area.lat, area.lng], {
                color: '#FF0000',
                fillColor: '#FF0000',
                fillOpacity: 0.3,
                radius: 150 // fixed radius for now
            });
            circle.bindPopup(`
                <div class="popup-inner">
                    <div class="popup-type">
                        <span class="dot danger"></span>
                        ÁREA DE RISCO
                    </div>
                    <div class="popup-title">◎ ${area.name}</div>
                    <div class="popup-desc">Bloqueio Ativo pelo Usuário</div>
                </div>
            `, { maxWidth: 240 });
            this.customRiskLayer.addLayer(circle);
        });
    }

    setupEvents() {
        this.map.on('mousemove', (e) => {
            const lat = e.latlng.lat.toFixed(4);
            const lng = e.latlng.lng.toFixed(4);
            const latEl = document.getElementById('lat-display');
            const lngEl = document.getElementById('lng-display');
            const coordEl = document.getElementById('coords-display');
            if (latEl) latEl.textContent = lat;
            if (lngEl) lngEl.textContent = lng;
            if (coordEl) coordEl.textContent = `${lat} | ${lng}`;
        });

        this.map.on('zoomend', () => {
            const zoomEl = document.getElementById('zoom-display');
            if (zoomEl) zoomEl.textContent = `Z:${this.map.getZoom()}`;
        });

        this.map.on('moveend', () => {
            const center = this.map.getCenter();
            this.updateRegionName(center.lat, center.lng);
            document.dispatchEvent(new CustomEvent('map:moved', {
                detail: { lat: center.lat, lng: center.lng, bounds: this.map.getBounds() }
            }));
        });

        this.updateRegionName(SP_CENTER[0], SP_CENTER[1]);
    }

    updateThreatBadge(level) {
        const badge = document.getElementById('threat-badge');
        const text = document.getElementById('threat-level');
        if (!badge || !text) return;
        badge.className = `threat-badge ${level}`;
        const labels = { low: 'BAIXO', medium: 'MÉDIO', high: 'ALTO', critical: 'CRÍTICO' };
        text.textContent = labels[level] || 'MÉDIO';
    }

    updateRegionName(lat, lng) {
        const sectors = [
            { name: 'Cracolândia / Luz',   lat: -23.534, lng: -46.637, r: 0.004 },
            { name: 'Estação da Luz',       lat: -23.5355, lng: -46.6345, r: 0.003 },
            { name: 'Santa Ifigênia',       lat: -23.539, lng: -46.638, r: 0.004 },
            { name: 'Praça da Sé',          lat: -23.5503, lng: -46.634, r: 0.004 },
            { name: 'República',            lat: -23.543, lng: -46.642, r: 0.005 },
            { name: 'Av. Paulista',         lat: -23.561, lng: -46.656, r: 0.005 },
            { name: 'Consolação',           lat: -23.552, lng: -46.660, r: 0.005 },
            { name: 'Liberdade',            lat: -23.558, lng: -46.635, r: 0.005 },
            { name: 'Bela Vista',           lat: -23.560, lng: -46.646, r: 0.005 },
            { name: 'Pinheiros',            lat: -23.567, lng: -46.692, r: 0.006 },
            { name: 'Vila Madalena',        lat: -23.553, lng: -46.691, r: 0.005 },
            { name: 'Brás',                 lat: -23.543, lng: -46.616, r: 0.005 },
            { name: 'Mooca',                lat: -23.557, lng: -46.602, r: 0.006 },
            { name: 'Anhangabaú',           lat: -23.546, lng: -46.638, r: 0.004 },
        ];

        let closest = 'Centro SP';
        let minDist = Infinity;
        sectors.forEach(s => {
            const dist = Math.sqrt(Math.pow(s.lat - lat, 2) + Math.pow(s.lng - lng, 2));
            if (dist < s.r && dist < minDist) {
                minDist = dist;
                closest = s.name;
            }
        });

        const el = document.getElementById('region-display');
        if (el) el.textContent = closest;
    }
}