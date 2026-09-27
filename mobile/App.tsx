import React, { useEffect } from "react";
import { Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import "./src/tasks/locationTask";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { startZoneMonitor } from "./src/services/zoneMonitor";

export default function App() {
    useEffect(() => {
        if (Platform.OS === "web") return;
        void startZoneMonitor();
    }, []);

    return (
        <SafeAreaProvider>
            <StatusBar style="light" />
            <RootNavigator />
        </SafeAreaProvider>
    );
}
