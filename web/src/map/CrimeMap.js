import { logHeatmap } from '../../../shared/web/telemetry.js';
import { SP_CENTER, DEFAULT_ZOOM, crimeHeatData, crimesByType } from '../data/MockData.js';
import { heatmapLoader, HeatmapLoader } from '../data/HeatmapLoader.js';
import { RouteManager } from './RouteManager.js';
import { MarkerManager } from './MarkerManager.js';
import { FlowLayer } from './FlowLayer.js';
import { LightingLayer } from './LightingLayer.js';
import { createLocalBasemap } from './LocalBasemap.js';

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
        this._currentDatasetKey = null;
        this._loadSeq = 0;
    }

    init() {
        this.map = L.map('map', {
            center: SP_CENTER,
            zoom: DEFAULT_ZOOM,
            zoomControl: true,
            attributionControl: false,
            maxZoom: 18,
            minZoom: 11,
        });

        createLocalBasemap(L, { labels: false }).addTo(this.map);

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
    async loadRealHeatmap(requestedType = 'all', requestedPeriod = 'all') {
        const typeKey = HeatmapLoader.slicesAvailableFor(requestedType) ? requestedType : 'all';
        const periodKey = HeatmapLoader.periodsAvailableFor(requestedPeriod) ? requestedPeriod : 'all';
        const datasetKey = `real:${typeKey}:${periodKey}`;
        const seq = ++this._loadSeq;
        if (datasetKey === this._currentDatasetKey) return this._heatmapResult;
        const started = performance.now();
        try {
            const { points, count, crimeType, period } = await this._heatmapLoader.loadPoints(typeKey, periodKey);
            if (seq !== this._loadSeq) return { count, source: 'stale' };
            this.heatLayer.setLatLngs(points);
            this._currentDatasetKey = `real:${crimeType}:${period}`;
            this._heatmapResult = { count, crimeType, period, source: 'real' };
            logHeatmap('static', count, performance.now() - started, crimeType !== typeKey || period !== periodKey);
            document.dispatchEvent(new CustomEvent('heatmap:loaded', { detail: this._heatmapResult }));
            return this._heatmapResult;
        } catch {
            if (seq !== this._loadSeq) return { count: 0, source: 'stale' };
            const points = this._mockHeatData(this._activeFilters);
            this.heatLayer.setLatLngs(points);
            this._currentDatasetKey = 'mock:all';

            const detail = { count: points.length, crimeType: 'all', period: 'all', source: 'mock' };
            this._heatmapResult = detail;
            logHeatmap('demo', detail.count, performance.now() - started, true);
            document.dispatchEvent(new CustomEvent('heatmap:loaded', { detail }));
            return detail;
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
        const { types, period } = filters;
        const type = types?.length === 1 ? types[0] : 'all';
        void this.loadRealHeatmap(type, period);
    }

    _mockHeatData(filters) {
        const { types, period } = filters;
        const allTypes = ['furto', 'roubo', 'outros'];
        const activeTypes = (types && types.length > 0) ? types : allTypes;
        const filtered = crimesByType.filter(c => {
            const typeOk = activeTypes.includes(c.type);
            const periodOk = (!period || period === 'all') ? true : c.time === period;
            return typeOk && periodOk;
        });

        return filtered.length > 0
            ? filtered.map(c => [c.lat, c.lng, c.intensity])
            : crimeHeatData;
    }

    showHeatmap(visible) {
        if (visible) {
            this.heatLayer.addTo(this.map);
        } else {
            this.map.removeLayer(this.heatLayer);
        }
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
