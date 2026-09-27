import { useCallback, useEffect, useRef, useState } from "react";

import { startSensorStream, sensorsAvailable } from "../services/sensors";
import type { ImuSample } from "../services/types";
import { DEFAULT_CAPTURE_MS } from "../services/types";

export type StreamStatus = "idle" | "running" | "unavailable";

export function useSensorStream(opts?: { durationMs?: number; onComplete?: (samples: ImuSample[]) => void }) {
    const durationMs = opts?.durationMs ?? DEFAULT_CAPTURE_MS;
    const [status, setStatus] = useState<StreamStatus>("idle");
    const [samples, setSamples] = useState<ImuSample[]>([]);
    const [live, setLive] = useState<ImuSample | null>(null);
    const [elapsedMs, setElapsedMs] = useState(0);
    const unsub = useRef<null | (() => void)>(null);
    const buffer = useRef<ImuSample[]>([]);
    const startedAt = useRef<number>(0);
    const onCompleteRef = useRef(opts?.onComplete);

    useEffect(() => {
        onCompleteRef.current = opts?.onComplete;
    }, [opts?.onComplete]);

    const stop = useCallback(() => {
        unsub.current?.();
        unsub.current = null;
        setStatus("idle");
        setElapsedMs(Date.now() - startedAt.current);
    }, []);

    const start = useCallback(async () => {
        const avail = await sensorsAvailable();
        if (!avail.accel) {
            setStatus("unavailable");
            return false;
        }
        buffer.current = [];
        setSamples([]);
        setLive(null);
        startedAt.current = Date.now();
        setElapsedMs(0);
        setStatus("running");
        unsub.current = await startSensorStream((sample) => {
            buffer.current.push(sample);
            setLive(sample);
            setSamples(buffer.current.slice());
            setElapsedMs(Date.now() - startedAt.current);
        });
        return true;
    }, []);

    useEffect(() => {
        if (status !== "running") return;
        const id = setInterval(() => {
            const elapsed = Date.now() - startedAt.current;
            setElapsedMs(elapsed);
            if (elapsed >= durationMs) {
                const captured = buffer.current.slice();
                stop();
                onCompleteRef.current?.(captured);
            }
        }, 100);
        return () => clearInterval(id);
    }, [status, durationMs, stop]);

    useEffect(() => () => unsub.current?.(), []);

    return {
        status,
        samples,
        live,
        elapsedMs,
        count: samples.length,
        start,
        stop,
    };
}
