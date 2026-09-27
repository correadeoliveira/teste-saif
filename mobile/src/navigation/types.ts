import type { CompositeNavigationProp, NavigatorScreenParams } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { ImuSample, SessionLabel } from "../services/types";

export type SensorsStackParamList = {
    SensorsHome: undefined;
    SensorTest: undefined;
    Enrollment: undefined;
    Collecting: { purpose: "enrollment" | "verification" | "test"; label: SessionLabel };
    ProfileReady: undefined;
    Verification: undefined;
    Result: { samples: ImuSample[] };
    Debug: undefined;
};

export type RootTabParamList = {
    Map: undefined;
    Sensors: NavigatorScreenParams<SensorsStackParamList> | undefined;
};

export type SensorsNav<Route extends keyof SensorsStackParamList> = CompositeNavigationProp<
    NativeStackNavigationProp<SensorsStackParamList, Route>,
    BottomTabNavigationProp<RootTabParamList>
>;
