import React, { useMemo, useState } from "react";
import { Text, View } from "react-native";

import { CrtButton, Hud, screenStyles } from "../components/Crt";
import { useSensorStream } from "../hooks/useSensorStream";
import { FEATURE_NAMES } from "../services/features";
import { verifySession } from "../services/inference";
import { loadBundledModel, modelVersion } from "../services/modelLoader";
import { generateSyntheticImu } from "../services/syntheticImu";
import { DEFAULT_CAPTURE_MS, TARGET_HZ, WINDOW_MS } from "../services/types";
import { effectiveHz } from "../services/imuMerge";

export function DebugScreen() {
    const model = loadBundledModel();
    const [lastScore, setLastScore] = useState<string>("—");
    const stream = useSensorStream({ durationMs: DEFAULT_CAPTURE_MS });
    const hz = effectiveHz(stream.count, Math.max(stream.elapsedMs, 1));

    const replay = () => {
        const samples = generateSyntheticImu(DEFAULT_CAPTURE_MS, "genuine", TARGET_HZ, 7);
        const r = verifySession(samples, model);
        setLastScore(`${r.score.toFixed(4)} accept=${r.accept} win=${r.n_windows} ${r.latency_ms}ms`);
    };

    const liveLine = useMemo(() => {
        const s = stream.live;
        if (!s) return "imu —";
        return `a ${s.ax.toFixed(2)} ${s.ay.toFixed(2)} ${s.az.toFixed(2)}  g ${s.gx.toFixed(2)} ${s.gy.toFixed(2)} ${s.gz.toFixed(2)}`;
    }, [stream.live]);

    return (
        <View style={screenStyles.root}>
            <Text style={screenStyles.title}>DEBUG</Text>
            <Hud
                title="RUNTIME"
                lines={[
                    `model: ${modelVersion()}  type: ${model.type}`,
                    `target_hz: ${TARGET_HZ}  window_ms: ${WINDOW_MS}  features: ${FEATURE_NAMES.length}`,
                    `live_hz≈${hz.toFixed(1)}  samples: ${stream.count}`,
                    liveLine,
                    `last_score: ${lastScore}`,
                    `threshold: ${model.threshold}`,
                ]}
            />
            <CrtButton
                label={stream.status === "running" ? "STOP LIVE" : "LIVE SENSORS"}
                onPress={() => (stream.status === "running" ? stream.stop() : void stream.start())}
            />
            <CrtButton label="REPLAY SYNTHETIC → SCORE" onPress={replay} />
        </View>
    );
}
