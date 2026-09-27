import React from "react";
import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";

import { CrtButton, screenStyles } from "../components/Crt";
import type { SensorsNav } from "../navigation/types";

type Nav = SensorsNav<"SensorsHome">;

export function HomeScreen() {
    const nav = useNavigation<Nav>();
    return (
        <View style={screenStyles.root}>
            <Text style={screenStyles.title}>SAIFEN · SENSORES</Text>
            <Text style={screenStyles.body}>
                Reconhecimento comportamental por IMU. Offline no MVP. O mapa fica na
                outra aba.
            </Text>
            <CrtButton label="TEST SENSORS" onPress={() => nav.navigate("SensorTest")} />
            <CrtButton label="ENROLLMENT" onPress={() => nav.navigate("Enrollment")} />
            <CrtButton label="VERIFICATION" onPress={() => nav.navigate("Verification")} />
            <CrtButton label="DEBUG" onPress={() => nav.navigate("Debug")} />
            <Text style={screenStyles.dim}>
                Enrollment grava sessões genuine no device. O treino LR roda no host; o app
                infere com model.json bundled.
            </Text>
        </View>
    );
}
