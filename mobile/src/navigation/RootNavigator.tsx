import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
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
import type { RootTabParamList, SensorsStackParamList } from "./types";

export type { RootTabParamList, SensorsStackParamList } from "./types";

const Tab = createBottomTabNavigator<RootTabParamList>();
const SensorsStack = createNativeStackNavigator<SensorsStackParamList>();

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

const stackScreenOptions = {
    headerStyle: { backgroundColor: colors.bg },
    headerTintColor: colors.crtGreen,
    headerTitleStyle: { fontFamily: "monospace" as const },
    contentStyle: { backgroundColor: colors.bg },
};

function SensorsNavigator() {
    return (
        <SensorsStack.Navigator initialRouteName="SensorsHome" screenOptions={stackScreenOptions}>
            <SensorsStack.Screen
                name="SensorsHome"
                component={HomeScreen}
                options={{ title: "Sensores" }}
            />
            <SensorsStack.Screen
                name="SensorTest"
                component={SensorTestScreen}
                options={{ title: "Test Sensors" }}
            />
            <SensorsStack.Screen name="Enrollment" component={EnrollmentScreen} />
            <SensorsStack.Screen name="Collecting" component={CollectingScreen} />
            <SensorsStack.Screen
                name="ProfileReady"
                component={ProfileReadyScreen}
                options={{ title: "Profile Ready" }}
            />
            <SensorsStack.Screen name="Verification" component={VerificationScreen} />
            <SensorsStack.Screen name="Result" component={ResultScreen} />
            <SensorsStack.Screen name="Debug" component={DebugScreen} />
        </SensorsStack.Navigator>
    );
}

export function RootNavigator() {
    return (
        <NavigationContainer theme={navTheme}>
            <Tab.Navigator
                initialRouteName="Map"
                screenOptions={({ route }) => ({
                    headerShown: false,
                    tabBarActiveTintColor: colors.crtGreen,
                    tabBarInactiveTintColor: colors.textDim,
                    tabBarStyle: {
                        backgroundColor: colors.bg,
                        borderTopColor: colors.accentDim,
                    },
                    tabBarLabelStyle: {
                        fontFamily: "monospace",
                        fontSize: 10,
                        letterSpacing: 1,
                    },
                    tabBarIcon: ({ color, size, focused }) => {
                        const icons = {
                            Map: focused ? "map" : "map-outline",
                            Sensors: focused ? "pulse" : "pulse-outline",
                        } as const;
                        return <Ionicons name={icons[route.name]} size={size} color={color} />;
                    },
                })}
            >
                <Tab.Screen name="Map" component={MapScreen} options={{ tabBarLabel: "MAPA" }} />
                <Tab.Screen
                    name="Sensors"
                    component={SensorsNavigator}
                    options={{ tabBarLabel: "SENSORES" }}
                />
            </Tab.Navigator>
        </NavigationContainer>
    );
}
