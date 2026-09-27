import type { HeatPoint } from "./heatmap";

export type ZoneLevel = "low" | "medium" | "high" | "critical";

export type ZoneSnapshot = {
    level: ZoneLevel;
    source: "supabase" | "hotspots" | "unknown";
    nearbyCount: number;
    maxDensity: number;
    lat: number;
    lng: number;
    at: string;
};

export const ZONE_RADIUS_M = 250;
export const CRITICAL_COOLDOWN_MS = 15 * 60 * 1000;

export function haversineMeters(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const r = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function classifyZone(nearbyCount: number, maxDensity: number): ZoneLevel {
    if (maxDensity >= 0.75 || nearbyCount >= 20) return "critical";
    if (maxDensity >= 0.4 || nearbyCount >= 8) return "high";
    if (maxDensity >= 0.2 || nearbyCount >= 3) return "medium";
    return "low";
}

/** Hotspots KDE: densidade máxima num raio (fallback offline). */
export function densityFromHotspots(
    lat: number,
    lng: number,
    points: HeatPoint[],
    radiusM = ZONE_RADIUS_M
): number {
    let max = 0;
    for (const [plat, plng, weight] of points) {
        if (haversineMeters(lat, lng, plat, plng) <= radiusM) {
            max = Math.max(max, weight);
        }
    }
    return max;
}

export function classifyFromHotspots(
    lat: number,
    lng: number,
    points: HeatPoint[]
): ZoneLevel {
    return classifyZone(0, densityFromHotspots(lat, lng, points));
}

export function shouldNotifyCritical(
    previous: ZoneSnapshot | null,
    next: ZoneSnapshot,
    now = Date.now()
): boolean {
    if (next.level !== "critical") return false;
    if (!previous || previous.level !== "critical") return true;
    const elapsed = now - Date.parse(previous.at);
    if (Number.isNaN(elapsed)) return true;
    const moved = haversineMeters(previous.lat, previous.lng, next.lat, next.lng) > 400;
    return elapsed >= CRITICAL_COOLDOWN_MS && moved;
}

export const ZONE_LABEL: Record<ZoneLevel, string> = {
    low: "BAIXO",
    medium: "MÉDIO",
    high: "ALTO",
    critical: "CRÍTICO",
};
