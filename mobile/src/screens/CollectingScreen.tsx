import React, { useCallback, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { CrtButton, Hud, screenStyles } from "../components/Crt";
import { useSensorStream } from "../hooks/useSensorStream";
import type { RootStackParamList } from "../navigation/types";
import { effectiveHz } from "../services/imuMerge";
import { recordGenuineSession } from "../services/profileStore";
import { finalizeRecording } from "../services/recorder";
import { generateSyntheticImu } from "../services/syntheticImu";
import type { ImuSample, SessionLabel } from "../services/types";
import { DEFAULT_CAPTURE_MS, TARGET_HZ } from "../services/types";

type Nav = NativeStackNavigationProp<RootStackParamList, "Collecting">;
type R = RouteProp<RootStackParamList, "Collecting">;

export function CollectingScreen() {
    const nav = useNavigation<Nav>();
    const { params } = useRoute<R>();
    const label: SessionLabel = params?.label ?? "genuine";
    const purpose = params?.purpose ?? "enrollment";
    const [done, setDone] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [count, setCount] = useState(0);
    const startedAt = useRef(new Date());

    const finish = useCallback(
        async (samples: ImuSample[], started: Date, activity: string) => {
            await finalizeRecording({
                samples,
                startedAt: started,
                activity,
                label,
            });
            setCount(samples.length);
            if (purpose === "enrollment" && label === "genuine") {
                const profile = await recordGenuineSession();
                setDone(true);
                if (profile.status === "ready") {
                    nav.replace("ProfileReady");
                    return;
                }
            } else if (purpose === "verification") {
                nav.replace("Result", { samples });
                return;
            }
            setDone(true);
        },
        [label, purpose, nav]
    );

    const stream = useSensorStream({
        durationMs: DEFAULT_CAPTURE_MS,
        onComplete: (samples) => {
            void finish(samples, startedAt.current, purpose);
        },
    });

    const onStart = async () => {
        setDone(false);
        startedAt.current = new Date();
        const ok = await stream.start();
        if (!ok) setError("Sensores indisponíveis. Use SIMULAR.");
    };

    const onSimulate = async () => {
        const started = new Date();
        const samples = generateSyntheticImu(DEFAULT_CAPTURE_MS, label, TARGET_HZ, Date.now());
        await finish(samples, started, `${purpose}_sim`);
    };

    const hz = effectiveHz(stream.count, Math.max(stream.elapsedMs, 1));

    return (
        <View style={screenStyles.root}>
            <Text style={screenStyles.title}>COLLECTING</Text>
            <Text style={screenStyles.dim}>
                {purpose} · label={label} · 10s
            </Text>
            <Hud
                title="CAPTURE"
                lines={[
                    `status: ${stream.status}  n=${stream.count || count}`,
                    `t: ${(stream.elapsedMs / 1000).toFixed(1)}s  hz≈${hz.toFixed(1)}`,
                    done ? "sessão persistida" : "aguardando",
                ]}
            />
            {error ? <Text style={[screenStyles.body, { color: "#FF5454" }]}>{error}</Text> : null}
            <CrtButton
                label={stream.status === "running" ? "STOP" : "START 10s"}
                onPress={() => (stream.status === "running" ? stream.stop() : void onStart())}
                disabled={done && stream.status !== "running"}
            />
            <CrtButton label="SIMULAR 10s" onPress={() => void onSimulate()} disabled={stream.status === "running"} />
            {done && purpose === "enrollment" ? (
                <CrtButton label="VOLTAR AO ENROLLMENT" onPress={() => nav.navigate("Enrollment")} />
            ) : null}
        </View>
    );
}
