import { Accelerometer, Gyroscope } from "expo-sensors";
import { Platform } from "react-native";

import { mergeAccelWithGyro } from "./imuMerge";
import type { ImuSample, Vec3T } from "./types";
import { UPDATE_INTERVAL_MS } from "./types";

export type SensorUnsub = () => void;

export async function sensorsAvailable(): Promise<{ accel: boolean; gyro: boolean }> {
    const [accel, gyro] = await Promise.all([
        Accelerometer.isAvailableAsync(),
        Gyroscope.isAvailableAsync(),
    ]);
    return { accel, gyro };
}

/**
 * Stream IMU a ~50 Hz. Emite no tick do acelerômetro, anexando o último gyro.
 */
export async function startSensorStream(
    onSample: (sample: ImuSample) => void
): Promise<SensorUnsub> {
    Accelerometer.setUpdateInterval(UPDATE_INTERVAL_MS);
    Gyroscope.setUpdateInterval(UPDATE_INTERVAL_MS);

    let lastGyro: Vec3T | null = null;
    const subG = Gyroscope.addListener(({ x, y, z }) => {
        lastGyro = { t: Date.now(), x, y, z };
    });
    const subA = Accelerometer.addListener(({ x, y, z }) => {
        const accel: Vec3T = { t: Date.now(), x, y, z };
        onSample(mergeAccelWithGyro(accel, lastGyro));
    });

    return () => {
        subA.remove();
        subG.remove();
    };
}

export function sensorPlatform(): string {
    return `${Platform.OS}@${Platform.Version}`;
}
