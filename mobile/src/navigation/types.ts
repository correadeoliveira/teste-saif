import type { ImuSample, SessionLabel } from "../services/types";

export type RootStackParamList = {
    Home: undefined;
    Map: undefined;
    SensorTest: undefined;
    Enrollment: undefined;
    Collecting: { purpose: "enrollment" | "verification" | "test"; label: SessionLabel };
    ProfileReady: undefined;
    Verification: undefined;
    Result: { samples: ImuSample[] };
    Debug: undefined;
};
