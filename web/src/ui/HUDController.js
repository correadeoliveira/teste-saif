export class HUDController {
    constructor(alertSystem, layerManager, filterSystem) {
        this.alertSystem = alertSystem;
        this.layerManager = layerManager;
        this.filterSystem = filterSystem;
    }

    init() {
        this._initClock();
        this._initSidePanel();
        this._initLayerManager();
    }

    _initClock() {
        const tick = () => {
            const now = new Date();
            const h = String(now.getHours()).padStart(2, '0');
            const m = String(now.getMinutes()).padStart(2, '0');
            const s = String(now.getSeconds()).padStart(2, '0');
            const el = document.getElementById('clock');
            if (el) el.textContent = `${h}:${m}:${s}`;
        };
        tick();
        setInterval(tick, 1000);
    }

    _initSidePanel() {
        const panel = document.getElementById('side-panel');
        const toggle = document.getElementById('panel-toggle');
        const mobileBtn = document.getElementById('mobile-panel-btn');
        const fab = document.getElementById('mobile-panel-fab');

        if (toggle) {
            toggle.addEventListener('click', () => {
                panel.classList.toggle('collapsed');
                toggle.textContent = panel.classList.contains('collapsed') ? '▶' : '◀';
            });
        }

        const openMobile = () => {
            panel.classList.toggle('open-mobile');
            panel.classList.toggle('collapsed');
        };

        if (mobileBtn) mobileBtn.addEventListener('click', openMobile);
        if (fab) fab.addEventListener('click', openMobile);

        // Fechar painel ao clicar no mapa (mobile)
        const mapEl = document.getElementById('map');
        if (mapEl) {
            mapEl.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    panel.classList.remove('open-mobile');
                    panel.classList.add('collapsed');
                }
            });
        }
    }

    _initLayerManager() {
        if (!this.layerManager) return;
        this.layerManager.init();
    }
}
