"""Split temporal e métricas mínimas do MVP."""

from __future__ import annotations

import numpy as np
import pandas as pd

from saifen_pipeline.evaluate import evaluate_split, precision_at_fraction, temporal_split
from saifen_pipeline.models import get_model


def _monthly_points() -> pd.DataFrame:
    rows = []
    for month, n, lat0 in [(1, 8, -23.55), (2, 8, -23.55), (3, 6, -23.56), (4, 6, -23.56)]:
        for i in range(n):
            rows.append(
                {
                    "lat": lat0 + i * 0.001,
                    "lng": -46.63 + i * 0.001,
                    "occurred_at": pd.Timestamp(f"2026-{month:02d}-10"),
                    "crime_type": "furto",
                    "period": "manha",
                }
            )
    return pd.DataFrame(rows)


def test_temporal_split_by_month():
    split = temporal_split(_monthly_points(), year=2026)
    assert split["test"]["occurred_at"].dt.month.unique().tolist() == [4]
    assert split["validation"]["occurred_at"].dt.month.unique().tolist() == [3]
    assert set(split["train"]["occurred_at"].dt.month) == {1, 2}


def test_precision_at_fraction():
    y_true = np.array([10.0, 0, 0, 8, 1])
    y_pred = np.array([9.0, 0, 1, 7, 0])
    score = precision_at_fraction(y_true, y_pred, frac=0.4)
    assert 0 <= score <= 1


def test_evaluate_baseline_runs():
    df = _monthly_points()
    split = temporal_split(df, year=2026)
    model = get_model("baseline")
    model.fit(split["train"])
    metrics = evaluate_split(model, split)
    assert metrics["n_test"] > 0
    assert "spearman" in metrics["test"]
    assert "precision_at_10pct" in metrics["test"]
    assert "mae" in metrics["test"]


def test_fallback_split_keeps_each_date_in_one_fold():
    frame = _monthly_points().iloc[:6].copy()
    frame["occurred_at"] = pd.to_datetime(
        ["2026-01-01", "2026-01-01", "2026-01-02", "2026-01-02", "2026-01-03", "2026-01-03"]
    )
    split = temporal_split(frame)
    assert [len(split[name]) for name in ("train", "validation", "test")] == [2, 2, 2]


def test_compare_evaluates_fixed_grid_and_keeps_holdout_out_of_selection():
    from saifen_pipeline.evaluate import compare_models

    frame = _monthly_points()
    frame["lng"] = frame["lng"] + np.array([i % 3 for i in range(len(frame))]) * 0.0001
    split = temporal_split(frame)
    first = compare_models(split, sample_max=50)
    split["test"] = split["test"].assign(lat=-23.50, lng=-46.60)
    second = compare_models(split, sample_max=50)
    assert first["selected_kde"] == second["selected_kde"]
    assert first["validation"] == second["validation"]
    assert first["holdout"]["baseline"]["n_cells"] > 4_000


def test_fixed_metric_kernel_reaches_expected_weight_one_bandwidth_away():
    from saifen_pipeline.kde import FittedKDE

    origin = -23.55
    longitudes = np.full(3, -46.63)
    fitted = FittedKDE(np.full(3, origin), longitudes, "scott", 500, 3, 42)
    targets = np.array([origin, origin + 500 / 111_320])
    assert np.allclose(fitted.score(targets, np.full(2, -46.63)), [1, np.exp(-0.5)])
