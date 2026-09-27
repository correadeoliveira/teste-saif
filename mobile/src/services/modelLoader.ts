import type { BehaviorModel } from "./types";

import bundled from "../../assets/behavior/model.json";

let cached: BehaviorModel | null = null;

export function loadBundledModel(): BehaviorModel {
    if (!cached) cached = bundled as BehaviorModel;
    return cached;
}

export function modelVersion(): string {
    try {
        return loadBundledModel().version;
    } catch {
        return "none";
    }
}
