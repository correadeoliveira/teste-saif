import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView, StyleSheet } from "react-native";

import { MapScreen } from "./src/screens/MapScreen";
import { colors } from "./src/theme/colors";

export default function App() {
    return (
        <SafeAreaView style={styles.root}>
            <StatusBar style="light" />
            <MapScreen />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
});
