import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";

import { CrtButton, Hud, screenStyles } from "../components/Crt";
import type { SensorsNav, SensorsStackParamList } from "../navigation/types";
import { verifySession } from "../services/inference";
import { loadBundledModel } from "../services/modelLoader";

type Nav = SensorsNav<"Result">;
type R = RouteProp<SensorsStackParamList, "Result">;

export function ResultScreen() {
    const nav = useNavigation<Nav>();
    const { params } = useRoute<R>();
    const samples = useMemo(() => params?.samples ?? [], [params?.samples]);
    const result = useMemo(() => {
        const model = loadBundledModel();
        return verifySession(samples, model);
    }, [samples]);

    return (
        <View style={screenStyles.root}>
            <Text style={screenStyles.title}>RESULT</Text>
            <Hud
                title={result.accept ? "ACCEPT" : "REJECT"}
                lines={[
                    `score: ${result.score.toFixed(4)}  threshold: ${loadBundledModel().threshold}`,
                    `windows: ${result.n_windows}  latency: ${result.latency_ms}ms`,
                    `samples: ${samples.length}`,
                ]}
            />
            <CrtButton label="NOVA VERIFICATION" onPress={() => nav.navigate("Verification")} />
            <CrtButton label="MAPA" onPress={() => nav.navigate("Map")} />
        </View>
    );
}
