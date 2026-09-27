import type { ImuSample, SessionLabel } from "./types";
import { TARGET_HZ } from "./types";

/** IMU sintético para simulador / demo (sem sensores). */
export function generateSyntheticImu(
    durationMs: number,
    label: SessionLabel = "genuine",
    hz: number = TARGET_HZ,
    seed: number = 1
): ImuSample[] {
    const n = Math.max(1, Math.round((durationMs / 1000) * hz));
    const t0 = Date.now();
    const dt = 1000 / hz;
    const samples: ImuSample[] = [];
    let s = seed >>> 0;
    const rnd = () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0xffffffff;
    };
    const n01 = () => {
        const u = Math.max(1e-9, rnd());
        const v = Math.max(1e-9, rnd());
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    const freq = label === "impostor" ? 2.4 : 1.2;
    const amp = label === "impostor" ? 0.55 : 0.12;
    const g = label === "impostor" ? 8.4 : 9.7;
    for (let i = 0; i < n; i++) {
        const sec = i / hz;
        samples.push({
            t: t0 + i * dt,
            ax: amp * Math.sin(2 * Math.PI * freq * sec) + 0.04 * n01(),
            ay: amp * 1.2 * Math.sin(2 * Math.PI * (freq * 0.7) * sec + 0.3) + 0.04 * n01(),
            az: g + 0.15 * Math.sin(2 * Math.PI * 0.4 * sec) + 0.06 * n01(),
            gx: 0.04 * Math.sin(2 * Math.PI * freq * sec) + 0.02 * n01(),
            gy: 0.03 * Math.cos(2 * Math.PI * freq * sec) + 0.02 * n01(),
            gz: 0.02 * n01(),
        });
    }
    return samples;
}
