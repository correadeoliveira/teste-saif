/**
 * Relato de BO pelo botão de pânico.
 *
 * Online: POST {SUPABASE_URL}/rest/v1/rpc/report_crime
 * Offline: fila local (AsyncStorage) até o próximo sync.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import { loadProfile } from "./profileStore";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase";
import { logOperation } from "./telemetry";

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
let pending: Promise<unknown> = Promise.resolve();

function serial<T>(operation: () => Promise<T>): Promise<T> {
    const next = pending.then(operation);
    pending = next.catch(() => undefined);
    return next;
}

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
    }).then((response) => response, () => ({ data: null, error: true }));

    if (error) return { ok: false, error: "network" };

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
    if (payload.ok !== true) {
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

async function drainQueue(): Promise<void> {
    if (!isSupabaseConfigured()) return;
    const queue = await readQueue();
    let removed = 0;
    for (const item of queue) {
        const result = await postReport(item.lat, item.lng, item.crime_type, item.device_id);
        if (!result.ok && result.error !== "invalid_coords" && result.error !== "device_required") {
            break;
        }
        removed++;
        // Persist progress before trying the next queued report.
        await writeQueue(queue.slice(removed));
    }
    if (queue.length) {
        logOperation("panic_flush", removed === queue.length ? "ok" : "queued", { count: removed });
    }
}

export function flushPanicQueue(): Promise<void> {
    return serial(drainQueue).catch(() => logOperation("panic_flush", "error"));
}

export function reportPanic(input: {
    lat: number;
    lng: number;
    crimeType?: CrimeType;
}): Promise<PanicResult> {
    const started = Date.now();
    return serial(async (): Promise<PanicResult> => {
        const crimeType = asCrimeType(input.crimeType);
        if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)
            || Math.abs(input.lat) > 90 || Math.abs(input.lng) > 180) {
            return { ok: false, error: "invalid_coords" };
        }

        const profile = await loadProfile();
        const online = isSupabaseConfigured();
        if (online) {
            await drainQueue();
            const result = await postReport(input.lat, input.lng, crimeType, profile.device_id);
            if (result.ok || result.error !== "network") return result;
        }

        const at = new Date().toISOString();
        const queue = await readQueue();
        queue.push({ lat: input.lat, lng: input.lng, crime_type: crimeType, device_id: profile.device_id, at });
        await writeQueue(queue);
        return {
            ok: true, id: null, queued: true, crime_type: crimeType, period: null,
            bo_number: `${online ? "QUEUED" : "LOCAL"}-${at}`,
        };
    }).catch((): PanicErr => ({ ok: false, error: "network" })).then((result) => {
        logOperation("panic_report", result.ok ? (result.queued ? "queued" : "ok") : "error", {
            durationMs: Date.now() - started,
        });
        return result;
    });
}
