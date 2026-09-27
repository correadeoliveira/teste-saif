import { Platform } from "react-native";
import * as Location from "expo-location";

import { flushPanicQueue } from "./crimes";
import { loadHeatmap, persistHotspots } from "./heatmap";
import { getCurrent, requestBackgroundPermission, requestPermission, watch } from "./location";
import { configureNotifications } from "./notifications";
import { LOCATION_TASK } from "../tasks/locationTask";
import { handleLocationSample } from "./zoneEngine";

export type MonitorMode = "background" | "foreground" | "off";

let mode: MonitorMode = "off";
let stopForeground: (() => void) | null = null;
const modeListeners = new Set<(m: MonitorMode) => void>();

export function getMonitorMode(): MonitorMode {
    return mode;
}

export function subscribeMonitorMode(listener: (m: MonitorMode) => void): () => void {
    modeListeners.add(listener);
    listener(mode);
    return () => {
        modeListeners.delete(listener);
    };
}

function setMode(next: MonitorMode): void {
    mode = next;
    modeListeners.forEach((fn) => fn(next));
}

async function cacheHeatmap(): Promise<void> {
    try {
        const heat = await loadHeatmap("all");
        await persistHotspots(heat.points);
    } catch {
        /* heatmap continua no fallback interno */
    }
}

export async function startZoneMonitor(): Promise<MonitorMode> {
    if (Platform.OS === "web") {
        setMode("off");
        return "off";
    }

    await configureNotifications();
    const granted = await requestPermission();
    if (!granted) {
        setMode("off");
        return "off";
    }

    await cacheHeatmap();
    void flushPanicQueue();

    const bg = await requestBackgroundPermission();
    if (bg) {
        try {
            const already = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
            if (!already) {
                await Location.startLocationUpdatesAsync(LOCATION_TASK, {
                    accuracy: Location.Accuracy.Balanced,
                    timeInterval: 20_000,
                    distanceInterval: 40,
                    deferredUpdatesInterval: 20_000,
                    showsBackgroundLocationIndicator: true,
                    foregroundService: {
                        notificationTitle: "SAIFEN",
                        notificationBody: "Monitorando zonas de risco",
                        notificationColor: "#00FF9F",
                    },
                });
            }
            const here = await getCurrent();
            await handleLocationSample(here);
            setMode("background");
            return "background";
        } catch {
            /* Expo Go não roda startLocationUpdatesAsync */
        }
    }

    stopForeground?.();
    stopForeground = watch((coords) => {
        void handleLocationSample(coords);
    }, { distanceInterval: 40, timeInterval: 15_000 });

    const here = await getCurrent();
    await handleLocationSample(here);
    setMode("foreground");
    return "foreground";
}

export async function stopZoneMonitor(): Promise<void> {
    stopForeground?.();
    stopForeground = null;
    try {
        const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
        if (running) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    } catch {
        /* ignore */
    }
    setMode("off");
}
