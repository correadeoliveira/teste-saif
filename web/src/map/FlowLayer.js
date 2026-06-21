import { peopleFlow } from '../data/MockData.js';

export class FlowLayer {
    constructor(map) {
        this.map = map;
        this._heatLayer = null;
        this._visible = false;
        this._currentSlot = 'all';
    }

    _buildData(timeSlot) {
        const pts = timeSlot === 'all'
            ? peopleFlow
            : peopleFlow.filter(p => p.timeSlot === timeSlot);

        // Agregar densidades por posição próxima
        return pts.map(p => [p.lat, p.lng, p.density]);
    }

    show(timeSlot) {
        this._visible = true;
        this._currentSlot = timeSlot || 'all';
        const data = this._buildData(this._currentSlot);

        if (this._heatLayer) {
            this._heatLayer.setLatLngs(data);
            this._heatLayer.addTo(this.map);
        } else {
            this._heatLayer = L.heatLayer(data, {
                radius: 35,
                blur: 30,
                maxZoom: 17,
                max: 1.0,
                // Mais fluxo = verde mais claro/brilhante; menos fluxo = mais escuro
                gradient: {
                    0.0: 'rgba(0, 80, 40, 0.0)',
                    0.2: 'rgba(0, 120, 60, 0.15)',
                    0.4: 'rgba(0, 180, 90, 0.25)',
                    0.6: 'rgba(0, 220, 120, 0.35)',
                    0.8: 'rgba(0, 255, 159, 0.45)',
                    1.0: 'rgba(57, 255, 20, 0.55)',
                },
            }).addTo(this.map);
        }
    }

    hide() {
        this._visible = false;
        if (this._heatLayer) {
            this.map.removeLayer(this._heatLayer);
        }
    }

    toggle(timeSlot) {
        if (this._visible) {
            this.hide();
        } else {
            this.show(timeSlot || this._currentSlot);
        }
    }

    update(timeSlot) {
        if (!this._visible || !this._heatLayer) return;
        this._currentSlot = timeSlot;
        this._heatLayer.setLatLngs(this._buildData(timeSlot));
    }

    isVisible() { return this._visible; }
}
