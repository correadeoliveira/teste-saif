import { nightLighting } from '../data/MockData.js';

export class LightingLayer {
    constructor(map) {
        this.map = map;
        this._layerGroup = null;
        this._darkOverlay = null;
        this._visible = false;
    }

    show() {
        this._visible = true;
        if (this._layerGroup) {
            this._layerGroup.addTo(this.map);
            return;
        }
        this._build();
    }

    _build() {
        this._layerGroup = L.layerGroup();

        nightLighting.forEach(area => {
            let color, fillOpacity, weight;

            switch (area.level) {
                case 'bem_iluminada':
                    color = '#00FF9F';
                    fillOpacity = 0.06;
                    weight = 1;
                    break;
                case 'parcial':
                    color = '#a0a040';
                    fillOpacity = 0.08;
                    weight = 1;
                    break;
                case 'escura':
                    color = '#cc2244';
                    fillOpacity = 0.12;
                    weight = 1;
                    break;
            }

            const circle = L.circle([area.lat, area.lng], {
                radius: area.radius,
                color: color,
                fillColor: color,
                fillOpacity: fillOpacity,
                weight: weight,
                opacity: 0.3,
                dashArray: area.level === 'escura' ? '4, 8' : null,
            });

            let levelText = '';
            switch (area.level) {
                case 'bem_iluminada': levelText = 'Bem iluminada'; break;
                case 'parcial':       levelText = 'Iluminação parcial'; break;
                case 'escura':        levelText = 'Área escura — risco noturno elevado'; break;
            }

            circle.bindPopup(`<div class="popup-inner">
                <div class="popup-type">
                    <span class="dot ${area.level === 'bem_iluminada' ? 'safe' : area.level === 'parcial' ? 'warning' : 'danger'}"></span>
                    ILUMINAÇÃO NOTURNA
                </div>
                <div class="popup-title">◎ ${area.name}</div>
                <div class="popup-desc">${levelText}</div>
            </div>`, { maxWidth: 240 });

            this._layerGroup.addLayer(circle);
        });

        this._layerGroup.addTo(this.map);
    }

    hide() {
        this._visible = false;
        if (this._layerGroup) {
            this.map.removeLayer(this._layerGroup);
        }
    }

    toggle() {
        if (this._visible) {
            this.hide();
        } else {
            this.show();
        }
    }

    isVisible() { return this._visible; }
}
