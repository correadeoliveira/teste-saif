"""Baseline de contagem em grade e KDE via interface SpatialModel."""

from __future__ import annotations

import pandas as pd
import pytest

from saifen_pipeline.models import get_model
from saifen_pipeline.models.kriging import OrdinaryKrigingModel
from saifen_pipeline.spatial import aggregate_counts, assign_cells


def _points() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "lat": [-23.55, -23.55, -23.56, -23.57],
            "lng": [-46.63, -46.63, -46.64, -46.65],
            "crime_type": ["furto", "furto", "roubo", "outros"],
            "period": ["manha", "manha", "noite", "tarde"],
            "occurred_at": pd.to_datetime(["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01"]),
        }
    )


def test_aggregate_counts_nonzero():
    grid = aggregate_counts(_points())
    assert grid.n_points == 4
    assert int(grid.counts.max()) >= 2
    assert grid.density.max() == pytest.approx(1.0)


def test_baseline_model_heatmap_points():
    model = get_model("baseline")
    model.fit(_points())
    pts = model.to_heatmap_points()
    assert pts
    assert all(len(p) == 3 for p in pts)
    grid = model.predict_grid()
    assert grid.zi.max() == pytest.approx(1.0)


def test_kde_model_interface():
    rng = pd.Series(range(12))
    df = pd.DataFrame(
        {
            "lat": -23.55 + rng * 0.004,
            "lng": -46.64 + (rng % 5) * 0.005,
        }
    )
    model = get_model("kde", sample_max=20)
    model.fit(df)
    pts = model.to_heatmap_points(sample_max=10)
    assert pts
    g = model.predict_grid()
    assert g.zi.shape[0] > 1


def test_kriging_is_stub():
    with pytest.raises(NotImplementedError):
        OrdinaryKrigingModel().fit(_points())


def test_assign_cells_stable():
    df = assign_cells(_points())
    assert df["cell_id"].nunique() >= 2
    again = assign_cells(_points())
    assert list(df["cell_id"]) == list(again["cell_id"])
