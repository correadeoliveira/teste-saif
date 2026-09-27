import type { ImuSample } from "./types";
import { TARGET_HZ, WINDOW_MS, WINDOW_OVERLAP } from "./types";

export const AXES = ["ax", "ay", "az", "gx", "gy", "gz", "mag_a"] as const;
export const STATS = ["mean", "std", "min", "max", "rms", "energy"] as const;

export const FEATURE_NAMES: string[] = [
    ...AXES.flatMap((axis) => STATS.map((stat) => `${axis}_${stat}`)),
    "sma_accel",
];

type AxisKey = "ax" | "ay" | "az" | "gx" | "gy" | "gz";

function mean(xs: number[]): number {
    if (xs.length === 0) return 0;
    let s = 0;
    for (const x of xs) s += x;
    return s / xs.length;
}

function popStd(xs: number[]): number {
    if (xs.length === 0) return 0;
    const m = mean(xs);
    let v = 0;
    for (const x of xs) v += (x - m) * (x - m);
    return Math.sqrt(v / xs.length);
}

function rms(xs: number[]): number {
    if (xs.length === 0) return 0;
    let s = 0;
    for (const x of xs) s += x * x;
    return Math.sqrt(s / xs.length);
}

function energy(xs: number[]): number {
    let s = 0;
    for (const x of xs) s += x * x;
    return s;
}

function minv(xs: number[]): number {
    if (xs.length === 0) return 0;
    let m = xs[0];
    for (const x of xs) if (x < m) m = x;
    return m;
}

function maxv(xs: number[]): number {
    if (xs.length === 0) return 0;
    let m = xs[0];
    for (const x of xs) if (x > m) m = x;
    return m;
}

function axisSeries(samples: ImuSample[], key: AxisKey): number[] {
    return samples.map((s) => s[key]);
}

function magA(samples: ImuSample[]): number[] {
    return samples.map((s) => Math.sqrt(s.ax * s.ax + s.ay * s.ay + s.az * s.az));
}

function statsOf(xs: number[]): number[] {
    return [mean(xs), popStd(xs), minv(xs), maxv(xs), rms(xs), energy(xs)];
}

export function extractWindowFeatures(samples: ImuSample[], names: string[] = FEATURE_NAMES): number[] {
    const byName: Record<string, number> = {};
    const mag = magA(samples);
    const series: Record<(typeof AXES)[number], number[]> = {
        ax: axisSeries(samples, "ax"),
        ay: axisSeries(samples, "ay"),
        az: axisSeries(samples, "az"),
        gx: axisSeries(samples, "gx"),
        gy: axisSeries(samples, "gy"),
        gz: axisSeries(samples, "gz"),
        mag_a: mag,
    };
    for (const axis of AXES) {
        const st = statsOf(series[axis]);
        STATS.forEach((stat, i) => {
            byName[`${axis}_${stat}`] = st[i];
        });
    }
    const sma =
        samples.length === 0
            ? 0
            : samples.reduce((s, p) => s + Math.abs(p.ax) + Math.abs(p.ay) + Math.abs(p.az), 0) /
              samples.length;
    byName.sma_accel = sma;
    return names.map((n) => byName[n] ?? 0);
}

function uniqueSorted(samples: ImuSample[]): ImuSample[] {
    const byT = new Map<number, ImuSample>();
    for (const s of samples) byT.set(s.t, s);
    return [...byT.values()].sort((a, b) => a.t - b.t);
}

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

export function resampleSamples(samples: ImuSample[], targetHz: number = TARGET_HZ): ImuSample[] {
    const src = uniqueSorted(samples);
    if (src.length === 0) return [];
    if (src.length === 1) return [{ ...src[0] }];
    const t0 = src[0].t;
    const t1 = src[src.length - 1].t;
    if (t1 <= t0) return [{ ...src[0] }];
    const dt = 1000 / targetHz;
    const out: ImuSample[] = [];
    const keys: AxisKey[] = ["ax", "ay", "az", "gx", "gy", "gz"];
    let lo = 0;
    for (let t = t0; t <= t1 + 1e-9; t += dt) {
        const last = src.length - 1;
        if (t <= src[0].t) {
            out.push({ ...src[0], t });
            continue;
        }
        if (t >= src[last].t) {
            out.push({ ...src[last], t });
            continue;
        }
        while (lo < last - 1 && src[lo + 1].t <= t) lo += 1;
        const a = src[lo];
        const b = src[lo + 1];
        const u = (t - a.t) / (b.t - a.t || 1);
        const row: ImuSample = { t, ax: 0, ay: 0, az: 0, gx: 0, gy: 0, gz: 0 };
        for (const k of keys) row[k] = lerp(a[k], b[k], u);
        out.push(row);
    }
    return out;
}

export function windowSamples(
    samples: ImuSample[],
    windowMs: number = WINDOW_MS,
    overlap: number = WINDOW_OVERLAP,
    targetHz: number = TARGET_HZ
): ImuSample[][] {
    const rs = resampleSamples(samples, targetHz);
    const winN = Math.max(1, Math.round((windowMs / 1000) * targetHz));
    const hopN = Math.max(1, Math.round(winN * (1 - overlap)));
    const windows: ImuSample[][] = [];
    for (let i = 0; i + winN <= rs.length; i += hopN) {
        windows.push(rs.slice(i, i + winN));
    }
    return windows;
}
