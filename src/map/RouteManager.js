import { safeRoutes } from '../data/MockData.js';

export class RouteManager {
    constructor(map) {
        this.map = map;
        this._routeGroup = L.layerGroup();
        this._visible = false;
    }

    prepareSafeRoutes() {
        const renderer = L.svg();
        safeRoutes.forEach(route => {
            // Glow track (fundo)
            const bgLine = L.polyline(route.coords, {
                color: route.color,
                weight: 10,
                opacity: 0.08,
                interactive: false,
                lineCap: 'round',
                lineJoin: 'round',
                renderer,
            });

            // Linha principal tracejada
            const mainLine = L.polyline(route.coords, {
                color: route.color,
                weight: 2,
                opacity: 0.85,
                lineCap: 'round',
                lineJoin: 'round',
                dashArray: '8, 12',
                renderer,
                className: 'saifen-demo-route',
                bubblingMouseEvents: false,
            });

            const popup = `<div class="popup-inner">
                <div class="popup-type"><span class="dot safe"></span>ROTA SIMULADA</div>
                <div class="popup-title">→ ${route.name}</div>
                <div class="popup-desc">${route.desc}</div>
            </div>`;

            mainLine.bindPopup(popup, { maxWidth: 280 });

            this._routeGroup.addLayer(bgLine);
            this._routeGroup.addLayer(mainLine);
        });
    }

    show(alertSystem) {
        if (this._visible) return;
        this._visible = true;
        this._routeGroup.addTo(this.map);
        if (alertSystem) alertSystem.showToast('Rotas simuladas ativadas', 'success');
    }

    hide(alertSystem) {
        if (!this._visible) return;
        this._visible = false;
        this.map.removeLayer(this._routeGroup);
        if (alertSystem) alertSystem.showToast('Rotas simuladas desativadas', 'info');
    }

    toggle(alertSystem) {
        if (this._visible) {
            this.hide(alertSystem);
        } else {
            this.show(alertSystem);
        }
    }

    isVisible() { return this._visible; }
}
