/**
 * Relato de BO pelo botão de pânico.
 *
 * Online: POST {SUPABASE_URL}/rest/v1/rpc/report_crime
 * Offline: fila local (AsyncStorage) até o próximo sync.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import { loadProfile } from "./profileStore";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase";

export type CrimeType = "furto" | "roubo" | "outros";

export type PanicOk = {
    ok: true;
    id: number | null;
    bo_number: string;
    crime_type: CrimeType;
    period: string | null;
    queued: boolean;
};

export type PanicErr = {
    ok: false;
    error: "rate_limited" | "invalid_coords" | "device_required" | "not_configured" | "network" | string;
    retry_after_sec?: number;
};

export type PanicResult = PanicOk | PanicErr;

type QueuedPanic = {
    lat: number;
    lng: number;
    crime_type: CrimeType;
    device_id: string;
    at: string;
};

const QUEUE_KEY = "saifen.panic.queue";

function asCrimeType(value: string | undefined): CrimeType {
    if (value === "furto" || value === "roubo" || value === "outros") return value;
    return "outros";
}

async function readQueue(): Promise<QueuedPanic[]> {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw) as QueuedPanic[];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

async function writeQueue(items: QueuedPanic[]): Promise<void> {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

async function postReport(
    lat: number,
    lng: number,
    crimeType: CrimeType,
    deviceId: string
): Promise<PanicResult> {
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: "not_configured" };

    const { data, error } = await client.rpc("report_crime", {
        p_lat: lat,
        p_lng: lng,
        p_crime_type: crimeType,
        p_device_id: deviceId,
    });

    if (error) return { ok: false, error: error.message };

    const payload = data as {
        ok?: boolean;
        id?: number;
        bo_number?: string;
        crime_type?: string;
        period?: string;
        error?: string;
        retry_after_sec?: number;
    } | null;

    if (!payload) return { ok: false, error: "network" };
    if (payload.ok === false) {
        return {
            ok: false,
            error: payload.error ?? "network",
            retry_after_sec: payload.retry_after_sec,
        };
    }

    return {
        ok: true,
        id: payload.id ?? null,
        bo_number: payload.bo_number ?? `PANIC-local`,
        crime_type: asCrimeType(payload.crime_type),
        period: payload.period ?? null,
        queued: false,
    };
}

export async function flushPanicQueue(): Promise<void> {
    if (!isSupabaseConfigured()) return;
    const queue = await readQueue();
    if (!queue.length) return;

    const remaining: QueuedPanic[] = [];
    for (const item of queue) {
        const result = await postReport(item.lat, item.lng, item.crime_type, item.device_id);
        if (!result.ok) remaining.push(item);
    }
    await writeQueue(remaining);
}

export async function reportPanic(input: {
    lat: number;
    lng: number;
    crimeType?: CrimeType;
}): Promise<PanicResult> {
    const crimeType = input.crimeType ?? "outros";
    const profile = await loadProfile();

    if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
        return { ok: false, error: "invalid_coords" };
    }

    if (!isSupabaseConfigured()) {
        const queued: QueuedPanic = {
            lat: input.lat,
            lng: input.lng,
            crime_type: crimeType,
            device_id: profile.device_id,
            at: new Date().toISOString(),
        };
        const queue = await readQueue();
        queue.push(queued);
        await writeQueue(queue);
        return {
            ok: true,
            id: null,
            bo_number: `LOCAL-${queued.at}`,
            crime_type: crimeType,
            period: null,
            queued: true,
        };
    }

    try {
        await flushPanicQueue();
        const result = await postReport(input.lat, input.lng, crimeType, profile.device_id);
        if (!result.ok && result.error !== "rate_limited" && result.error !== "invalid_coords" && result.error !== "device_required") {
            const queue = await readQueue();
            queue.push({
                lat: input.lat,
                lng: input.lng,
                crime_type: crimeType,
                device_id: profile.device_id,
                at: new Date().toISOString(),
            });
            await writeQueue(queue);
            return {
                ok: true,
                id: null,
                bo_number: `QUEUED-${Date.now()}`,
                crime_type: crimeType,
                period: null,
                queued: true,
            };
        }
        return result;
    } catch {
        return { ok: false, error: "network" };
    }
}
