import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/colors";
import { CrtButton } from "./Crt";
import type { CrimeType, PanicResult } from "../services/crimes";
import { reportPanic } from "../services/crimes";
import type { Coords } from "../services/location";

const TYPES: CrimeType[] = ["outros", "furto", "roubo"];

export function PanicButton({ coords }: { coords: Coords | null }) {
    const [open, setOpen] = useState(false);
    const [crimeType, setCrimeType] = useState<CrimeType>("outros");
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<PanicResult | null>(null);

    const onSend = async () => {
        if (!coords || busy) return;
        setBusy(true);
        const next = await reportPanic({
            lat: coords.lat,
            lng: coords.lng,
            crimeType,
        });
        setResult(next);
        setBusy(false);
    };

    const close = () => {
        setOpen(false);
        setResult(null);
        setBusy(false);
        setCrimeType("outros");
    };

    return (
        <>
            <Pressable
                onPress={() => setOpen(true)}
                style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
                accessibilityLabel="Botão de pânico"
            >
                <Text style={styles.fabText}>PÂNICO</Text>
            </Pressable>

            <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
                <View style={styles.backdrop}>
                    <View style={styles.sheet}>
                        <Text style={styles.title}>REPORTAR BO</Text>
                        <Text style={styles.body}>
                            Envia um boletim com o GPS atual. Use só em emergência real.
                        </Text>
                        <Text style={styles.dim}>
                            GPS:{" "}
                            {coords
                                ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
                                : "indisponível"}
                        </Text>
                        <View style={styles.types}>
                            {TYPES.map((t) => (
                                <Pressable
                                    key={t}
                                    onPress={() => setCrimeType(t)}
                                    style={[styles.chip, crimeType === t && styles.chipOn]}
                                >
                                    <Text style={[styles.chipText, crimeType === t && styles.chipTextOn]}>
                                        {t.toUpperCase()}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                        {result ? (
                            <Text style={[styles.body, { color: result.ok ? colors.crtGreen : colors.danger }]}>
                                {result.ok
                                    ? result.queued
                                        ? `Fila local ${result.bo_number}`
                                        : `BO ${result.bo_number}`
                                    : result.error === "rate_limited"
                                      ? `Aguarde ${result.retry_after_sec ?? 120}s`
                                      : result.error}
                            </Text>
                        ) : null}
                        <CrtButton
                            label={busy ? "ENVIANDO…" : "ENVIAR BO"}
                            danger
                            disabled={!coords || busy || result?.ok === true}
                            onPress={() => void onSend()}
                        />
                        <CrtButton label="CANCELAR" onPress={close} />
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    fab: {
        position: "absolute",
        right: 16,
        bottom: 16,
        borderWidth: 1,
        borderColor: colors.danger,
        backgroundColor: "rgba(0,0,0,0.82)",
        paddingVertical: 14,
        paddingHorizontal: 16,
        minWidth: 96,
        alignItems: "center",
    },
    fabPressed: { backgroundColor: "rgba(255,84,84,0.18)" },
    fabText: {
        color: colors.danger,
        fontFamily: "monospace",
        letterSpacing: 2,
        fontSize: 13,
    },
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.72)",
        justifyContent: "flex-end",
        padding: 16,
    },
    sheet: {
        backgroundColor: colors.bg,
        borderWidth: 1,
        borderColor: colors.danger,
        padding: 16,
        gap: 10,
    },
    title: {
        color: colors.danger,
        fontFamily: "monospace",
        fontSize: 14,
        letterSpacing: 2,
    },
    body: {
        color: colors.textPrimary,
        fontFamily: "monospace",
        fontSize: 12,
        lineHeight: 18,
    },
    dim: {
        color: colors.textDim,
        fontFamily: "monospace",
        fontSize: 11,
    },
    types: { flexDirection: "row", gap: 8 },
    chip: {
        borderWidth: 1,
        borderColor: colors.accentDim,
        paddingVertical: 6,
        paddingHorizontal: 10,
    },
    chipOn: { borderColor: colors.crtGreen, backgroundColor: "rgba(0,255,159,0.12)" },
    chipText: { color: colors.textDim, fontFamily: "monospace", fontSize: 11 },
    chipTextOn: { color: colors.crtGreen },
});
