import React from "react";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { CollectingScreen } from "../screens/CollectingScreen";
import { DebugScreen } from "../screens/DebugScreen";
import { EnrollmentScreen } from "../screens/EnrollmentScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { MapScreen } from "../screens/MapScreen";
import { ProfileReadyScreen } from "../screens/ProfileReadyScreen";
import { ResultScreen } from "../screens/ResultScreen";
import { SensorTestScreen } from "../screens/SensorTestScreen";
import { VerificationScreen } from "../screens/VerificationScreen";
import { colors } from "../theme/colors";
import type { RootStackParamList } from "./types";

export type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
    ...DarkTheme,
    colors: {
        ...DarkTheme.colors,
        background: colors.bg,
        card: colors.bgSoft,
        primary: colors.crtGreen,
        text: colors.textPrimary,
        border: colors.accentDim,
    },
};

export function RootNavigator() {
    return (
        <NavigationContainer theme={navTheme}>
            <Stack.Navigator
                initialRouteName="Home"
                screenOptions={{
                    headerStyle: { backgroundColor: colors.bg },
                    headerTintColor: colors.crtGreen,
                    headerTitleStyle: { fontFamily: "monospace" },
                    contentStyle: { backgroundColor: colors.bg },
                }}
            >
                <Stack.Screen name="Home" component={HomeScreen} />
                <Stack.Screen name="Map" component={MapScreen} />
                <Stack.Screen name="SensorTest" component={SensorTestScreen} options={{ title: "Test Sensors" }} />
                <Stack.Screen name="Enrollment" component={EnrollmentScreen} />
                <Stack.Screen name="Collecting" component={CollectingScreen} />
                <Stack.Screen name="ProfileReady" component={ProfileReadyScreen} options={{ title: "Profile Ready" }} />
                <Stack.Screen name="Verification" component={VerificationScreen} />
                <Stack.Screen name="Result" component={ResultScreen} />
                <Stack.Screen name="Debug" component={DebugScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
