import AsyncStorage from "@react-native-async-storage/async-storage";

import type { HeatPoint } from "./heatmap";
import { loadCachedHotspots } from "./heatmap";
import { notifyCriticalZone } from "./notifications";
import { getSupabaseClient } from "./supabase";
import {
    classifyZone,
    densityFromHotspots,
    shouldNotifyCritical,
    ZONE_LABEL,
    ZONE_RADIUS_M,
    type ZoneLevel,
    type ZoneSnapshot,
} from "./zone";

const SNAPSHOT_KEY = "saifen.zone.snapshot";

let snapshot: ZoneSnapshot | null = null;
const listeners = new Set<(s: ZoneSnapshot) => void>();

function parseLevel(value: unknown, nearbyCount: number, maxDensity: number): ZoneLevel {
    if (value === "low" || value === "medium" || value === "high" || value === "critical") {
        return value;
    }
    return classifyZone(nearbyCount, maxDensity);
}

export function getZoneSnapshot(): ZoneSnapshot | null {
    return snapshot;
}

export function subscribeZone(listener: (s: ZoneSnapshot) => void): () => void {
    listeners.add(listener);
    if (snapshot) listener(snapshot);
    return () => {
        listeners.delete(listener);
    };
}

function emit(next: ZoneSnapshot): void {
    snapshot = next;
    void AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(next));
    listeners.forEach((fn) => fn(next));
}

async function loadPersistedSnapshot(): Promise<ZoneSnapshot | null> {
    if (snapshot) return snapshot;
    const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as ZoneSnapshot;
        if (parsed?.level && typeof parsed.lat === "number") {
            snapshot = parsed;
            return parsed;
        }
    } catch {
        return null;
    }
    return null;
}

export async function evaluateCoords(lat: number, lng: number): Promise<ZoneSnapshot> {
    const at = new Date().toISOString();
    const client = getSupabaseClient();
    if (client) {
        try {
            const { data, error } = await client.rpc("zone_risk", {
                p_lat: lat,
                p_lng: lng,
                p_radius_meters: ZONE_RADIUS_M,
            });
            if (!error && data && typeof data === "object") {
                const row = data as {
                    nearby_count?: number;
                    max_density?: number;
                    level?: string;
                };
                const nearbyCount = Number(row.nearby_count ?? 0);
                const maxDensity = Number(row.max_density ?? 0);
                return {
                    level: parseLevel(row.level, nearbyCount, maxDensity),
                    source: "supabase",
                    nearbyCount,
                    maxDensity,
                    lat,
                    lng,
                    at,
                };
            }
        } catch {
            /* cai no fallback de hotspots */
        }
    }

    const points: HeatPoint[] = await loadCachedHotspots();
    const maxDensity = densityFromHotspots(lat, lng, points);
    return {
        level: classifyZone(0, maxDensity),
        source: points.length ? "hotspots" : "unknown",
        nearbyCount: 0,
        maxDensity,
        lat,
        lng,
        at,
    };
}

export async function handleLocationSample(coords: {
    lat: number;
    lng: number;
}): Promise<ZoneSnapshot> {
    const previous = snapshot ?? (await loadPersistedSnapshot());
    const next = await evaluateCoords(coords.lat, coords.lng);
    if (shouldNotifyCritical(previous, next)) {
        await notifyCriticalZone(
            `Risco ${ZONE_LABEL[next.level]} nesta área. ${next.nearbyCount} BO(s) num raio de ${ZONE_RADIUS_M} m.`
        );
    }
    emit(next);
    return next;
}
