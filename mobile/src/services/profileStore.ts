import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "saifen.profile";
export const REQUIRED_ENROLLMENT_SESSIONS = 3;

export type ProfileStatus = "none" | "enrolling" | "ready";

export type ProfileState = {
    subject_id: string;
    genuine_sessions: number;
    required_sessions: number;
    status: ProfileStatus;
};

const DEFAULT_PROFILE: ProfileState = {
    subject_id: "local-user",
    genuine_sessions: 0,
    required_sessions: REQUIRED_ENROLLMENT_SESSIONS,
    status: "none",
};

export async function loadProfile(): Promise<ProfileState> {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    try {
        return { ...DEFAULT_PROFILE, ...(JSON.parse(raw) as ProfileState) };
    } catch {
        return { ...DEFAULT_PROFILE };
    }
}

export async function saveProfile(next: ProfileState): Promise<void> {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

export async function recordGenuineSession(): Promise<ProfileState> {
    const cur = await loadProfile();
    const genuine = cur.genuine_sessions + 1;
    const status: ProfileStatus = genuine >= cur.required_sessions ? "ready" : "enrolling";
    const next: ProfileState = { ...cur, genuine_sessions: genuine, status };
    await saveProfile(next);
    return next;
}
