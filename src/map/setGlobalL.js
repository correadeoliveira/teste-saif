import L from 'leaflet';

globalThis.L = L;
if (typeof window !== 'undefined') {
    window.L = L;
}

export default L;
