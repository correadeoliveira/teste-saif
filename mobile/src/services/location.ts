/**
 * SAIFEN — Location service (mobile)
 *
 * Wrapper sobre expo-location com semântica simples:
 *   - requestPermission() : retorna true/false (não joga exceção)
 *   - getCurrent()        : posição atual (ou null se sem permissão/timeout)
 *   - watch(cb, opts)     : streaming (devolve `unsubscribe`)
 */
import * as Location from "expo-location";

export type Coords = { lat: number; lng: number; accuracy: number | null };

const SP_FALLBACK: Coords = { lat: -23.5505, lng: -46.6333, accuracy: null };

export async function requestPermission(): Promise<boolean> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === "granted";
}

export async function getCurrent(): Promise<Coords> {
    const granted = await requestPermission();
    if (!granted) return SP_FALLBACK;
    try {
        const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
        });
        return {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
        };
    } catch {
        return SP_FALLBACK;
    }
}

export function watch(
    onUpdate: (c: Coords) => void,
    opts: { distanceInterval?: number; timeInterval?: number } = {}
): () => void {
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
        const granted = await requestPermission();
        if (!granted || cancelled) return;
        sub = await Location.watchPositionAsync(
            {
                accuracy: Location.Accuracy.Balanced,
                distanceInterval: opts.distanceInterval ?? 25,
                timeInterval: opts.timeInterval ?? 10_000,
            },
            (pos) => {
                onUpdate({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                });
            }
        );
    })();

    return () => {
        cancelled = true;
        sub?.remove();
    };
}
