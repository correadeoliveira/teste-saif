// ═══════════════════════════════════════════════════
// SAIFEN — SupabaseClient (web)
//
// Stub: lazy-load do @supabase/supabase-js via CDN/ESM apenas
// quando o feature flag USE_SUPABASE estiver ligado.
//
// Hoje todas as funções devolvem `null` (fallback) — o frontend
// continua funcionando com os JSONs estáticos de shared/heatmaps/.
// ═══════════════════════════════════════════════════

import { ENV, isSupabaseConfigured } from '../config/env.js';

let _clientPromise = null;

async function getClient() {
    if (!isSupabaseConfigured()) return null;
    if (_clientPromise) return _clientPromise;

    _clientPromise = import('https://esm.sh/@supabase/supabase-js@2')
        .then((mod) => mod.createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY))
        .catch((err) => {
            console.warn('[SupabaseClient] Falha ao carregar lib:', err);
            _clientPromise = null;
            return null;
        });
    return _clientPromise;
}

/**
 * Busca a grade KDE no Supabase (RPC `get_heatmap_grid`).
 * Retorna null se não configurado ou em caso de erro — o caller
 * deve fazer fallback para /shared/heatmaps/heatmap_grid.geojson.
 */
export async function fetchHeatmapGrid({ crimeType = 'all' } = {}) {
    const client = await getClient();
    if (!client) return null;

    try {
        const { data, error } = await client.rpc('get_heatmap_grid', {
            p_crime_type: crimeType,
        });
        if (error) throw error;
        return data;
    } catch (err) {
        console.warn('[SupabaseClient] get_heatmap_grid falhou:', err);
        return null;
    }
}

/**
 * Inscreve em mudanças realtime na tabela `crimes` (futuro:
 * usado pelo app mobile para emitir BOs em tempo real, e o web
 * reflete acendendo a célula correspondente).
 */
export async function subscribeToCrimeStream(onInsert) {
    const client = await getClient();
    if (!client) return null;
    return client
        .channel('crimes-stream')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crimes' }, onInsert)
        .subscribe();
}
