from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from behavior_pipeline.config import FEATURE_NAMES, LABEL_NEGATIVE, LABEL_POSITIVE
from behavior_pipeline.generate import generate_demo
from behavior_pipeline.preprocess import build_windows, preprocess
from behavior_pipeline.split import assert_no_session_leakage, session_level_split
from behavior_pipeline.train import evaluate, train_from_windows


def test_split_no_leakage():
    sids = [f"s{i}" for i in range(10)]
    labels = [LABEL_POSITIVE if i < 5 else LABEL_NEGATIVE for i in range(10)]
    folds = session_level_split(sids, labels, seed=0)
    overlap = (folds["train"] & folds["test"]) | (folds["train"] & folds["validation"]) | (
        folds["validation"] & folds["test"]
    )
    assert not overlap
    assert folds["train"]


def test_preprocess_and_train(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    from behavior_pipeline import config

    raw = tmp_path / "raw"
    processed = tmp_path / "processed"
    generate_demo(n_per_class=6, dest=raw)
    monkeypatch.setattr(config, "RAW_DIR", raw)
    monkeypatch.setattr(config, "PROCESSED_DIR", processed)
    monkeypatch.setattr(config, "FEATURES_PATH", processed / "features.parquet")
    monkeypatch.setattr(config, "WINDOWS_PATH", processed / "windows.parquet")

    windows = build_windows(raw)
    assert set(FEATURE_NAMES).issubset(windows.columns)
    folds = {
        "train": set(windows.loc[windows.fold == "train", "session_id"]),
        "validation": set(windows.loc[windows.fold == "validation", "session_id"]),
        "test": set(windows.loc[windows.fold == "test", "session_id"]),
    }
    assert_no_session_leakage(windows, folds)

    model = train_from_windows(windows)
    assert model["type"] == "logistic_regression"
    assert len(model["coef"]) == len(FEATURE_NAMES)
    assert len(model["scaler"]["mean"]) == len(FEATURE_NAMES)
    metrics = evaluate(windows, model)
    assert metrics["train"]["n_windows"] > 0
    path = preprocess(raw)
    assert path.exists()
    loaded = pd.read_parquet(path)
    assert "session_id" in loaded.columns
