import assert from "node:assert/strict";
import test from "node:test";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { resetMemory, resetSupabaseMock, setRpcHandler } from "../../test/preload-mocks";
import { loadCachedHotspots, loadHeatmap } from "./heatmap";

test("heatmap usa RPC, estático, cache com origem e demonstração nessa ordem", async (t) => {
    const previous = { ...process.env };
    t.after(() => {
        for (const name of ["EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY", "EXPO_PUBLIC_SHARED_BASE"]) {
            if (previous[name] === undefined) delete process.env[name];
            else process.env[name] = previous[name];
        }
        resetMemory();
        resetSupabaseMock();
    });

    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "test-key";
    process.env.EXPO_PUBLIC_SHARED_BASE = "http://localhost/shared";
    const point = [-23.55, -46.63, 0.9];
    let online = true;
    const fetch = t.mock.method(globalThis, "fetch", async () => online
        ? Response.json({ meta: { crime_type: "all", period: "all" }, count: 1, points: [point] })
        : new Response(null, { status: 503 }));
    setRpcHandler(async () => ({
        data: {
            type: "FeatureCollection",
            features: [{
                geometry: { type: "Polygon", coordinates: [[[-46.64, -23.56],
                    [-46.62, -23.56], [-46.62, -23.54], [-46.64, -23.54], [-46.64, -23.56]]] },
                properties: { density: 0.8 },
            }],
        },
        error: null,
    }));

    assert.equal((await loadHeatmap()).source, "supabase");
    assert.equal(fetch.mock.callCount(), 0);

    resetSupabaseMock();
    assert.equal((await loadHeatmap()).source, "static");
    online = false;
    const cached = await loadHeatmap();
    assert.equal(cached.source, "cache");
    assert.equal(cached.origin, "static");
    assert.deepEqual(await loadCachedHotspots(), [point]);

    await AsyncStorage.setItem("saifen.hotspots.v2.all",
        JSON.stringify({ origin: "static", points: [[200, 0, 0.3]] }));
    assert.equal((await loadHeatmap()).source, "fallback");
    assert.deepEqual(await loadCachedHotspots(), []);
});

test("hotspots de demonstração do cache legado não entram na zona", async () => {
    try {
        await AsyncStorage.setItem("saifen.hotspots.v1", JSON.stringify([[-23.55, -46.63, 1]]));
        assert.deepEqual(await loadCachedHotspots(), []);
    } finally {
        resetMemory();
    }
});
