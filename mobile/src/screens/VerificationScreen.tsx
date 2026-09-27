import React from "react";
import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { CrtButton, screenStyles } from "../components/Crt";
import type { RootStackParamList } from "../navigation/types";
import { modelVersion } from "../services/modelLoader";

type Nav = NativeStackNavigationProp<RootStackParamList, "Verification">;

export function VerificationScreen() {
    const nav = useNavigation<Nav>();
    return (
        <View style={screenStyles.root}>
            <Text style={screenStyles.title}>VERIFICATION</Text>
            <Text style={screenStyles.body}>
                10s de IMU → janelas → features → Logistic Regression local. Offline.
            </Text>
            <Text style={screenStyles.dim}>model.json {modelVersion()}</Text>
            <CrtButton
                label="CAPTURAR 10s (GENUINE)"
                onPress={() => nav.navigate("Collecting", { purpose: "verification", label: "genuine" })}
            />
            <CrtButton
                label="CAPTURAR 10s (IMPOSTOR)"
                onPress={() => nav.navigate("Collecting", { purpose: "verification", label: "impostor" })}
            />
        </View>
    );
}
