import { SP_CENTER, DEFAULT_ZOOM, crimeHeatData } from '../data/MockData.js';
import { RouteManager } from './RouteManager.js';
import { MarkerManager } from './MarkerManager.js';

export class TacticalMap {
    constructor() {
        this.map = null;
        this.heatLayer = null;
        this.routeManager = null;
        this.markerManager = null;
    }

    init() {
        this.map = L.map('map', {
            center: SP_CENTER,
            zoom: DEFAULT_ZOOM,
            zoomControl: true,
            attributionControl: false,
            maxZoom: 18,
            minZoom: 11,
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            subdomains: 'abcd',
            maxZoom: 19,
        }).addTo(this.map);

        this.heatLayer = L.heatLayer(crimeHeatData, {
            radius: 30,
            blur: 25,
            maxZoom: 17,
            max: 1.0,
            gradient: {
                0.0: 'rgba(0, 100, 255, 0.0)',
                0.15: 'rgba(0, 150, 255, 0.15)',
                0.3: 'rgba(0, 255, 136, 0.3)',
                0.45: 'rgba(255, 255, 0, 0.45)',
                0.6: 'rgba(255, 160, 0, 0.55)',
                0.75: 'rgba(255, 80, 0, 0.65)',
                0.9: 'rgba(255, 0, 60, 0.75)',
                1.0: 'rgba(200, 0, 40, 0.85)',
            },
        }).addTo(this.map);

        this.markerManager = new MarkerManager(this.map);
        this.markerManager.addMarkers();

        this.routeManager = new RouteManager(this.map);
        this.routeManager.prepareSafeRoutes();

        this.setupEvents();
    }

    setupEvents() {
        this.map.on('mousemove', (e) => {
            document.getElementById('lat-display').textContent = e.latlng.lat.toFixed(4);
            document.getElementById('lng-display').textContent = e.latlng.lng.toFixed(4);
            document.getElementById('coords-display').textContent =
                `${e.latlng.lat.toFixed(4)} | ${e.latlng.lng.toFixed(4)}`;
        });

        this.map.on('zoomend', () => {
            document.getElementById('zoom-display').textContent = `ZOOM: ${this.map.getZoom()}`;
        });

        this.map.on('moveend', () => this.updateThreatFromView());
        this.updateThreatFromView();
    }

    updateThreatFromView() {
        const center = this.map.getCenter();
        const lat = center.lat;
        const lng = center.lng;

        let totalIntensity = 0;
        let count = 0;
        crimeHeatData.forEach(pt => {
            const dist = Math.sqrt(Math.pow(pt[0] - lat, 2) + Math.pow(pt[1] - lng, 2));
            if (dist < 0.008) {
                totalIntensity += pt[2];
                count++;
            }
        });

        const avgIntensity = count > 0 ? totalIntensity / count : 0;
        const badge = document.getElementById('threat-badge');
        const levelText = document.getElementById('threat-level');

        badge.classList.remove('low', 'medium', 'high', 'critical');

        if (avgIntensity >= 0.8) {
            badge.classList.add('critical');
            levelText.textContent = 'CRÍTICO';
        } else if (avgIntensity >= 0.55) {
            badge.classList.add('high');
            levelText.textContent = 'ALTO';
        } else if (avgIntensity >= 0.3) {
            badge.classList.add('medium');
            levelText.textContent = 'MÉDIO';
        } else {
            badge.classList.add('low');
            levelText.textContent = 'BAIXO';
        }

        this.updateSectorName(lat, lng);
    }

    updateSectorName(lat, lng) {
        const sectors = [
            { name: 'Cracolândia / Luz', lat: -23.534, lng: -46.637, r: 0.004 },
            { name: 'Estação da Luz', lat: -23.5355, lng: -46.6345, r: 0.003 },
            { name: 'Santa Ifigênia', lat: -23.539, lng: -46.638, r: 0.004 },
            { name: 'Praça da Sé', lat: -23.5503, lng: -46.634, r: 0.004 },
            { name: 'República', lat: -23.543, lng: -46.642, r: 0.005 },
            { name: 'Av. Paulista', lat: -23.561, lng: -46.656, r: 0.005 },
            { name: 'Consolação', lat: -23.552, lng: -46.660, r: 0.005 },
            { name: 'Liberdade', lat: -23.558, lng: -46.635, r: 0.005 },
            { name: 'Bela Vista', lat: -23.560, lng: -46.646, r: 0.005 },
            { name: 'Pinheiros', lat: -23.567, lng: -46.692, r: 0.006 },
            { name: 'Vila Madalena', lat: -23.553, lng: -46.691, r: 0.005 },
            { name: 'Brás', lat: -23.543, lng: -46.616, r: 0.005 },
            { name: 'Mooca', lat: -23.557, lng: -46.602, r: 0.006 },
            { name: 'Anhangabaú', lat: -23.546, lng: -46.638, r: 0.004 },
        ];

        let closest = 'Centro SP';
        let minDist = Infinity;

        sectors.forEach(s => {
            const dist = Math.sqrt(Math.pow(s.lat - lat, 2) + Math.pow(s.lng - lng, 2));
            if (dist < s.r && dist < minDist) {
                minDist = dist;
                closest = s.name;
            }
        });

        document.getElementById('sector').textContent = closest;
    }
}
