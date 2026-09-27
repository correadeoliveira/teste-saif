"""Geração de artefatos de heatmap."""

from __future__ import annotations

import pandas as pd

from saifen_pipeline import config
from saifen_pipeline.heatmap import generate_artifacts
from saifen_pipeline.models import get_model
from tests.test_models import _points


def test_generate_artifacts_writes_points(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "HEATMAP_DIR", tmp_path)
    df = _points()
    extra = _points().assign(
        crime_type="furto",
        lat=lambda d: d["lat"] + 0.01,
    )
    df = pd.concat([df, extra], ignore_index=True)
    model = get_model("baseline")
    model.fit(df)
    paths = generate_artifacts(df, model, write_grid=True, write_crimes=False, sample_max=20)
    names = {p.name for p in paths}
    assert "heatmap_points.json" in names
    assert (tmp_path / "heatmap_points.json").exists()
    assert (tmp_path / "heatmap_points__furto.json").exists()
