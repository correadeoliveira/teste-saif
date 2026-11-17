import React, { useMemo, useEffect } from "react";
import { Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";

import { CrtButton, Hud, screenStyles } from "../components/Crt";
import type { SensorsNav, SensorsStackParamList } from "../navigation/types";
import { verifySession } from "../services/inference";
import { logOperation } from "../services/telemetry";
import { loadBundledModel } from "../services/modelLoader";

type Nav = SensorsNav<"Result">;
type R = RouteProp<SensorsStackParamList, "Result">;

export function ResultScreen() {
    const nav = useNavigation<Nav>();
    const { params } = useRoute<R>();
    const samples = useMemo(() => params?.samples ?? [], [params?.samples]);
    const model = loadBundledModel();
    const result = useMemo(() => verifySession(samples, model), [samples, model]);
    useEffect(() => {
        logOperation("imu_verify", result.status === "ok" ? "ok" : "unavailable", {
            durationMs: result.latency_ms,
            count: result.status === "ok" ? result.n_windows : 0,
        });
    }, [result]);

    return (
        <View style={screenStyles.root}>
            <Text style={screenStyles.title}>RESULT</Text>
            <Hud
                title={result.status === "ok" ? (result.accept ? "ACCEPT" : "REJECT") : "INDISPONÍVEL"}
                lines={result.status === "ok" ? [
                    `score: ${result.score.toFixed(4)}  threshold: ${model?.threshold}`,
                    `windows: ${result.n_windows}  latency: ${result.latency_ms}ms`,
                    `samples: ${samples.length}`,
                ] : [result.reason === "invalid_model" ? "Modelo indisponível" : "Captura insuficiente"]}
            />
            <CrtButton label="NOVA VERIFICATION" onPress={() => nav.navigate("Verification")} />
            <CrtButton label="MAPA" onPress={() => nav.navigate("Map")} />
        </View>
    );
}
