import { nightLighting } from '../data/MockData.js';

export class LightingLayer {
    constructor(map) {
        this.map = map;
        this._layerGroup = L.layerGroup();
        this._data = []; // Will hold street lighting data
        this._visible = false;
    }

    // New method to receive data dynamically
    updateStreetLighting(streetsData) {
        this._data = streetsData;
        this._build();
    }

    show() {
        this._visible = true;
        this._layerGroup.addTo(this.map);
        if (this._data.length === 0) {
            // Load mock data if none provided
            this.updateStreetLighting(nightLighting);
        }
    }

    hide() {
        this._visible = false;
        this.map.removeLayer(this._layerGroup);
    }

    toggle() {
        if (this._visible) {
            this.hide();
        } else {
            this.show();
        }
    }

    isVisible() { return this._visible; }

    _build() {
        this._layerGroup.clearLayers();

        this._data.forEach(street => {
            if (!street.coords || street.coords.length < 2) return; // Need actual paths

            let color, weight, opacity;

            switch (street.level) {
                case 'bem_iluminada':
                    color = '#06402B';
                    opacity = 0.8;
                    weight = 6;
                    break;
                case 'parcial':
                    color = '#FDB515';
                    opacity = 0.8;
                    weight = 6;
                    break;
                case 'escura':
                    color = '#FF0000';
                    opacity = 0.8;
                    weight = 6;
                    break;
                default:
                    color = '#888888';
                    opacity = 0.5;
                    weight = 4;
            }

            const shape = L.polyline(street.coords, {
                color: color,
                weight: weight,
                opacity: opacity,
                dashArray: street.level === 'escura' ? '10, 15' : null,
                lineCap: 'round',
                lineJoin: 'round'
            });

            let levelText = '';
            switch (street.level) {
                case 'bem_iluminada': levelText = 'Bem iluminada'; break;
                case 'parcial':       levelText = 'Iluminação parcial'; break;
                case 'escura':        levelText = 'Área escura — risco noturno elevado'; break;
            }

            shape.bindPopup(`<div class="popup-inner">
                <div class="popup-type">
                    <span class="dot ${street.level === 'bem_iluminada' ? 'safe' : street.level === 'parcial' ? 'warning' : 'danger'}"></span>
                    ILUMINAÇÃO NOTURNA
                </div>
                <div class="popup-title">◎ ${street.name}</div>
                <div class="popup-desc">${levelText}</div>
            </div>`, { maxWidth: 240 });

            this._layerGroup.addLayer(shape);

            // Add exclamation mark icon for 'escura' areas in the middle of the street
            if (street.level === 'escura') {
                const midIndex = Math.floor(street.coords.length / 2);
                const midPoint = street.coords[midIndex];
                
                const alertIcon = L.divIcon({
                    className: 'custom-div-icon',
                    html: `
                        <div style="
                            background: rgba(0,0,0,0.8);
                            border: 1px solid #FF0000;
                            box-shadow: 0 0 10px rgba(255, 0, 0, 0.8);
                            width: 24px;
                            height: 24px;
                            border-radius: 4px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: #FF0000;
                        ">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                                <path d="M12 9v4"></path>
                                <path d="M12 17h.01"></path>
                            </svg>
                        </div>
                    `,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                });
                const alertMarker = L.marker(midPoint, { icon: alertIcon });
                this._layerGroup.addLayer(alertMarker);
            }
        });
    }
}
