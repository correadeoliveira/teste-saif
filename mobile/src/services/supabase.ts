/**
 * SAIFEN — Supabase client (mobile)
 *
 * Lazy: só instancia se EXPO_PUBLIC_SUPABASE_URL estiver definido.
 * Caso contrário, todas as funções devolvem null e o caller deve
 * cair no fallback (heatmap.ts → fetch shared/heatmaps/).
 */
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

type Env = {
    SUPABASE_URL?: string;
    SUPABASE_ANON_KEY?: string;
    SHARED_BASE?: string;
};

function readEnv(): Env {
    return {
        SUPABASE_URL:
            process.env.EXPO_PUBLIC_SUPABASE_URL ||
            Constants.expoConfig?.extra?.supabaseUrl,
        SUPABASE_ANON_KEY:
            process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
            Constants.expoConfig?.extra?.supabaseAnonKey,
        SHARED_BASE:
            process.env.EXPO_PUBLIC_SHARED_BASE ||
            Constants.expoConfig?.extra?.sharedBase,
    };
}

export const env: Env = {
    get SUPABASE_URL() {
        return readEnv().SUPABASE_URL;
    },
    get SUPABASE_ANON_KEY() {
        return readEnv().SUPABASE_ANON_KEY;
    },
    get SHARED_BASE() {
        return readEnv().SHARED_BASE;
    },
};

let _client: SupabaseClient | null = null;
let _clientKey: string | null = null;

export function getSupabaseClient(): SupabaseClient | null {
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = readEnv();
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        _client = null;
        _clientKey = null;
        return null;
    }
    const key = `${SUPABASE_URL}:${SUPABASE_ANON_KEY}`;
    if (_client && _clientKey === key) return _client;

    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            storage: AsyncStorage,
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
        },
    });
    _clientKey = key;
    return _client;
}

export const isSupabaseConfigured = () => {
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = readEnv();
    return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
};
