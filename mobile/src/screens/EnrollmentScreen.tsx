import React, { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { CrtButton, Hud, screenStyles } from "../components/Crt";
import type { SensorsStackParamList } from "../navigation/types";
import {
    loadProfile,
    REQUIRED_ENROLLMENT_SESSIONS,
    saveProfile,
    type ProfileState,
} from "../services/profileStore";

type Nav = NativeStackNavigationProp<SensorsStackParamList, "Enrollment">;

export function EnrollmentScreen() {
    const nav = useNavigation<Nav>();
    const [profile, setProfile] = useState<ProfileState | null>(null);

    const refresh = useCallback(() => {
        loadProfile().then(setProfile);
    }, []);

    useFocusEffect(
        useCallback(() => {
            refresh();
        }, [refresh])
    );

    const onSync = async () => {
        const cur = await loadProfile();
        setProfile(await saveProfile(cur));
    };

    const n = profile?.genuine_sessions ?? 0;
    const required = profile?.required_sessions ?? REQUIRED_ENROLLMENT_SESSIONS;
    const ready = (profile?.status ?? "none") === "ready";

    return (
        <View style={screenStyles.root}>
            <Text style={screenStyles.title}>ENROLLMENT</Text>
            <Text style={screenStyles.body}>
                Grave {required} sessões de 10s com o telefone na sua mão (padrão genuine). O
                treino do Logistic Regression acontece no host; o app só coleta.
            </Text>
            <Hud
                title="PROFILE"
                lines={[
                    `subject: ${profile?.subject_id ?? "…"}`,
                    `device: ${profile?.device_id ?? "…"}`,
                    `sessões genuine: ${n} / ${required}`,
                    `status: ${profile?.status ?? "…"}`,
                    `supabase: ${profile?.last_sync ?? "…"}`,
                    profile?.last_sync_error
                        ? profile.last_sync_error
                        : ready
                          ? "Perfil pronto (JSONL local; cupom no Supabase se configurado)."
                          : "Continue coletando até completar o cupom de enrollment.",
                ]}
            />
            <CrtButton label="SYNC SUPABASE" onPress={() => void onSync()} />
            <CrtButton
                label="COLETAR SESSÃO"
                onPress={() => nav.navigate("Collecting", { purpose: "enrollment", label: "genuine" })}
                disabled={ready}
            />
            <CrtButton
                label="COLETAR IMPOSTOR (opcional)"
                onPress={() => nav.navigate("Collecting", { purpose: "enrollment", label: "impostor" })}
            />
            {ready ? (
                <CrtButton label="PROFILE READY" onPress={() => nav.navigate("ProfileReady")} />
            ) : null}
        </View>
    );
}
