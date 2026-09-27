from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from behavior_pipeline import config
from behavior_pipeline.features import extract_window_features, window_frames
from behavior_pipeline.io import iter_sessions


def generate_session(
    session_id: str,
    subject_id: str,
    label: str,
    *,
    duration_s: float = 10.0,
    hz: int = 50,
    seed: int = 0,
) -> tuple[pd.DataFrame, dict]:
    rng = np.random.default_rng(seed)
    n = int(duration_s * hz)
    t0 = 1_700_000_000_000.0
    t = t0 + np.arange(n) * (1000.0 / hz)
    sec = np.arange(n) / hz
    if label == config.LABEL_POSITIVE:
        freq, amp, g = 1.2, 0.12, 9.7
    else:
        freq, amp, g = 2.4, 0.55, 8.4
    ax = amp * np.sin(2 * np.pi * freq * sec) + rng.normal(0, 0.04, n)
    ay = amp * 1.2 * np.sin(2 * np.pi * (freq * 0.7) * sec + 0.3) + rng.normal(0, 0.04, n)
    az = g + 0.15 * np.sin(2 * np.pi * 0.4 * sec) + rng.normal(0, 0.06, n)
    gx = 0.04 * np.sin(2 * np.pi * freq * sec) + rng.normal(0, 0.02, n)
    gy = 0.03 * np.cos(2 * np.pi * freq * sec) + rng.normal(0, 0.02, n)
    gz = rng.normal(0, 0.02, n)
    df = pd.DataFrame({"t": t, "ax": ax, "ay": ay, "az": az, "gx": gx, "gy": gy, "gz": gz})
    meta = {
        "session_id": session_id,
        "subject_id": subject_id,
        "activity": "demo",
        "label": label,
        "started_at": datetime.fromtimestamp(t0 / 1000.0, tz=timezone.utc).isoformat(),
        "ended_at": datetime.fromtimestamp((t0 + duration_s * 1000) / 1000.0, tz=timezone.utc).isoformat(),
        "n_samples": n,
        "sample_rate_target_hz": hz,
        "sample_rate_effective_hz": hz,
        "platform": "synthetic",
        "duration_ms": int(duration_s * 1000),
    }
    return df, meta


def write_session(raw_dir: Path, df: pd.DataFrame, meta: dict) -> None:
    dest = raw_dir / meta["subject_id"]
    dest.mkdir(parents=True, exist_ok=True)
    jsonl = dest / f"{meta['session_id']}.jsonl"
    with jsonl.open("w") as fh:
        for rec in df.to_dict(orient="records"):
            fh.write(json.dumps(rec) + "\n")
    (dest / f"{meta['session_id']}.meta.json").write_text(json.dumps(meta, indent=2))


def generate_demo(n_per_class: int = 8, dest: Path | None = None) -> Path:
    raw = dest or config.RAW_DIR
    raw.mkdir(parents=True, exist_ok=True)
    idx = 0
    for label, subject in (
        (config.LABEL_POSITIVE, "demo-genuine"),
        (config.LABEL_NEGATIVE, "demo-impostor"),
    ):
        for i in range(n_per_class):
            df, meta = generate_session(
                f"{label}-{i:02d}",
                subject,
                label,
                seed=1000 + idx,
            )
            write_session(raw, df, meta)
            idx += 1
    return raw


def first_window_samples() -> list[dict]:
    sessions = iter_sessions()
    if not sessions:
        raise FileNotFoundError("sem sessões para fixture de paridade")
    df, _meta = sessions[0]
    frames = window_frames(df)
    if not frames:
        raise RuntimeError("sessão sem janelas")
    return frames[0].to_dict(orient="records")


def window_feature_vector(records: list[dict]) -> list[float]:
    df = pd.DataFrame(records)
    feats = extract_window_features(df)
    return [feats[name] for name in config.FEATURE_NAMES]
