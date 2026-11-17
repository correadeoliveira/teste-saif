// ═══════════════════════════════════════════════════
// SAIFEN — HeatmapLoader
// Artefatos: pipeline → shared/heatmaps/*.json
// ═══════════════════════════════════════════════════

const DEFAULT_HEATMAP_BASE = '/shared/heatmaps';
const DEFAULT_SUMMARY_PATH = '/shared/summary.json';
const DEFAULT_CURRENT_RUN = '/shared/current_run.json';

const SLICED_TYPES = new Set(['furto', 'roubo', 'outros']);
const SLICED_PERIODS = new Set(['manha', 'tarde', 'noite', 'madrugada']);

function validPoint(point) {
    if (!Array.isArray(point) || point.length !== 3 || !point.every(Number.isFinite)) return false;
    const [lat, lng, weight] = point;
    return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && weight >= 0 && weight <= 1;
}

export class HeatmapLoader {
    constructor({
        heatmapBase = DEFAULT_HEATMAP_BASE,
        summaryPath = DEFAULT_SUMMARY_PATH,
        currentRunPath = DEFAULT_CURRENT_RUN,
    } = {}) {
        this._heatmapBase = heatmapBase.replace(/\/$/, '');
        this._summaryPath = summaryPath;
        this._currentRunPath = currentRunPath;
        this._pointsCache = new Map();
        this._summaryPromise = null;
        this._runPromise = null;
    }

    static slicesAvailableFor(crimeType) {
        return SLICED_TYPES.has(crimeType);
    }

    static periodsAvailableFor(period) {
        return SLICED_PERIODS.has(period);
    }

    pathFor(crimeType = 'all', period = 'all') {
        const type = SLICED_TYPES.has(crimeType) ? crimeType : null;
        const per = SLICED_PERIODS.has(period) ? period : null;
        if (type && per) {
            return `${this._heatmapBase}/heatmap_points__${type}__${per}.json`;
        }
        if (type) {
            return `${this._heatmapBase}/heatmap_points__${type}.json`;
        }
        return `${this._heatmapBase}/heatmap_points.json`;
    }

    async _fetchPoints(type, period) {
        const url = this.pathFor(type, period);
        if (!this._pointsCache.has(url)) {
            const promise = (async () => {
                const res = await fetch(url, { cache: 'no-cache' });
                if (!res.ok) throw new Error('Heatmap HTTP error');
                const { meta, count, points } = await res.json();
                if (meta?.crime_type !== type || meta?.period !== period
                    || !Array.isArray(points) || points.length === 0 || count !== points.length
                    || !points.every(validPoint)) {
                    throw new Error('Invalid heatmap artifact');
                }
                return { meta, count, points, crimeType: type, period };
            })().catch((error) => {
                if (this._pointsCache.get(url) === promise) this._pointsCache.delete(url);
                throw error;
            });
            this._pointsCache.set(url, promise);
        }
        return this._pointsCache.get(url);
    }

    async loadPoints(crimeType = 'all', period = 'all') {
        const type = SLICED_TYPES.has(crimeType) ? crimeType : 'all';
        const time = type !== 'all' && SLICED_PERIODS.has(period) ? period : 'all';
        const candidates = [];
        if (time !== 'all') candidates.push([type, time]);
        if (type !== 'all') candidates.push([type, 'all']);
        candidates.push(['all', 'all']);

        for (const [actualType, actualPeriod] of candidates) {
            try {
                return await this._fetchPoints(actualType, actualPeriod);
            } catch {
                // Try the next available slice.
            }
        }
        throw new Error('Heatmap unavailable');
    }

    async loadSummary() {
        if (!this._summaryPromise) {
            this._summaryPromise = fetch(this._summaryPath, { cache: 'no-cache' })
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

    async loadCurrentRun() {
        if (!this._runPromise) {
            this._runPromise = fetch(this._currentRunPath, { cache: 'no-cache' })
                .then((res) => (res.ok ? res.json() : null))
                .catch(() => null);
        }
        return this._runPromise;
    }

    invalidate() {
        this._pointsCache.clear();
        this._summaryPromise = null;
        this._runPromise = null;
    }

    /**
     * Aquece o cache com as fatias mais prováveis de serem escolhidas, para
     * que trocar o filtro no STATS não dispare um fetch na frente do usuário.
     * Todas as 16 fatias somam ~2,7 MB, então é barato; ainda assim roda em
     * tempo ocioso e em sequência, para não competir com o primeiro render.
     */
    prefetch(onDone) {
        const types = ['furto', 'roubo', 'outros'];
        const queue = [
            ...types.map((t) => [t, 'all']),
            ...types.map((t) => [t, 'noite']),
        ];
        let i = 0;
        const idle = window.requestIdleCallback
            ? window.requestIdleCallback.bind(window)
            : (fn) => window.setTimeout(fn, 200);

        const step = () => {
            if (i >= queue.length) { onDone?.(); return; }
            const [t, p] = queue[i++];
            this.loadPoints(t, p)
                .catch(() => null)          // fatia ausente não é erro fatal
                .then(() => idle(step));
        };
        idle(step);
    }
}

export const heatmapLoader = new HeatmapLoader();
