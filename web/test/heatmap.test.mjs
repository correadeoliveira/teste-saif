import assert from 'node:assert/strict';
import test from 'node:test';
import { HeatmapLoader } from '../../shared/web/heatmap-loader.js';
import { CrimeMap } from '../src/map/CrimeMap.js';

const point = [-23.55, -46.63, 0.5];
const response = (crime_type = 'all', period = 'all', points = [point]) =>
    Response.json({ meta: { crime_type, period }, points, count: points.length });

test('validates the requested slice and shares cached fallback requests', async (t) => {
    const urls = [];
    t.mock.method(globalThis, 'fetch', async (url) => {
        urls.push(url);
        if (url.endsWith('__noite.json')) return response('furto', 'tarde');
        if (url.endsWith('__furto.json')) return response('furto', 'all', [[-91, 0, 0]]);
        return response();
    });
    const loader = new HeatmapLoader();
    const slice = await loader.loadPoints('furto', 'noite');
    assert.equal(slice.crimeType, 'all');
    assert.equal(slice.period, 'all');
    assert.equal(await loader.loadPoints(), slice);
    assert.equal(urls.length, 3);
    loader.invalidate();
    await loader.loadPoints();
    assert.equal(urls.length, 4);
});

test('retries after malformed JSON or inaccurate counts', async (t) => {
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => {
        calls++;
        if (calls === 1) return new Response('{');
        if (calls === 2) {
            return Response.json({ meta: { crime_type: 'all', period: 'all' }, points: [point], count: 0 });
        }
        return response();
    });
    const loader = new HeatmapLoader();
    await assert.rejects(loader.loadPoints(), /unavailable/);
    await assert.rejects(loader.loadPoints(), /unavailable/);
    assert.deepEqual((await loader.loadPoints()).points, [point]);
});

test('a slow failure cannot overwrite a newer web map selection', async () => {
    const original = globalThis.document;
    let rejectOld;
    const old = new Promise((resolve, reject) => { rejectOld = reject; });
    const map = new CrimeMap();
    const shown = [];
    globalThis.document = { dispatchEvent: (event) => shown.push(event.detail) };
    map.heatLayer = { setLatLngs() {} };
    map._heatmapLoader = {
        loadPoints: (type) => type === 'all'
            ? old
            : Promise.resolve({ points: [point], count: 1, crimeType: type, period: 'all' }),
    };
    try {
        const earlier = map.loadRealHeatmap();
        await map.loadRealHeatmap('furto');
        rejectOld(new Error('simulated unavailable artifact'));
        assert.equal((await earlier).source, 'stale');
        assert.deepEqual(shown.map((event) => event.crimeType), ['furto']);
    } finally {
        if (original === undefined) delete globalThis.document;
        else globalThis.document = original;
    }
});
