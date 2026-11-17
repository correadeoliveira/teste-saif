import { BootScreen } from '../ui/BootScreen.js';
import { AlertSystem } from '../ui/AlertSystem.js';
import { HUDController } from '../ui/HUDController.js';
import { CrimeMap } from '../map/CrimeMap.js';
import { FilterSystem } from '../ui/FilterSystem.js';
import { LayerManager } from '../map/LayerManager.js';
import { RiskAnalyzer } from '../ui/RiskAnalyzer.js';
import { SP_CENTER } from '../data/MockData.js';
import { heatmapLoader } from '../data/HeatmapLoader.js';

export class App {
    constructor() {
        this.bootScreen  = null;
        this.crimeMap    = null;
        this.filterSystem = null;
        this.layerManager = null;
        this.riskAnalyzer = null;
        this.alertSystem  = null;
        this.hudController = null;
    }

    start() {
        this.bootScreen = new BootScreen(() => this._initCoreSystems());
        this.bootScreen.run();
    }

    _initCoreSystems() {
        // 1. Mapa
        this.crimeMap = new CrimeMap();
        this.crimeMap.init();

        let summary = null;
        let latest;
        document.addEventListener('heatmap:loaded', ({ detail }) => {
            latest = detail;
            this._renderDataSourceInfo(detail, summary);
        });
        heatmapLoader.loadSummary().then((data) => {
            summary = data;
            if (latest?.source === 'real') this._renderDataSourceInfo(latest, summary);
        }).catch(() => {});
        void this.crimeMap.loadRealHeatmap();

        // 2. Filtros
        this.filterSystem = new FilterSystem();
        this.filterSystem.init();

        // 3. Alert System (necessário antes do LayerManager)
        this.alertSystem = new AlertSystem();
        this.alertSystem.init();

        // 4. Layer Manager
        this.layerManager = new LayerManager(this.crimeMap, this.alertSystem);

        // 5. Risk Analyzer
        this.riskAnalyzer = new RiskAnalyzer(this.crimeMap);

        // 6. HUD Controller
        this.hudController = new HUDController(
            this.alertSystem,
            this.layerManager,
            this.filterSystem
        );
        this.hudController.init();

        // 7. Análise inicial
        this.riskAnalyzer.analyze(SP_CENTER[0], SP_CENTER[1], this.filterSystem.getActiveFilters());

        // 8. Wiring: filtros → mapa + analisador
        document.addEventListener('filters:changed', (e) => {
            const filters = e.detail;
            this.crimeMap.applyFilters(filters);
            const center = this.crimeMap.getMap().getCenter();
            this.riskAnalyzer.analyze(center.lat, center.lng, filters);

            // Auto-ativar camada de iluminação quando noite/madrugada
            if (filters.period === 'noite' || filters.period === 'madrugada') {
                if (!this.layerManager.isVisible('lighting')) {
                    this.layerManager.toggle('lighting');
                    this.alertSystem.showToast('Camada de iluminação ativada automaticamente', 'info');
                }
            }

            // Atualizar fluxo se camada estiver visível
            if (this.layerManager.isVisible('flow')) {
                this.crimeMap.flowLayer.update(filters.period || 'all');
            }
        });

        // 9. Wiring: movimento do mapa → analisador de risco
        document.addEventListener('map:moved', (e) => {
            const { lat, lng } = e.detail;
            this.riskAnalyzer.analyze(lat, lng, this.filterSystem.getActiveFilters());
        });
    }

    _renderDataSourceInfo(heatResult, summary) {
        const ctx = document.getElementById('context-text');
        if (!ctx || heatResult.source === 'stale') return;
        ctx.dataset.heatmapSource = heatResult.source;
        const type = heatResult.crimeType === 'all' ? 'todos os tipos' : heatResult.crimeType;
        const period = heatResult.period === 'all' ? 'todos os períodos' : heatResult.period;
        const slice = `${type} · ${period}`;

        if (heatResult.source === 'real' && summary) {
            const total = summary.total_incidents?.toLocaleString('pt-BR') ?? heatResult.count;
            const types = summary.by_crime_type || {};
            const furto = (types.furto || 0).toLocaleString('pt-BR');
            const roubo = (types.roubo || 0).toLocaleString('pt-BR');
            const dateMax = summary.date_range?.max?.slice(0, 10) || '';
            ctx.textContent = `SSP-SP · ${slice} · base total: ${total} BOs georreferenciados (furto: ${furto} | roubo: ${roubo})${dateMax ? ` · até ${dateMax}` : ''} · incidência observada, não RES 160`;
        } else if (heatResult.source === 'real') {
            ctx.textContent = `SSP-SP · ${slice} · ${heatResult.count.toLocaleString('pt-BR')} pontos KDE`;
        } else {
            ctx.textContent = 'Dataset real indisponível — exibindo simulação local';
        }
    }
}
