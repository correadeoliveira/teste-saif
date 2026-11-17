from __future__ import annotations

from pathlib import Path

import numpy as np

import pandas as pd

from behavior_pipeline import config
from behavior_pipeline.features import extract_window_features, window_frames
from behavior_pipeline.io import iter_sessions
from behavior_pipeline.split import session_level_split, subject_level_split


def build_windows(raw_dir: Path | None = None, *, by_subject: bool = False) -> pd.DataFrame:
    rows: list[dict] = []
    sessions = iter_sessions(raw_dir or config.RAW_DIR)
    if not sessions:
        raise FileNotFoundError("Nenhuma sessão IMU disponível.")
    for df, meta in sessions:
        label = meta.get("label")
        if label not in (config.LABEL_POSITIVE, config.LABEL_NEGATIVE):
            continue
        synthetic = meta.get("platform") == "synthetic" or str(meta.get("activity", "")).endswith(
            "_sim"
        )
        if synthetic == by_subject:
            continue
        session = meta.get("session_id")
        subject = meta.get("subject_id")
        if (
            not isinstance(session, str)
            or not session
            or not isinstance(subject, str)
            or not subject
        ):
            raise ValueError("Sessão rotulada requer IDs de sessão e participante.")
        if not np.isfinite(df.to_numpy()).all():
            continue
        for idx, frame in enumerate(window_frames(df)):
            feats = extract_window_features(frame)
            rows.append(
                {
                    **feats,
                    "session_id": session,
                    "subject_id": subject,
                    "label": label,
                    "window_index": idx,
                    "n_samples": len(frame),
                }
            )
    if not rows:
        raise ValueError("Sem janelas IMU rotuladas para o modo selecionado.")
    windows = pd.DataFrame(rows)
    sessions = windows.groupby(["subject_id", "session_id"], sort=True)
    if (sessions["label"].nunique() != 1).any() or windows.duplicated(
        ["subject_id", "session_id", "window_index"]
    ).any():
        raise ValueError("Sessões IMU duplicadas ou com rótulos conflitantes.")

    if by_subject:
        folds = subject_level_split(windows)
        fold_of = {key: name for name, keys in folds.items() for key in keys}
        windows["fold"] = windows["subject_id"].map(fold_of)
    else:
        # Keep identical session IDs from different devices distinct.
        session_keys = pd.MultiIndex.from_frame(windows[["subject_id", "session_id"]])
        session_id = pd.factorize(session_keys, sort=True)[0].astype(str)
        folds = session_level_split(session_id, windows["label"])
        fold_of = {key: name for name, keys in folds.items() for key in keys}
        windows["fold"] = pd.Series(session_id).map(fold_of)
    windows.attrs["evaluation_mode"] = "by_subject" if by_subject else "synthetic_demo"
    return windows


def preprocess(raw_dir: Path | None = None, *, by_subject: bool = False) -> Path:
    config.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    windows = build_windows(raw_dir, by_subject=by_subject)
    windows.to_parquet(config.WINDOWS_PATH, index=False)
    feat_cols = config.FEATURE_NAMES + ["session_id", "subject_id", "label", "fold", "window_index"]
    windows[feat_cols].to_parquet(config.FEATURES_PATH, index=False)
    return config.FEATURES_PATH
