import { safeRoutes } from '../data/MockData.js';

export class RouteManager {
    constructor(map) {
        this.map = map;
        this.safeRouteLayers = [];
        this.routesVisible = false;
    }

    prepareSafeRoutes() {
        safeRoutes.forEach(route => {
            const bgLine = L.polyline(route.coords, {
                color: route.color,
                weight: 8,
                opacity: 0.15,
                lineCap: 'round',
                lineJoin: 'round',
                dashArray: null,
            });

            const mainLine = L.polyline(route.coords, {
                color: route.color,
                weight: 3,
                opacity: 0.8,
                lineCap: 'round',
                lineJoin: 'round',
                dashArray: '8, 12',
            });

            mainLine.bindPopup(`
                <div class="popup-inner">
                    <div class="popup-type"><span class="dot safe"></span>ROTA SEGURA</div>
                    <div class="popup-title">⬡ ${route.name}</div>
                    <div class="popup-desc">${route.desc}</div>
                </div>
            `, { maxWidth: 280 });

            this.safeRouteLayers.push({ bg: bgLine, main: mainLine });
        });
    }

    toggleSafeRoutes(alertSystem) {
        this.routesVisible = !this.routesVisible;
        const btn = document.getElementById('btn-routes');

        if (this.routesVisible) {
            this.safeRouteLayers.forEach(layer => {
                layer.bg.addTo(this.map);
                layer.main.addTo(this.map);
            });
            btn.classList.add('active');
            alertSystem.showToast('Rotas seguras ativadas — 3 rotas disponíveis', 'success');
        } else {
            this.safeRouteLayers.forEach(layer => {
                this.map.removeLayer(layer.bg);
                this.map.removeLayer(layer.main);
            });
            btn.classList.remove('active');
            alertSystem.showToast('Rotas seguras desativadas', 'info');
        }
    }
}
