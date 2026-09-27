import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { getSubjectId, newUuid } from "./sessionStore";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase";

const KEY = "saifen.profile";
export const REQUIRED_ENROLLMENT_SESSIONS = 3;

export type ProfileStatus = "none" | "enrolling" | "ready";
export type ProfileSyncStatus = "local-only" | "synced" | "error";

export type ProfileState = {
    device_id: string;
    subject_id: string;
    genuine_sessions: number;
    required_sessions: number;
    status: ProfileStatus;
    last_sync: ProfileSyncStatus;
    last_sync_at: string | null;
    last_sync_error: string | null;
};

const DEFAULT_PROFILE: Omit<ProfileState, "device_id" | "subject_id"> = {
    genuine_sessions: 0,
    required_sessions: REQUIRED_ENROLLMENT_SESSIONS,
    status: "none",
    last_sync: "local-only",
    last_sync_at: null,
    last_sync_error: null,
};

async function persistLocal(next: ProfileState): Promise<void> {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

export async function loadProfile(): Promise<ProfileState> {
    const raw = await AsyncStorage.getItem(KEY);
    let parsed: Partial<ProfileState> = {};
    if (raw) {
        try {
            parsed = JSON.parse(raw) as Partial<ProfileState>;
        } catch {
            parsed = {};
        }
    }
    const subject_id = parsed.subject_id ?? (await getSubjectId());
    const device_id = parsed.device_id ?? newUuid();
    const next: ProfileState = {
        ...DEFAULT_PROFILE,
        ...parsed,
        subject_id,
        device_id,
    };
    if (!parsed.device_id || !raw) {
        await persistLocal(next);
    }
    return next;
}

export async function saveProfile(next: ProfileState): Promise<ProfileState> {
    await persistLocal(next);
    const synced = await syncProfileToSupabase(next);
    await persistLocal(synced);
    return synced;
}

export async function recordGenuineSession(): Promise<ProfileState> {
    const cur = await loadProfile();
    const genuine = cur.genuine_sessions + 1;
    const status: ProfileStatus = genuine >= cur.required_sessions ? "ready" : "enrolling";
    return saveProfile({ ...cur, genuine_sessions: genuine, status });
}

export async function syncProfileToSupabase(profile: ProfileState): Promise<ProfileState> {
    if (!isSupabaseConfigured()) {
        return {
            ...profile,
            last_sync: "local-only",
            last_sync_error: null,
        };
    }
    const client = getSupabaseClient();
    if (!client) {
        return {
            ...profile,
            last_sync: "local-only",
            last_sync_error: null,
        };
    }
    const { error } = await client.from("behavior_profiles").upsert(
        {
            device_id: profile.device_id,
            subject_id: profile.subject_id,
            genuine_sessions: profile.genuine_sessions,
            required_sessions: profile.required_sessions,
            status: profile.status,
            platform: `${Platform.OS}@${String(Platform.Version)}`,
            updated_at: new Date().toISOString(),
        },
        { onConflict: "device_id" }
    );
    if (error) {
        return {
            ...profile,
            last_sync: "error",
            last_sync_at: new Date().toISOString(),
            last_sync_error: error.message,
        };
    }
    return {
        ...profile,
        last_sync: "synced",
        last_sync_at: new Date().toISOString(),
        last_sync_error: null,
    };
}
