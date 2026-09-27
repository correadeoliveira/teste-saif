import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";

import { CrtButton, screenStyles } from "../components/Crt";
import type { SensorsNav } from "../navigation/types";
import { loadProfile, type ProfileState } from "../services/profileStore";
import { modelVersion } from "../services/modelLoader";

type Nav = SensorsNav<"ProfileReady">;

export function ProfileReadyScreen() {
    const nav = useNavigation<Nav>();
    const [profile, setProfile] = useState<ProfileState | null>(null);

    useEffect(() => {
        loadProfile().then(setProfile);
    }, []);

    return (
        <View style={screenStyles.root}>
            <Text style={screenStyles.title}>PROFILE READY</Text>
            <Text style={screenStyles.body}>
                Sessões genuine suficientes no device. O cupom de perfil (device_id,
                sessões, status) tenta ir para Supabase `behavior_profiles`. O JSONL
                IMU continua só no aparelho — exporte para o Mac se for treinar.
            </Text>
            <Text style={screenStyles.dim}>
                supabase: {profile?.last_sync ?? "…"}
                {profile?.last_sync_error ? ` · ${profile.last_sync_error}` : ""}
            </Text>
            <Text style={screenStyles.dim}>
                Modelo bundled no app: {modelVersion()}. Verification usa esse artefato até
                você substituí-lo após `make -C pipeline/behavior train && make -C
                pipeline/behavior export-model`.
            </Text>
            <CrtButton label="VERIFICATION" onPress={() => nav.navigate("Verification")} />
            <CrtButton label="TEST SENSORS / EXPORT" onPress={() => nav.navigate("SensorTest")} />
            <CrtButton label="MAPA" onPress={() => nav.navigate("Map")} />
        </View>
    );
}
