import { logHeatmap } from '../../shared/web/telemetry.js';
import L, { CanvasHeatLayer } from './leafletSetup.js';
import { SP_CENTER, DEFAULT_ZOOM, crimeHeatData, crimesByType } from '../data/MockData.js';
import { heatmapLoader, HeatmapLoader } from '../data/HeatmapLoader.js';
import { RouteManager } from './RouteManager.js';
import { MarkerManager } from './MarkerManager.js';
import { FlowLayer } from './FlowLayer.js';
import { LightingLayer } from './LightingLayer.js';
import { ContactsLayer } from './ContactsLayer.js';
import { AlertLayer } from './AlertLayer.js';
import { createLocalBasemap } from './LocalBasemap.js';
import { computeRiskScale, fallbackScale, gradientToTexture, applyGradientTexture } from './riskScale.js';

const INSPECTION_RADIUS_M = 500;
const weightFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

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

        // Heatmap em WebGL (leaflet-webgl-heatmap), com fallback Canvas 2D.
        //
        // O canvas 2D custava três coisas que aqui viram nativas ou somem:
        //  - `size` em METROS: o kernel tem tamanho geográfico, então o heat
        //    não muda mais entre zooms sem nenhum ajuste manual.
        //  - `alphaRange`: resolve a opacidade total. O shader aplica
        //    smoothstep(0, alphaRange, intensidade), então valores baixos
        //    deixam a faixa de baixo risco quase transparente e o basemap
        //    aparece por baixo.
        //  - WebGL: nada de redesenhar um canvas 2D inteiro a cada arrasto.
        this.heatLayer = L.webGLHeatmap({
            // Diâmetro do splat, em metros. Maior que a célula da grade do KDE
            // (~240 m) de propósito: com splats menores que a célula, cada
            // amostra aparece como um disco isolado e o campo fica granulado.
            // Maiores se sobrepõem num campo contínuo, e é a curva de alfa que
            // mantém as bordas leves em vez de cobrir o mapa inteiro.
            size: 340,
            units: 'm',
            // `opacity` multiplica o canvas inteiro, então reduz todas as
            // faixas de uma vez — foi o que apagou a faixa BAIXO quando caiu
            // sozinho para 0.45. `alphaRange` é o que achata a rampa de alfa
            // (smoothstep(0, alphaRange, intensidade)) e devolve peso às
            // bordas sem precisar engrossar as faixas de cima.
            //
            // Os dois andam juntos: 0.10/0.70 cobre o mapa inteiro e produz
            // banding verde do blending aditivo; 0.22/0.45 some com o BAIXO.
            // 0.20/0.60 mantém as quatro faixas visíveis com o basemap
            // legível por baixo.
            opacity: 0.6,
            alphaRange: 0.2,
            gradientTexture: gradientToTexture(fallbackScale().gradient),
            padding: 0.02,
        }).addTo(this.map);
        this._usesCanvas = !this.heatLayer.gl?.gl;
        if (this._usesCanvas) {
            this.map.removeLayer(this.heatLayer);
            this.heatLayer = new CanvasHeatLayer([], { radius: 26, blur: 22, maxZoom: 14 });
        }
        this._heatmapData = null;
        this._currentDatasetKey = 'mock:all';
        this._riskScale = null;
        this._loadSeq = 0;
        this._prefetchStarted = false;
        // Ganho de intensidade, medido contra a distribuição de pixels na tela.
        // Abaixo de ~0.4 o vermelho some; muito acima, a cidade inteira satura.
        this._intensityGain = 0.16;
        this._intensityMax = 1;
        this.markerManager = new MarkerManager(this.map);
        this.markerManager.addAllMarkers();

        this.routeManager = new RouteManager(this.map);
        this.routeManager.prepareSafeRoutes();

        this.flowLayer = new FlowLayer(this.map);
        this.lightingLayer = new LightingLayer(this.map);

        this.contactsLayer = new ContactsLayer(this.map);
        this.contactsLayer.init();

        this.alertLayer = new AlertLayer(this.map);
        this.alertLayer.init();

        this.setupEvents();
    }

    getMap() { return this.map; }

    destroy() {
        this._loadSeq++;
        this.alertLayer?.destroy();
        this.alertLayer = null;
        this.map?.remove();
        this.map = null;
    }

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

            const scale = computeRiskScale(points, this._intensityMax);
            this._riskScale = scale;
            this._setHeatmapData(points, scale?.gradient ?? fallbackScale().gradient);

            this._currentDatasetKey = `real:${crimeType}:${period}`;

            // Aquece as demais fatias uma vez, ocioso, para a troca de filtro
            // na aba STATS não virar um fetch na frente do usuário.
            if (!this._prefetchStarted) {
                this._prefetchStarted = true;
                this._heatmapLoader.prefetch();
            }

            this._heatmapResult = { count, crimeType, period, source: 'real', scale };
            this._refreshInspection();
            logHeatmap('static', count, performance.now() - started, crimeType !== typeKey || period !== periodKey);
            document.dispatchEvent(new CustomEvent('heatmap:loaded', { detail: this._heatmapResult }));
            return this._heatmapResult;
        } catch {
            if (seq !== this._loadSeq) return { count: 0, source: 'stale' };
            const points = this._mockHeatData(this._activeFilters);
            this._setHeatmapData(points, fallbackScale().gradient);
            this._currentDatasetKey = 'mock:all';
            this._riskScale = null;
            const detail = { count: points.length, crimeType: 'all', period: 'all', source: 'mock' };
            this._heatmapResult = detail;
            this._refreshInspection();
            logHeatmap('demo', detail.count, performance.now() - started, true);
            document.dispatchEvent(new CustomEvent('heatmap:loaded', { detail }));
            return detail;
        }
    }

    _setHeatmapData(points, gradient) {
        this._heatmapData = { points, gradient };
        if (this._usesCanvas) {
            if (this.map.hasLayer(this.heatLayer)) this._drawCanvasHeatmap();
            return;
        }
        this.heatLayer.setData(points);
        if (this._intensityGain !== 1) this.heatLayer.multiply(this._intensityGain);
        applyGradientTexture(this.heatLayer, gradientToTexture(gradient));
    }

    _drawCanvasHeatmap() {
        if (!this._heatmapData) return;
        const { points, gradient } = this._heatmapData;
        this.heatLayer.setOptions({ gradient });
        this.heatLayer.setLatLngs(points);
    }

    _refreshInspection() {
        if (this._inspectionPopup?.isOpen()) this._inspectPoint(this._inspectionPopup.getLatLng());
    }

    _inspectPoint(latlng) {
        const content = document.createElement('div');
        const title = document.createElement('div');
        const detail = document.createElement('div');
        title.className = 'popup-title';
        detail.className = 'popup-desc';
        const result = this._heatmapResult;
        title.textContent = result?.source === 'real' ? 'Fatia SSP-SP' :
            result?.source === 'mock' ? 'Fatia de demonstração' : 'Camada de calor';

        let nearest = null;
        let distance = INSPECTION_RADIUS_M;
        for (const [lat, lng, weight] of this._heatmapData?.points ?? []) {
            const candidate = this.map.distance(latlng, [lat, lng]);
            if (candidate > distance) continue;
            nearest = weight;
            distance = candidate;
        }
        const slice = result && [result.crimeType, result.period]
            .filter((value) => value !== 'all').join(' · ');
        if (slice) title.textContent += ` · ${slice}`;
        detail.textContent = !result ? 'Carregando a fatia de calor.' : nearest === null
            ? `Sem amostra da fatia em até ${INSPECTION_RADIUS_M} m.`
            : `Peso relativo ${weightFormat.format(nearest)} · amostra a ${Math.round(distance)} m`;
        content.append(title, detail);
        this._inspectionPopup ??= L.popup({ maxWidth: 256 });
        this._inspectionPopup.setLatLng(latlng).setContent(content).openOn(this.map);
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
            if (!this.map.hasLayer(this.heatLayer)) {
                this.map.addLayer(this.heatLayer);
                if (this._usesCanvas) this._drawCanvasHeatmap();
            }
            if (!this.map.hasLayer(this.baseLayerNoLabels)) this.map.addLayer(this.baseLayerNoLabels);
            if (this.map.hasLayer(this.baseLayerLabels)) this.map.removeLayer(this.baseLayerLabels);
        } else {
            if (this.map.hasLayer(this.heatLayer)) this.map.removeLayer(this.heatLayer);
            this._inspectionPopup?.remove();
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
        this.map.on('click', ({ latlng }) => {
            if (this.map.hasLayer(this.heatLayer)) this._inspectPoint(latlng);
        });

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

        const publishPosition = () => {
            const center = this.map.getCenter();
            const region = this.updateRegionName(center.lat, center.lng);
            document.dispatchEvent(new CustomEvent('map:moved', {
                detail: { lat: center.lat, lng: center.lng, bounds: this.map.getBounds(), region }
            }));
        };
        this.map.on('moveend', publishPosition);
        publishPosition();
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
        return closest;
    }
}
