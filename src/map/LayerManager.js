export class LayerManager {
    constructor(crimeMap, alertSystem) {
        this.crimeMap = crimeMap;
        this.alertSystem = alertSystem;
        this._state = {
            heatmap:    true,
            safepoints: true,
            flow:       false,
            lighting:   false,
            transport:  true,
            routes:     false,
        };
    }

    init() {
        const toggles = document.querySelectorAll('[data-layer]');
        toggles.forEach(el => {
            const layerId = el.dataset.layer;
            // Sincronizar estado visual inicial
            if (this._state[layerId]) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }

            el.addEventListener('click', () => this.toggle(layerId));
        });
    }

    toggle(layerId) {
        const newState = !this._state[layerId];
        this._state[layerId] = newState;

        // Atualizar visual do toggle
        const toggleEl = document.querySelector(`[data-layer="${layerId}"]`);
        if (toggleEl) {
            toggleEl.classList.toggle('active', newState);
        }

        // Aplicar na camada correspondente
        this._applyLayer(layerId, newState);
    }

    _applyLayer(layerId, visible) {
        const map = this.crimeMap;
        const cm = map.markerManager;
        const as = this.alertSystem;

        switch (layerId) {
            case 'heatmap':
                map.showHeatmap(visible);
                break;
            case 'safepoints':
                cm.showSafePoints(visible);
                break;
            case 'flow': {
                const filters = document.getElementById('filter-period');
                const period = filters ? filters.value : 'all';
                if (visible) {
                    map.flowLayer.show(period);
                } else {
                    map.flowLayer.hide();
                }
                break;
            }
            case 'lighting':
                if (visible) {
                    map.lightingLayer.show();
                } else {
                    map.lightingLayer.hide();
                }
                break;
            case 'transport':
                cm.showTransport(visible);
                break;
            case 'routes':
                if (visible) {
                    map.routeManager.show(as);
                } else {
                    map.routeManager.hide(as);
                }
                break;
        }
    }

    isVisible(layerId) { return !!this._state[layerId]; }
}
