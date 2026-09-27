import type { ImuSample, Vec3T } from "./types";

/**
 * Relógio do acelerômetro; giroscópio mais recente é anexado.
 * Extraído para teste sem APIs nativas.
 */
export function mergeAccelWithGyro(accel: Vec3T, gyro: Vec3T | null): ImuSample {
    return {
        t: accel.t,
        ax: accel.x,
        ay: accel.y,
        az: accel.z,
        gx: gyro?.x ?? 0,
        gy: gyro?.y ?? 0,
        gz: gyro?.z ?? 0,
    };
}

export function effectiveHz(nSamples: number, durationMs: number): number {
    if (durationMs <= 0) return 0;
    return (nSamples / durationMs) * 1000;
}
