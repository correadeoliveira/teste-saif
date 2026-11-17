/** Local diagnostics use only known operations, outcomes, and source names. */
export function logHeatmap(source, count, durationMs, fallback = false) {
    console.info(JSON.stringify({
        event: 'heatmap.load',
        source,
        outcome: fallback ? 'fallback' : 'ok',
        count,
        duration_ms: Math.round(durationMs),
    }));
}
