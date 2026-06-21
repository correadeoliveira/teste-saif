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

export const env: Env = {
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

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
    if (_client) return _client;
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;

    _client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
        auth: {
            storage: AsyncStorage,
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
        },
    });
    return _client;
}

export const isSupabaseConfigured = () =>
    Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
