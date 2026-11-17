type Operation = "heatmap_load" | "heatmap_cache" | "zone_evaluate" | "panic_report" | "panic_flush" | "imu_verify";
type Outcome = "ok" | "fallback" | "error" | "queued" | "unavailable";
type Source = "supabase" | "static" | "cache" | "demo" | "unknown";

export function logOperation(
    event: Operation,
    outcome: Outcome,
    fields: { durationMs?: number; count?: number; source?: Source } = {}
): void {
    console.info(JSON.stringify({
        event, outcome, source: fields.source, count: fields.count,
        duration_ms: fields.durationMs,
    }));
}
