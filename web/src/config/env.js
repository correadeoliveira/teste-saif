// ═══════════════════════════════════════════════════
// SAIFEN — Web env config
//
// Variáveis runtime. Em produção, substitua durante o build
// (Vercel/Netlify env vars) ou injete via <meta> tag no index.html.
//
// Convenção: tudo que começa com SUPABASE_ é PUBLIC (anon key).
// NUNCA exponha service_role aqui.
// ═══════════════════════════════════════════════════

export const ENV = {
    // Deixe vazio para forçar fallback no /shared/heatmaps/*.json
    SUPABASE_URL:      window.__SAIFEN_SUPABASE_URL__      || '',
    SUPABASE_ANON_KEY: window.__SAIFEN_SUPABASE_ANON_KEY__ || '',

    // Path base dos artefatos estáticos servidos pelo monorepo
    SHARED_HEATMAPS_BASE: '/shared/heatmaps',
    SHARED_SUMMARY_PATH:  '/shared/summary.json',

    // Feature flags
    USE_SUPABASE:        false,   // bata pra true quando RPCs estiverem prontas
    USE_MAPBOX:          false,   // troca Leaflet → Mapbox GL JS
};

export const isSupabaseConfigured = () =>
    Boolean(ENV.USE_SUPABASE && ENV.SUPABASE_URL && ENV.SUPABASE_ANON_KEY);
