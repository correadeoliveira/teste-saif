import type { ImuSample, SessionLabel, SessionMeta } from "./types";
import { TARGET_HZ } from "./types";
import { persistSession } from "./sessionStore";

export type RecorderState = {
    running: boolean;
    samples: ImuSample[];
    startedAt: Date | null;
};

export function createBuffer(): ImuSample[] {
    return [];
}

export function pushSample(buffer: ImuSample[], sample: ImuSample): number {
    buffer.push(sample);
    return buffer.length;
}

export async function finalizeRecording(opts: {
    samples: ImuSample[];
    startedAt: Date;
    activity: string;
    label: SessionLabel;
}): Promise<SessionMeta> {
    const endedAt = new Date();
    return persistSession({
        samples: opts.samples,
        startedAt: opts.startedAt,
        endedAt,
        activity: opts.activity,
        label: opts.label,
        targetHz: TARGET_HZ,
    });
}
