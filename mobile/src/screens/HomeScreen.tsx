import React from "react";
import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { CrtButton, screenStyles } from "../components/Crt";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList, "Home">;

export function HomeScreen() {
    const nav = useNavigation<Nav>();
    return (
        <View style={screenStyles.root}>
            <Text style={screenStyles.title}>SAIFEN · HOME</Text>
            <Text style={screenStyles.body}>
                Mapa de risco urbano + reconhecimento comportamental por IMU. Offline no MVP.
            </Text>
            <CrtButton label="MAPA" onPress={() => nav.navigate("Map")} />
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
