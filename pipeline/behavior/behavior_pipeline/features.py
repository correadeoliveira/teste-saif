from __future__ import annotations

import numpy as np
import pandas as pd

from behavior_pipeline.config import (
    AXES,
    FEATURE_NAMES,
    STATS,
    TARGET_HZ,
    WINDOW_MS,
    WINDOW_OVERLAP,
)


def resample_df(df: pd.DataFrame, target_hz: int = TARGET_HZ) -> pd.DataFrame:
    if df.empty:
        return df.copy()
    d = df.sort_values("t").drop_duplicates("t", keep="last")
    t0 = float(d["t"].iloc[0])
    t1 = float(d["t"].iloc[-1])
    if t1 <= t0:
        return d.reset_index(drop=True)
    dt = 1000.0 / target_hz
    grid = np.arange(t0, t1 + 1e-9, dt)
    out = {"t": grid}
    t_src = d["t"].to_numpy(dtype=float)
    for col in ("ax", "ay", "az", "gx", "gy", "gz"):
        out[col] = np.interp(grid, t_src, d[col].to_numpy(dtype=float))
    return pd.DataFrame(out)


def _stats(xs: np.ndarray) -> dict[str, float]:
    if xs.size == 0:
        return {s: 0.0 for s in STATS}
    mean = float(np.mean(xs))
    std = float(np.std(xs, ddof=0))
    return {
        "mean": mean,
        "std": std,
        "min": float(np.min(xs)),
        "max": float(np.max(xs)),
        "rms": float(np.sqrt(np.mean(xs * xs))),
        "energy": float(np.sum(xs * xs)),
    }


def extract_window_features(df: pd.DataFrame) -> dict[str, float]:
    mag = np.sqrt(df["ax"] ** 2 + df["ay"] ** 2 + df["az"] ** 2).to_numpy(dtype=float)
    series = {
        "ax": df["ax"].to_numpy(dtype=float),
        "ay": df["ay"].to_numpy(dtype=float),
        "az": df["az"].to_numpy(dtype=float),
        "gx": df["gx"].to_numpy(dtype=float),
        "gy": df["gy"].to_numpy(dtype=float),
        "gz": df["gz"].to_numpy(dtype=float),
        "mag_a": mag,
    }
    feats: dict[str, float] = {}
    for axis in AXES:
        st = _stats(series[axis])
        for stat in STATS:
            feats[f"{axis}_{stat}"] = st[stat]
    abs_sum = np.abs(df["ax"]) + np.abs(df["ay"]) + np.abs(df["az"])
    feats["sma_accel"] = float(np.mean(abs_sum)) if len(df) else 0.0
    return {name: float(feats[name]) for name in FEATURE_NAMES}


def window_frames(
    df: pd.DataFrame,
    window_ms: int = WINDOW_MS,
    overlap: float = WINDOW_OVERLAP,
    target_hz: int = TARGET_HZ,
) -> list[pd.DataFrame]:
    rs = resample_df(df, target_hz)
    win_n = max(1, int(round((window_ms / 1000.0) * target_hz)))
    hop_n = max(1, int(round(win_n * (1.0 - overlap))))
    frames: list[pd.DataFrame] = []
    for i in range(0, len(rs) - win_n + 1, hop_n):
        frames.append(rs.iloc[i : i + win_n].reset_index(drop=True))
    return frames
