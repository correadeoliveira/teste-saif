/**
 * SAIFEN — Heatmap service (mobile)
 *
 * Estratégia em camadas (mesma do web):
 *
 *   1. Supabase RPC `get_heatmap_grid` (online, dados sempre frescos)
 *   2. fetch(`${SHARED_BASE}/heatmaps/heatmap_points.json`) (dev local)
 *   3. fallback hardcoded (mantém o app utilizável offline)
 *
 * Decida a estratégia no boot, persista em memória, refaça quando
 * o usuário pull-to-refresh.
 */
import { env, getSupabaseClient, isSupabaseConfigured } from "./supabase";

export type HeatPoint = [lat: number, lng: number, weight: number];

export type HeatmapPayload = {
    source: "supabase" | "static" | "fallback";
    crimeType: "all" | "furto" | "roubo" | "outros";
    count: number;
    points: HeatPoint[];
};

const SLICED = new Set(["furto", "roubo", "outros"]);

const FALLBACK_POINTS: HeatPoint[] = [
    // Cinco hotspots conhecidos para o app rodar offline sem dados
    [-23.5335, -46.6368, 1.0],   // Cracolândia
    [-23.5503, -46.6340, 0.85],  // Sé
    [-23.5432, -46.6425, 0.72],  // República
    [-23.5616, -46.6558, 0.40],  // Paulista
    [-23.5598, -46.6459, 0.55],  // Anhangabaú
];

async function tryFromSupabase(
    crimeType: HeatmapPayload["crimeType"]
): Promise<HeatPoint[] | null> {
    const client = getSupabaseClient();
    if (!client) return null;
    try {
        const { data, error } = await client.rpc("get_heatmap_grid", {
            p_crime_type: crimeType,
        });
        if (error || !data) return null;
        // RPC retorna GeoJSON FeatureCollection; aqui só extraímos centróides.
        // O cálculo real de heatmap nativo vem do react-native-maps Heatmap.
        const fc = data as { features?: Array<{
            geometry: { coordinates: number[][][] };
            properties: { density: number };
        }> };
        return (fc.features ?? []).map((f) => {
            const ring = f.geometry.coordinates[0];
            const lng = ring.reduce((s, p) => s + p[0], 0) / ring.length;
            const lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
            return [lat, lng, f.properties.density] as HeatPoint;
        });
    } catch {
        return null;
    }
}

async function tryFromStatic(
    crimeType: HeatmapPayload["crimeType"]
): Promise<HeatPoint[] | null> {
    if (!env.SHARED_BASE) return null;
    const file =
        crimeType === "all" || !SLICED.has(crimeType)
            ? "heatmap_points.json"
            : `heatmap_points__${crimeType}.json`;
    try {
        const res = await fetch(`${env.SHARED_BASE}/heatmaps/${file}`);
        if (!res.ok) return null;
        const payload = (await res.json()) as { points?: HeatPoint[] };
        return payload.points ?? null;
    } catch {
        return null;
    }
}

export async function loadHeatmap(
    crimeType: HeatmapPayload["crimeType"] = "all"
): Promise<HeatmapPayload> {
    if (isSupabaseConfigured()) {
        const points = await tryFromSupabase(crimeType);
        if (points && points.length) {
            return { source: "supabase", crimeType, count: points.length, points };
        }
    }

    const staticPts = await tryFromStatic(crimeType);
    if (staticPts && staticPts.length) {
        return { source: "static", crimeType, count: staticPts.length, points: staticPts };
    }

    return {
        source: "fallback",
        crimeType,
        count: FALLBACK_POINTS.length,
        points: FALLBACK_POINTS,
    };
}
