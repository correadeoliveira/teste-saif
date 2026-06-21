// ═══════════════════════════════════════════════════
// SAIFEN — HeatmapLoader
// Carrega artefatos gerados pelo pipeline Python
// (pipeline/saifen_pipeline/exporter.py → shared/heatmaps/*.json).
//
// Endpoints conhecidos (servidos da raiz do monorepo):
//   /shared/heatmaps/heatmap_points.json            ← tudo
//   /shared/heatmaps/heatmap_points__furto.json     ← só furto
//   /shared/heatmaps/heatmap_points__roubo.json     ← só roubo
//   /shared/heatmaps/heatmap_points__outros.json    ← outros
//   /shared/summary.json                            ← estatísticas
//
// Rode `tools/dev-web.sh` na raiz: http://localhost:8000/web/
// ═══════════════════════════════════════════════════

const DEFAULT_HEATMAP_BASE = '/shared/heatmaps';
const DEFAULT_SUMMARY_PATH = '/shared/summary.json';

// Tipos para os quais o pipeline gera arquivos fatiados.
// Demais tipos do frontend (assalto / agressao / trafico) caem
// no `heatmap_points.json` completo até termos fontes específicas.
const SLICED_TYPES = new Set(['furto', 'roubo', 'outros']);

export class HeatmapLoader {
    constructor({
        heatmapBase = DEFAULT_HEATMAP_BASE,
        summaryPath = DEFAULT_SUMMARY_PATH,
    } = {}) {
        this._heatmapBase = heatmapBase.replace(/\/$/, '');
        this._summaryPath = summaryPath;
        this._pointsCache = new Map();
        this._summaryPromise = null;
    }

    static slicesAvailableFor(crimeType) {
        return SLICED_TYPES.has(crimeType);
    }

    pathForType(crimeType) {
        if (!crimeType || crimeType === 'all') {
            return `${this._heatmapBase}/heatmap_points.json`;
        }
        if (SLICED_TYPES.has(crimeType)) {
            return `${this._heatmapBase}/heatmap_points__${crimeType}.json`;
        }
        return `${this._heatmapBase}/heatmap_points.json`;
    }

    async loadPoints(crimeType = 'all') {
        const key = SLICED_TYPES.has(crimeType) ? crimeType : 'all';
        if (this._pointsCache.has(key)) {
            return this._pointsCache.get(key);
        }
        const url = this.pathForType(key);
        const promise = fetch(url, { cache: 'force-cache' })
            .then((res) => {
                if (!res.ok) {
                    throw new Error(`HeatmapLoader: HTTP ${res.status} em ${url}`);
                }
                return res.json();
            })
            .then((payload) => ({
                meta: payload.meta || null,
                count: typeof payload.count === 'number'
                    ? payload.count
                    : (payload.points || []).length,
                points: payload.points || [],
            }))
            .catch((err) => {
                this._pointsCache.delete(key);
                throw err;
            });

        this._pointsCache.set(key, promise);
        return promise;
    }

    async loadSummary() {
        if (!this._summaryPromise) {
            this._summaryPromise = fetch(this._summaryPath, { cache: 'force-cache' })
                .then((res) => {
                    if (!res.ok) {
                        throw new Error(`HeatmapLoader: HTTP ${res.status} em ${this._summaryPath}`);
                    }
                    return res.json();
                })
                .catch((err) => {
                    this._summaryPromise = null;
                    throw err;
                });
        }
        return this._summaryPromise;
    }

    invalidate() {
        this._pointsCache.clear();
        this._summaryPromise = null;
    }
}

// Singleton conveniente — basta `import { heatmapLoader } from ...`.
export const heatmapLoader = new HeatmapLoader();
