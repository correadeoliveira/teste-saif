import { Platform } from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import { handleLocationSample } from "../services/zoneEngine";

export const LOCATION_TASK = "SAIFEN_LOCATION_TASK";

type TaskPayload = {
    locations?: Location.LocationObject[];
};

if (Platform.OS !== "web") {
    TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
        if (error) return;
        const locations = (data as TaskPayload | undefined)?.locations;
        const last = locations?.[locations.length - 1];
        if (!last) return;
        await handleLocationSample({
            lat: last.coords.latitude,
            lng: last.coords.longitude,
        });
    });
}
