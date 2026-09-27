import { extractWindowFeatures, windowSamples } from "./features";
import type { BehaviorModel, ImuSample } from "./types";

export function sigmoid(z: number): number {
    if (z >= 0) {
        const ez = Math.exp(-z);
        return 1 / (1 + ez);
    }
    const ez = Math.exp(z);
    return ez / (1 + ez);
}

export function scaleFeatures(x: number[], mean: number[], scale: number[]): number[] {
    return x.map((v, i) => {
        const s = scale[i];
        return (v - mean[i]) / (s === 0 || Number.isNaN(s) ? 1 : s);
    });
}

export function decisionScore(x: number[], model: BehaviorModel): number {
    const xs = scaleFeatures(x, model.scaler.mean, model.scaler.scale);
    let z = model.intercept;
    const n = Math.min(model.coef.length, xs.length);
    for (let i = 0; i < n; i++) z += model.coef[i] * xs[i];
    return sigmoid(z);
}

function median(xs: number[]): number {
    if (xs.length === 0) return 0;
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

export type VerifyResult = {
    score: number;
    accept: boolean;
    n_windows: number;
    scores: number[];
    latency_ms: number;
};

export function verifySession(samples: ImuSample[], model: BehaviorModel): VerifyResult {
    const t0 = Date.now();
    const windows = windowSamples(samples, model.window_ms, model.overlap, model.sample_rate_hz);
    const scores = windows.map((w) =>
        decisionScore(extractWindowFeatures(w, model.feature_names), model)
    );
    const score = median(scores);
    return {
        score,
        accept: score >= model.threshold,
        n_windows: windows.length,
        scores,
        latency_ms: Date.now() - t0,
    };
}
