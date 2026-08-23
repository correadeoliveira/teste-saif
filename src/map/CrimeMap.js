import { SP_CENTER, DEFAULT_ZOOM, crimeHeatData, crimesByType } from '../data/MockData.js';
import { heatmapLoader, HeatmapLoader } from '../data/HeatmapLoader.js';
import { RouteManager } from './RouteManager.js';
import { MarkerManager } from './MarkerManager.js';
import { FlowLayer } from './FlowLayer.js';
import { LightingLayer } from './LightingLayer.js';

export class CrimeMap {
    constructor() {
        this.map = null;
        this.heatLayer = null;
        this.routeManager = null;
        this.markerManager = null;
        this.flowLayer = null;
        this.lightingLayer = null;
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

        this.baseLayerNoLabels = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
            subdomains: 'abcd',
            maxZoom: 19,
        });

        this.baseLayerLabels = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            subdomains: 'abcd',
            maxZoom: 19,
        });

        // Initialize with labels layer
        this.baseLayerLabels.addTo(this.map);

        this.heatLayer = L.heatLayer(crimeHeatData, {
            radius: 30,
            blur: 25,
            maxZoom: 17,
            max: 1.0,
            gradient: {
                0.0: 'rgba(0, 255, 159, 0.0)',
                0.2: 'rgba(0, 255, 159, 0.15)',
                0.4: 'rgba(0, 230, 100, 0.35)',
                0.6: 'rgba(0, 200, 80, 0.55)',
                0.8: 'rgba(57, 255, 20, 0.75)',
                1.0: 'rgba(57, 255, 20, 0.90)',
            },
        }).addTo(this.map);
        this._currentDatasetKey = 'mock:all';

        this.markerManager = new MarkerManager(this.map);
        this.markerManager.addAllMarkers();

        this.routeManager = new RouteManager(this.map);
        this.routeManager.prepareSafeRoutes();

        this.flowLayer = new FlowLayer(this.map);
        this.lightingLayer = new LightingLayer(this.map);

        this.setupEvents();
    }

    getMap() { return this.map; }

    /**
     * Carrega o heatmap real gerado pelo pipeline Python e atualiza o layer.
     * Faz fallback silencioso no mock se o JSON não estiver disponível
     * (ex: rodando sem ter executado `python scripts/run_pipeline.py`).
     *
     * @param {string} crimeType  'all' | 'furto' | 'roubo' | 'outros'
     * @returns {Promise<{count:number, source:'real'|'mock'}>}
     */
    async loadRealHeatmap(crimeType = 'all') {
        const datasetKey = `real:${HeatmapLoader.slicesAvailableFor(crimeType) ? crimeType : 'all'}`;
        if (datasetKey === this._currentDatasetKey) {
            return { count: this.heatLayer._latlngs?.length ?? 0, source: 'real' };
        }
        try {
            const { points, count } = await this._heatmapLoader.loadPoints(crimeType);
            this.heatLayer.setLatLngs(points);
            this._realDataLoaded = true;
            this._currentDatasetKey = datasetKey;
            document.dispatchEvent(new CustomEvent('heatmap:loaded', {
                detail: { count, crimeType, source: 'real' },
            }));
            return { count, source: 'real' };
        } catch (err) {
            console.warn('[CrimeMap] Heatmap real indisponível, usando mock.', err);
            this.heatLayer.setLatLngs(crimeHeatData);
            this._currentDatasetKey = 'mock:all';
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
            const { types } = filters;
            // Se o usuário marcou exatamente UM tipo que temos fatiado, troca dataset.
            // Para combinações (ou tipos sem fatia: assalto/agressao/trafico), mantém 'all'.
            const slicedSelection =
                types && types.length === 1 && HeatmapLoader.slicesAvailableFor(types[0])
                    ? types[0]
                    : 'all';
            this.loadRealHeatmap(slicedSelection);
            return;
        }

        const { types, period } = filters;
        const allTypes = ['furto', 'roubo', 'assalto', 'agressao', 'trafico'];
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
