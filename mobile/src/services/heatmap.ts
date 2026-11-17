import AsyncStorage from "@react-native-async-storage/async-storage";

import { env, getSupabaseClient } from "./supabase";
import { logOperation } from "./telemetry";

export type HeatPoint = [lat: number, lng: number, weight: number];

type CrimeType = "all" | "furto" | "roubo" | "outros";
type DataSource = "supabase" | "static";
type CachedHeatmap = { origin: DataSource; points: HeatPoint[] };

export type HeatmapPayload = {
    source: DataSource | "cache" | "fallback";
    origin?: DataSource;
    crimeType: CrimeType;
    count: number;
    points: HeatPoint[];
};

const HOTSPOTS_KEY = "saifen.hotspots.v2";
const DEMO_POINTS: HeatPoint[] = [
    [-23.5335, -46.6368, 1.0],
    [-23.5503, -46.6340, 0.85],
    [-23.5432, -46.6425, 0.72],
    [-23.5616, -46.6558, 0.40],
    [-23.5598, -46.6459, 0.55],
];

function validPoints(points: unknown): points is HeatPoint[] {
    return Array.isArray(points) && points.length > 0 && points.every((point) =>
        Array.isArray(point) && point.length === 3 && point.every(Number.isFinite)
        && Math.abs(point[0]) <= 90 && Math.abs(point[1]) <= 180
        && point[2] >= 0 && point[2] <= 1
    );
}

async function tryFromSupabase(crimeType: CrimeType): Promise<HeatPoint[] | null> {
    try {
        const client = getSupabaseClient();
        if (!client) return null;
        const { data, error } = await client.rpc("get_heatmap_grid", { p_crime_type: crimeType });
        if (error || data?.type !== "FeatureCollection" || !Array.isArray(data.features)) return null;
        const points = data.features.map((feature: {
            geometry?: { type?: string; coordinates: number[][][] };
            properties?: { density?: number };
        }) => {
            if (feature.geometry?.type !== "Polygon") throw new Error("invalid_geometry");
            const ring = feature.geometry.coordinates[0] as number[][];
            if (ring.length < 4) throw new Error("invalid_ring");
            const vertices = ring.slice(0, -1);
            if (!vertices.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))) {
                throw new Error("invalid_coordinates");
            }
            const lng = vertices.reduce((sum, p) => sum + p[0], 0) / vertices.length;
            const lat = vertices.reduce((sum, p) => sum + p[1], 0) / vertices.length;
            return [lat, lng, feature.properties?.density];
        });
        return validPoints(points) ? points : null;
    } catch {
        return null;
    }
}

async function tryFromStatic(crimeType: CrimeType): Promise<HeatPoint[] | null> {
    const base = env.SHARED_BASE?.replace(/\/$/, "");
    if (!base) return null;
    const suffix = crimeType === "all" ? "" : `__${crimeType}`;
    try {
        const res = await fetch(`${base}/heatmaps/heatmap_points${suffix}.json`);
        if (!res.ok) return null;
        const { meta, points, count } = await res.json();
        return meta?.crime_type === crimeType && meta?.period === "all"
            && validPoints(points) && points.length === count ? points : null;
    } catch {
        return null;
    }
}

async function persistHotspots(crimeType: CrimeType, origin: DataSource, points: HeatPoint[]) {
    const sorted = [...points].sort((a, b) => b[2] - a[2]);
    const hot = sorted.filter((point) => point[2] >= 0.4).slice(0, 600);
    try {
        await AsyncStorage.setItem(`${HOTSPOTS_KEY}.${crimeType}`, JSON.stringify({
            origin, points: hot.length ? hot : sorted.slice(0, 200),
        }));
    } catch {
        logOperation("heatmap_cache", "error");
    }
}

async function loadCachedHeatmap(crimeType: CrimeType): Promise<CachedHeatmap | null> {
    try {
        const raw = await AsyncStorage.getItem(`${HOTSPOTS_KEY}.${crimeType}`);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if ((data?.origin === "supabase" || data?.origin === "static") && validPoints(data.points)) {
            return data;
        }
    } catch {
        logOperation("heatmap_cache", "error");
    }
    return null;
}

export async function loadCachedHotspots(): Promise<HeatPoint[]> {
    const cached = await loadCachedHeatmap("all");
    return cached?.points ?? [];
}

export async function loadHeatmap(crimeType: CrimeType = "all"): Promise<HeatmapPayload> {
    const started = Date.now();
    const remote = await tryFromSupabase(crimeType);
    const current = remote ?? await tryFromStatic(crimeType);
    if (current) {
        const source = remote ? "supabase" : "static";
        await persistHotspots(crimeType, source, current);
        logOperation("heatmap_load", "ok", { source, count: current.length, durationMs: Date.now() - started });
        return { source, crimeType, count: current.length, points: current };
    }

    const cached = await loadCachedHeatmap(crimeType);
    const points = cached?.points ?? DEMO_POINTS;
    logOperation("heatmap_load", "fallback", {
        source: cached ? "cache" : "demo", count: points.length, durationMs: Date.now() - started,
    });
    return {
        source: cached ? "cache" : "fallback", origin: cached?.origin,
        crimeType, count: points.length, points,
    };
}
