import L from './setGlobalL.js';
import 'leaflet/dist/leaflet.css';
import heatSrc from '../vendor/leaflet-heat.umd.js?raw';

new Function('L', 'window', `${heatSrc}\nthis.simpleheat = window.simpleheat;`)(L, globalThis);

export { L };
export default L;
