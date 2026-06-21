import { pointsOfInterest } from '../data/MockData.js';

export class MarkerManager {
    constructor(map) {
        this.map = map;
    }

    getMarkerClass(poi) {
        switch (poi.type) {
            case 'metro': return poi.risk === 'critical' ? 'marker-danger' : poi.risk === 'high' ? 'marker-warning' : poi.risk === 'medium' ? 'marker-info' : 'marker-safe';
            case 'bus': return poi.risk === 'critical' ? 'marker-danger' : poi.risk === 'high' ? 'marker-warning' : poi.risk === 'low' ? 'marker-safe' : 'marker-info';
            case 'police':
            case 'commerce24h': return 'marker-escape';
            case 'camera': return 'marker-info';
            case 'danger_zone': return 'marker-danger';
            case 'alert_point': return 'marker-warning';
            default: return 'marker-info';
        }
    }

    getMarkerSize(poi) {
        if (poi.type === 'danger_zone') return 28;
        if (poi.type === 'metro') return 24;
        if (poi.type === 'police') return 22;
        return 20;
    }

    getRiskLabel(risk) {
        switch (risk) {
            case 'critical': return 'CRÍTICO';
            case 'high': return 'ALTO';
            case 'medium': return 'MÉDIO';
            case 'low': return 'BAIXO';
            default: return risk.toUpperCase();
        }
    }

    getRiskDot(risk) {
        switch (risk) {
            case 'critical':
            case 'high': return 'danger';
            case 'medium': return 'warning';
            case 'low': return 'safe';
            default: return 'info';
        }
    }

    getRiskPercent(risk) {
        switch (risk) {
            case 'critical': return 95;
            case 'high': return 75;
            case 'medium': return 45;
            case 'low': return 15;
            default: return 50;
        }
    }

    getRiskBarClass(risk) {
        switch (risk) {
            case 'critical':
            case 'high': return 'danger';
            case 'medium': return 'warning';
            case 'low': return 'safe';
            default: return 'warning';
        }
    }

    getTypeLabel(type) {
        switch (type) {
            case 'metro': return 'ESTAÇÃO DE METRÔ';
            case 'bus': return 'PARADA DE ÔNIBUS';
            case 'police': return 'POSTO POLICIAL';
            case 'camera': return 'CÂMERA DE MONITORAMENTO';
            case 'commerce24h': return 'COMÉRCIO 24H — PONTO ALIADO';
            case 'danger_zone': return 'ZONA DE PERIGO';
            case 'alert_point': return 'PONTO DE ALERTA';
            default: return type.toUpperCase();
        }
    }

    buildPopupHTML(poi) {
        let alertsHTML = '';
        if (poi.alerts && poi.alerts.length > 0) {
            alertsHTML = `<div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(0,229,255,0.08);">
                ${poi.alerts.map(a => `<div style="font-size:0.65rem;color:#ffa500;margin:3px 0;">⚡ ${a}</div>`).join('')}
            </div>`;
        }

        return `
            <div class="popup-inner">
                <div class="popup-type">
                    <span class="dot ${this.getRiskDot(poi.risk)}"></span>
                    ${this.getTypeLabel(poi.type)}
                </div>
                <div class="popup-title">${poi.icon} ${poi.name}</div>
                <div class="popup-desc">${poi.desc}</div>
                <div class="popup-risk-bar">
                    <div class="fill ${this.getRiskBarClass(poi.risk)}" style="width:${this.getRiskPercent(poi.risk)}%"></div>
                </div>
                <div class="popup-meta">
                    <span>Risco: ${this.getRiskLabel(poi.risk)}</span>
                    <span>${poi.type === 'metro' || poi.type === 'bus' ? '24h' : ''}</span>
                </div>
                ${alertsHTML}
            </div>
        `;
    }

    addMarkers() {
        pointsOfInterest.forEach(poi => {
            const size = this.getMarkerSize(poi);
            const icon = L.divIcon({
                className: `custom-marker ${this.getMarkerClass(poi)}`,
                html: `<span style="font-size:${size * 0.55}px;line-height:${size}px">${poi.icon}</span>`,
                iconSize: [size, size],
                iconAnchor: [size / 2, size / 2],
                popupAnchor: [0, -(size / 2) - 4],
            });

            const marker = L.marker([poi.lat, poi.lng], { icon })
                .addTo(this.map)
                .bindPopup(this.buildPopupHTML(poi), {
                    maxWidth: 300,
                    minWidth: 220,
                    closeButton: true,
                    className: 'cyber-popup',
                });

            marker.on('mouseover', function() { this.openPopup(); });
        });
    }
}
