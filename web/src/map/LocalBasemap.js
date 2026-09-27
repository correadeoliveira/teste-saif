/**
 * Mapa-base com ruas via OpenStreetMap.
 * Sem API key (Carto/Mapbox). Tiles públicos + filtro CSS para o tema escuro.
 */
const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

export function createLocalBasemap(L, { labels = false } = {}) {
    return L.tileLayer(OSM_URL, {
        subdomains: 'abc',
        maxZoom: 19,
        className: labels ? 'saifen-basemap saifen-basemap-labels' : 'saifen-basemap saifen-basemap-nolabels',
        attribution: '&copy; OpenStreetMap',
    });
}
