import React, { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { CrtButton, Hud, screenStyles } from "../components/Crt";
import type { RootStackParamList } from "../navigation/types";
import { loadProfile, REQUIRED_ENROLLMENT_SESSIONS, type ProfileState } from "../services/profileStore";

type Nav = NativeStackNavigationProp<RootStackParamList, "Enrollment">;

export function EnrollmentScreen() {
    const nav = useNavigation<Nav>();
    const [profile, setProfile] = useState<ProfileState | null>(null);

    const refresh = useCallback(() => {
        loadProfile().then(setProfile);
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

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
                    `sessões genuine: ${n} / ${required}`,
                    `status: ${profile?.status ?? "…"}`,
                    ready
                        ? "Perfil pronto para verification (modelo bundled + dados locais)."
                        : "Continue coletando até completar o cupom de enrollment.",
                ]}
            />
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
