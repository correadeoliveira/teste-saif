export type ImuSample = {
    t: number;
    ax: number;
    ay: number;
    az: number;
    gx: number;
    gy: number;
    gz: number;
};

export type Vec3T = {
    t: number;
    x: number;
    y: number;
    z: number;
};

export type SessionLabel = "genuine" | "impostor" | "unlabeled";

export type SessionMeta = {
    session_id: string;
    subject_id: string;
    activity: string;
    label: SessionLabel;
    started_at: string;
    ended_at: string;
    n_samples: number;
    sample_rate_target_hz: number;
    sample_rate_effective_hz: number;
    platform: string;
    duration_ms: number;
    path_jsonl?: string;
    path_meta?: string;
};

export type BehaviorModel = {
    version: string;
    type: "logistic_regression";
    feature_names: string[];
    scaler: { mean: number[]; scale: number[] };
    coef: number[];
    intercept: number;
    threshold: number;
    window_ms: number;
    overlap: number;
    sample_rate_hz: number;
    label_positive: "genuine";
};

export const TARGET_HZ = 50;
export const UPDATE_INTERVAL_MS = 1000 / TARGET_HZ;
export const DEFAULT_CAPTURE_MS = 10_000;
export const WINDOW_MS = 2_000;
export const WINDOW_OVERLAP = 0.5;
