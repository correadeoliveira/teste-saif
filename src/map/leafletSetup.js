import L from './setGlobalL.js';
import 'leaflet/dist/leaflet.css';
import heatSrc from '../vendor/leaflet-heat.umd.js?raw';

// Heatmap em WebGL no lugar do leaflet.heat (canvas 2D).
// O bundle do plugin define L.WebGLHeatMap mas depende de `window.createWebGLHeatmap`,
// que vem da lib base — por isso os dois são carregados aqui, nesta ordem.
import webglBaseSrc from 'leaflet-webgl-heatmap/src/webgl-heatmap/webgl-heatmap.js?raw';
import webglPluginSrc from 'leaflet-webgl-heatmap/dist/leaflet-webgl-heatmap.min.js?raw';

new Function('L', 'window', `${heatSrc}\nthis.simpleheat = window.simpleheat;`)(L, globalThis);
new Function('window', `${webglBaseSrc}\nreturn window;`)(globalThis);
new Function('L', `${webglPluginSrc}\nreturn L;`)(L);

export { L };
export default L;
