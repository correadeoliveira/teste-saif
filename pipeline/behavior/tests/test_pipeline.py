from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from behavior_pipeline.config import FEATURE_NAMES, LABEL_NEGATIVE, LABEL_POSITIVE
from behavior_pipeline.generate import generate_demo
from behavior_pipeline.preprocess import build_windows, preprocess
from behavior_pipeline.split import assert_no_session_leakage, session_level_split
from behavior_pipeline.train import evaluate, train_from_windows, validate_model


def test_split_no_leakage():
    sids = [f"s{i}" for i in range(10)]
    labels = [LABEL_POSITIVE if i < 5 else LABEL_NEGATIVE for i in range(10)]
    folds = session_level_split(sids, labels, seed=0)
    overlap = (
        (folds["train"] & folds["test"])
        | (folds["train"] & folds["validation"])
        | (folds["validation"] & folds["test"])
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
    validate_model(model)
    assert model["type"] == "logistic_regression"
    assert len(model["coef"]) == len(FEATURE_NAMES)
    assert len(model["scaler"]["mean"]) == len(FEATURE_NAMES)
    metrics = evaluate(windows, model)
    assert metrics["train"]["n_windows"] > 0
    path = preprocess(raw)
    assert path.exists()
    loaded = pd.read_parquet(path)
    assert "session_id" in loaded.columns


def test_session_threshold_uses_a_margin_and_rates_count_sessions():
    import numpy as np

    from behavior_pipeline.train import _session_scores, _youden_threshold

    windows = pd.DataFrame(
        {
            "subject_id": ["a", "a", "b", "b", "b"],
            "session_id": ["same", "same", "same", "same", "same"],
            "label": [
                LABEL_NEGATIVE,
                LABEL_NEGATIVE,
                LABEL_POSITIVE,
                LABEL_POSITIVE,
                LABEL_POSITIVE,
            ],
        }
    )
    labels, scores = _session_scores(windows, np.array([0.1, 0.3, 0.8, 0.9, 0.1]))
    np.testing.assert_allclose(scores, [0.2, 0.8])
    assert _youden_threshold(labels, scores) == pytest.approx(0.5)


def test_subject_split_disjoint_and_balanced():
    from behavior_pipeline.split import subject_level_split

    windows = pd.DataFrame(
        [(subject, label) for subject in "abcd" for label in (LABEL_POSITIVE, LABEL_NEGATIVE)],
        columns=["subject_id", "label"],
    )
    folds = subject_level_split(windows)
    assert set.union(*folds.values()) == set("abcd")
    assert sum(map(len, folds.values())) == 4
    assert all(group for group in folds.values())


def test_parity_fixture_is_synthetic_and_deterministic():
    from behavior_pipeline.generate import first_window_samples

    first = first_window_samples()
    assert len(first) == 100
    assert first_window_samples() == first


def test_subject_split_when_each_person_has_only_one_label():
    from behavior_pipeline.split import subject_level_split

    windows = pd.DataFrame(
        {
            "subject_id": list("abcdef"),
            "label": [LABEL_POSITIVE] * 3 + [LABEL_NEGATIVE] * 3,
        }
    )
    folds = subject_level_split(windows)
    assert len(set.union(*folds.values())) == 6
    for group in folds.values():
        assert set(windows.loc[windows["subject_id"].isin(group), "label"]) == {
            LABEL_POSITIVE,
            LABEL_NEGATIVE,
        }
