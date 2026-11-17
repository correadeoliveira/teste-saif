import { validateModel } from "./inference";
import type { BehaviorModel } from "./types";
import bundled from "../../assets/behavior/model.json";

const model: BehaviorModel | null = validateModel(bundled) ? bundled as BehaviorModel : null;

export function loadBundledModel(): BehaviorModel | null {
    return model;
}

export function modelVersion(): string {
    return model?.version ?? "indisponível";
}
