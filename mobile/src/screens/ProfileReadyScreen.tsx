import React from "react";
import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { CrtButton, screenStyles } from "../components/Crt";
import type { RootStackParamList } from "../navigation/types";
import { modelVersion } from "../services/modelLoader";

type Nav = NativeStackNavigationProp<RootStackParamList, "ProfileReady">;

export function ProfileReadyScreen() {
    const nav = useNavigation<Nav>();
    return (
        <View style={screenStyles.root}>
            <Text style={screenStyles.title}>PROFILE READY</Text>
            <Text style={screenStyles.body}>
                Sessões genuine suficientes no device. Exporte os JSONL para o host e rode
                `make -C pipeline/behavior train && make -C pipeline/behavior export-model`.
            </Text>
            <Text style={screenStyles.dim}>
                Modelo bundled no app: {modelVersion()}. Verification usa esse artefato até
                você substituí-lo após o treino no host.
            </Text>
            <CrtButton label="VERIFICATION" onPress={() => nav.navigate("Verification")} />
            <CrtButton label="TEST SENSORS / EXPORT" onPress={() => nav.navigate("SensorTest")} />
            <CrtButton label="HOME" onPress={() => nav.navigate("Home")} />
        </View>
    );
}
