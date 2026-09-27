import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/colors";

export function CrtButton({
    label,
    onPress,
    disabled,
    danger,
}: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    danger?: boolean;
}) {
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            style={({ pressed }) => [
                styles.btn,
                danger && styles.btnDanger,
                disabled && styles.btnDisabled,
                pressed && !disabled && styles.btnPressed,
            ]}
        >
            <Text style={[styles.btnText, danger && styles.btnTextDanger]}>{label}</Text>
        </Pressable>
    );
}

export function Hud({ title, lines }: { title: string; lines: string[] }) {
    return (
        <View style={styles.hud}>
            <Text style={styles.hudTitle}>{title}</Text>
            {lines.map((line) => (
                <Text key={line} style={styles.hudLine}>
                    {line}
                </Text>
            ))}
        </View>
    );
}

export const screenStyles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg, padding: 16, gap: 12 },
    title: {
        color: colors.crtGreen,
        fontFamily: "monospace",
        fontSize: 16,
        letterSpacing: 2,
        marginTop: 24,
    },
    body: {
        color: colors.textPrimary,
        fontFamily: "monospace",
        fontSize: 13,
        lineHeight: 20,
    },
    dim: {
        color: colors.textDim,
        fontFamily: "monospace",
        fontSize: 12,
        lineHeight: 18,
    },
});

const styles = StyleSheet.create({
    btn: {
        borderWidth: 1,
        borderColor: colors.crtGreen,
        paddingVertical: 12,
        paddingHorizontal: 14,
        alignItems: "center",
    },
    btnDanger: { borderColor: colors.danger },
    btnDisabled: { opacity: 0.35 },
    btnPressed: { backgroundColor: "rgba(0,255,159,0.12)" },
    btnText: {
        color: colors.crtGreen,
        fontFamily: "monospace",
        letterSpacing: 1.5,
        fontSize: 13,
    },
    btnTextDanger: { color: colors.danger },
    hud: {
        borderWidth: 1,
        borderColor: colors.accentDim,
        backgroundColor: "rgba(0,0,0,0.7)",
        padding: 12,
        gap: 4,
    },
    hudTitle: {
        color: colors.crtGreen,
        fontFamily: "monospace",
        fontSize: 12,
        letterSpacing: 2,
        marginBottom: 4,
    },
    hudLine: {
        color: colors.textPrimary,
        fontFamily: "monospace",
        fontSize: 11,
    },
});
