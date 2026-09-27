// ═══════════════════════════════════════════════════
// SAIFEN — HeatmapLoader
// Artefatos: pipeline → shared/heatmaps/*.json
// ═══════════════════════════════════════════════════

const DEFAULT_HEATMAP_BASE = '/shared/heatmaps';
const DEFAULT_SUMMARY_PATH = '/shared/summary.json';
const DEFAULT_CURRENT_RUN = '/shared/current_run.json';

const SLICED_TYPES = new Set(['furto', 'roubo', 'outros']);
const SLICED_PERIODS = new Set(['manha', 'tarde', 'noite', 'madrugada']);

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

    async _fetchPoints(url) {
        const res = await fetch(url, { cache: 'no-cache' });
        if (!res.ok) {
            throw new Error(`HeatmapLoader: HTTP ${res.status} em ${url}`);
        }
        const payload = await res.json();
        return {
            meta: payload.meta || null,
            count: typeof payload.count === 'number'
                ? payload.count
                : (payload.points || []).length,
            points: payload.points || [],
        };
    }

    async loadPoints(crimeType = 'all', period = 'all') {
        const typeKey = SLICED_TYPES.has(crimeType) ? crimeType : 'all';
        const periodKey = SLICED_PERIODS.has(period) ? period : 'all';
        const key = `${typeKey}:${periodKey}`;
        if (this._pointsCache.has(key)) {
            return this._pointsCache.get(key);
        }

        const candidates = [];
        candidates.push(this.pathFor(typeKey, periodKey));
        if (periodKey !== 'all') {
            candidates.push(this.pathFor(typeKey, 'all'));
        }
        if (typeKey !== 'all' || periodKey !== 'all') {
            candidates.push(this.pathFor('all', 'all'));
        }

        const promise = (async () => {
            let lastErr;
            const tried = new Set();
            for (const url of candidates) {
                if (tried.has(url)) continue;
                tried.add(url);
                try {
                    return await this._fetchPoints(url);
                } catch (err) {
                    lastErr = err;
                }
            }
            throw lastErr || new Error('HeatmapLoader: nenhum artefato disponível');
        })().catch((err) => {
            this._pointsCache.delete(key);
            throw err;
        });

        this._pointsCache.set(key, promise);
        return promise;
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
