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

    async _initCoreSystems() {
        // 1. Mapa
        this.crimeMap = new CrimeMap();
        this.crimeMap.init();

        // 1b. Heatmap real do pipeline Python (fallback silencioso no mock).
        // Não bloqueia o boot — carrega em paralelo aos próximos sistemas.
        const heatmapPromise = this.crimeMap.loadRealHeatmap('all');
        const summaryPromise = heatmapLoader.loadSummary().catch(() => null);

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

        // 10. Quando o heatmap real terminar de carregar, atualiza HUD com
        //     contadores oficiais (vindos de output/summary.json).
        const [heatResult, summary] = await Promise.all([heatmapPromise, summaryPromise]);
        this._renderDataSourceInfo(heatResult, summary);
    }

    _renderDataSourceInfo(heatResult, summary) {
        const ctx = document.getElementById('context-text');
        if (!ctx) return;

        if (heatResult.source === 'real' && summary) {
            const total = summary.total_incidents?.toLocaleString('pt-BR') ?? heatResult.count;
            const types = summary.by_crime_type || {};
            const furto = (types.furto || 0).toLocaleString('pt-BR');
            const roubo = (types.roubo || 0).toLocaleString('pt-BR');
            const dateMax = summary.date_range?.max?.slice(0, 10) || '';
            ctx.textContent = `SSP-SP · ${total} BOs de subtração de celular (furto: ${furto} | roubo: ${roubo})${dateMax ? ` · até ${dateMax}` : ''}`;
            this.alertSystem?.showToast?.(`Dataset real carregado: ${total} ocorrências`, 'success');
        } else if (heatResult.source === 'real') {
            ctx.textContent = `Heatmap real carregado · ${heatResult.count.toLocaleString('pt-BR')} pontos KDE`;
        } else {
            ctx.textContent = 'Dataset real indisponível — exibindo simulação local';
            console.info(
                'Para carregar dados reais:\n' +
                '  python scripts/run_pipeline.py\n' +
                '  python3 -m http.server 8000'
            );
        }
    }
}
