from __future__ import annotations

from pathlib import Path

import pandas as pd

from behavior_pipeline import config
from behavior_pipeline.features import extract_window_features, window_frames
from behavior_pipeline.io import iter_sessions
from behavior_pipeline.split import assert_no_session_leakage, session_level_split


def build_windows(raw_dir: Path | None = None) -> pd.DataFrame:
    rows: list[dict] = []
    sessions = iter_sessions(raw_dir)
    if not sessions:
        raise FileNotFoundError(f"Nenhuma sessão em {raw_dir or config.RAW_DIR}")
    for df, meta in sessions:
        frames = window_frames(df)
        label = meta.get("label") or "unlabeled"
        for idx, frame in enumerate(frames):
            feats = extract_window_features(frame)
            rows.append(
                {
                    **feats,
                    "session_id": meta["session_id"],
                    "subject_id": meta.get("subject_id", "unknown"),
                    "label": label,
                    "window_index": idx,
                    "n_samples": len(frame),
                }
            )
    windows = pd.DataFrame(rows)
    sids = windows.drop_duplicates("session_id")
    folds = session_level_split(sids["session_id"].tolist(), sids["label"].tolist())
    fold_of = {}
    for name, ids in folds.items():
        for sid in ids:
            fold_of[sid] = name
    windows["fold"] = windows["session_id"].map(fold_of)
    assert_no_session_leakage(windows, folds)
    unlabeled = windows["fold"].isna().sum()
    if unlabeled:
        raise RuntimeError(f"{unlabeled} janelas sem fold")
    return windows


def preprocess(raw_dir: Path | None = None) -> Path:
    config.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    windows = build_windows(raw_dir)
    windows.to_parquet(config.WINDOWS_PATH, index=False)
    feat_cols = config.FEATURE_NAMES + ["session_id", "subject_id", "label", "fold", "window_index"]
    windows[feat_cols].to_parquet(config.FEATURES_PATH, index=False)
    return config.FEATURES_PATH
