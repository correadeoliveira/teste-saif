import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { ImuSample, SessionLabel, SessionMeta } from "./types";
import { TARGET_HZ } from "./types";
import { effectiveHz } from "./imuMerge";

const SUBJECT_KEY = "saifen.subject_id";
const DEFAULT_SUBJECT = "local-user";

function rootDir(): string {
    const base = FileSystem.documentDirectory;
    if (!base) throw new Error("FileSystem.documentDirectory indisponível");
    return `${base}behavior/`;
}

export async function getSubjectId(): Promise<string> {
    const existing = await AsyncStorage.getItem(SUBJECT_KEY);
    if (existing) return existing;
    await AsyncStorage.setItem(SUBJECT_KEY, DEFAULT_SUBJECT);
    return DEFAULT_SUBJECT;
}

export async function setSubjectId(id: string): Promise<void> {
    await AsyncStorage.setItem(SUBJECT_KEY, id);
}

export function newSessionId(): string {
    return newUuid();
}

/** UUID v4 — PK do perfil no Supabase. */
export function newUuid(): string {
    const g = globalThis as { crypto?: { randomUUID?: () => string } };
    if (g.crypto?.randomUUID) return g.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

async function ensureDir(path: string): Promise<void> {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) {
        await FileSystem.makeDirectoryAsync(path, { intermediates: true });
    }
}

export function sessionPaths(subjectId: string, sessionId: string): {
    dir: string;
    jsonl: string;
    meta: string;
} {
    const dir = `${rootDir()}${subjectId}/`;
    return {
        dir,
        jsonl: `${dir}${sessionId}.jsonl`,
        meta: `${dir}${sessionId}.meta.json`,
    };
}

export async function persistSession(opts: {
    samples: ImuSample[];
    startedAt: Date;
    endedAt: Date;
    activity: string;
    label: SessionLabel;
    subjectId?: string;
    sessionId?: string;
    targetHz?: number;
}): Promise<SessionMeta> {
    const subjectId = opts.subjectId ?? (await getSubjectId());
    const sessionId = opts.sessionId ?? newSessionId();
    const { dir, jsonl, meta } = sessionPaths(subjectId, sessionId);
    await ensureDir(dir);

    const durationMs = Math.max(1, opts.endedAt.getTime() - opts.startedAt.getTime());
    const payload = opts.samples.map((s) => JSON.stringify(s)).join("\n") + (opts.samples.length ? "\n" : "");
    await FileSystem.writeAsStringAsync(jsonl, payload, {
        encoding: FileSystem.EncodingType.UTF8,
    });

    const record: SessionMeta = {
        session_id: sessionId,
        subject_id: subjectId,
        activity: opts.activity,
        label: opts.label,
        started_at: opts.startedAt.toISOString(),
        ended_at: opts.endedAt.toISOString(),
        n_samples: opts.samples.length,
        sample_rate_target_hz: opts.targetHz ?? TARGET_HZ,
        sample_rate_effective_hz: effectiveHz(opts.samples.length, durationMs),
        platform: `${Platform.OS}@${String(Platform.Version)}`,
        duration_ms: durationMs,
        path_jsonl: jsonl,
        path_meta: meta,
    };
    await FileSystem.writeAsStringAsync(meta, JSON.stringify(record, null, 2), {
        encoding: FileSystem.EncodingType.UTF8,
    });
    return record;
}

export async function listSessions(subjectId?: string): Promise<SessionMeta[]> {
    const sid = subjectId ?? (await getSubjectId());
    const dir = `${rootDir()}${sid}/`;
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) return [];
    const names = await FileSystem.readDirectoryAsync(dir);
    const metas = names.filter((n) => n.endsWith(".meta.json"));
    const out: SessionMeta[] = [];
    for (const name of metas) {
        const raw = await FileSystem.readAsStringAsync(`${dir}${name}`);
        out.push(JSON.parse(raw) as SessionMeta);
    }
    return out.sort((a, b) => a.started_at.localeCompare(b.started_at));
}

export async function readSessionJsonl(meta: SessionMeta): Promise<ImuSample[]> {
    const { jsonl } = sessionPaths(meta.subject_id, meta.session_id);
    const raw = await FileSystem.readAsStringAsync(jsonl);
    return raw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line) as ImuSample);
}

/**
 * Share sheet nativo: no Expo Go não há Finder; AirDrop/Files é o único
 * caminho para tirar JSONL do device sem dev client.
 */
export async function exportSession(meta: SessionMeta): Promise<void> {
    const { jsonl } = sessionPaths(meta.subject_id, meta.session_id);
    const available = await Sharing.isAvailableAsync();
    if (!available) {
        throw new Error("Compartilhamento indisponível neste ambiente");
    }
    await Sharing.shareAsync(jsonl, {
        mimeType: "application/jsonl",
        dialogTitle: `Sessão ${meta.session_id}`,
        UTI: "public.json",
    });
}

export async function exportMeta(meta: SessionMeta): Promise<void> {
    const { meta: metaPath } = sessionPaths(meta.subject_id, meta.session_id);
    const available = await Sharing.isAvailableAsync();
    if (!available) {
        throw new Error("Compartilhamento indisponível neste ambiente");
    }
    await Sharing.shareAsync(metaPath, {
        mimeType: "application/json",
        dialogTitle: `Meta ${meta.session_id}`,
        UTI: "public.json",
    });
}
