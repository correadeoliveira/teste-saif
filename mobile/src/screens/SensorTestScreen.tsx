import React, { useCallback, useState } from "react";
import { Text, View } from "react-native";

import { CrtButton, Hud, screenStyles } from "../components/Crt";
import { useSensorStream } from "../hooks/useSensorStream";
import { finalizeRecording } from "../services/recorder";
import { exportMeta, exportSession } from "../services/sessionStore";
import { generateSyntheticImu } from "../services/syntheticImu";
import type { ImuSample, SessionMeta } from "../services/types";
import { DEFAULT_CAPTURE_MS, TARGET_HZ } from "../services/types";
import { effectiveHz } from "../services/imuMerge";

export function SensorTestScreen() {
    const [saved, setSaved] = useState<SessionMeta | null>(null);
    const [error, setError] = useState<string | null>(null);
    const startedAt = React.useRef<Date>(new Date());

    const persist = useCallback(async (samples: ImuSample[], started: Date, activity: string) => {
        setError(null);
        const meta = await finalizeRecording({
            samples,
            startedAt: started,
            activity,
            label: "unlabeled",
        });
        setSaved(meta);
    }, []);

    const stream = useSensorStream({
        durationMs: DEFAULT_CAPTURE_MS,
        onComplete: (samples) => {
            void persist(samples, startedAt.current, "sensor_test");
        },
    });

    const onStart = async () => {
        setSaved(null);
        startedAt.current = new Date();
        const ok = await stream.start();
        if (!ok) setError("Sensores indisponíveis. Use SIMULAR 10s no simulador.");
    };

    const onSimulate = async () => {
        setError(null);
        setSaved(null);
        const started = new Date();
        const samples = generateSyntheticImu(DEFAULT_CAPTURE_MS, "genuine", TARGET_HZ, Date.now());
        await persist(samples, started, "sensor_test_sim");
    };

    const hz = effectiveHz(stream.count, Math.max(stream.elapsedMs, 1));
    const live = stream.live;

    return (
        <View style={screenStyles.root}>
            <Text style={screenStyles.title}>TEST SENSORS</Text>
            <Text style={screenStyles.dim}>
                Start captura accel+gyro por 10s (~{TARGET_HZ} Hz) e grava JSONL local.
            </Text>
            <Hud
                title="IMU"
                lines={[
                    `status: ${stream.status}  samples: ${stream.count}`,
                    `t: ${(stream.elapsedMs / 1000).toFixed(1)}s / 10.0s  hz≈${hz.toFixed(1)}`,
                    live
                        ? `a ${live.ax.toFixed(2)} ${live.ay.toFixed(2)} ${live.az.toFixed(2)}`
                        : "a —",
                    live
                        ? `g ${live.gx.toFixed(2)} ${live.gy.toFixed(2)} ${live.gz.toFixed(2)}`
                        : "g —",
                    saved
                        ? `saved ${saved.n_samples} @ ${saved.sample_rate_effective_hz.toFixed(1)}Hz`
                        : "saved —",
                    saved ? saved.path_jsonl ?? saved.session_id : "",
                ]}
            />
            {error ? <Text style={[screenStyles.body, { color: "#FF5454" }]}>{error}</Text> : null}
            <CrtButton
                label={stream.status === "running" ? "STOP" : "START 10s"}
                onPress={() => (stream.status === "running" ? stream.stop() : void onStart())}
            />
            <CrtButton label="SIMULAR 10s" onPress={() => void onSimulate()} disabled={stream.status === "running"} />
            <CrtButton
                label="EXPORT JSONL"
                onPress={() => saved && exportSession(saved).catch((e: Error) => setError(e.message))}
                disabled={!saved}
            />
            <CrtButton
                label="EXPORT META"
                onPress={() => saved && exportMeta(saved).catch((e: Error) => setError(e.message))}
                disabled={!saved}
            />
        </View>
    );
}
