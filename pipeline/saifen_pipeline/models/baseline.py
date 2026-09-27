"""Baseline espacial: contagem por célula de grade, sem interpolação."""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from saifen_pipeline import config, spatial
from saifen_pipeline.kde import KDEGrid
from saifen_pipeline.models.base import SpatialModel


class BaselineCountModel(SpatialModel):
    name = "baseline"
    version = "0.1.0"

    def __init__(self, cell_deg: float = config.GRID_CELL_DEG) -> None:
        self.cell_deg = cell_deg
        self._df: pd.DataFrame | None = None
        self._grid: spatial.CountGrid | None = None

    def fit(self, df: pd.DataFrame) -> BaselineCountModel:
        if df.empty:
            raise ValueError("Baseline precisa de ao menos 1 ponto.")
        self._df = df[["lat", "lng"]].copy()
        self._grid = spatial.aggregate_counts(self._df, cell_deg=self.cell_deg)
        return self

    def predict_grid(
        self,
        bbox: tuple[float, float, float, float] | None = None,
        grid_size: int | None = None,
    ) -> KDEGrid:
        if self._grid is None:
            raise RuntimeError("Chame fit() antes de predict_grid().")
        g = self._grid
        return KDEGrid(
            xi=g.xi,
            yi=g.yi,
            zi=g.density,
            bbox=g.bbox,
            bandwidth=self.cell_deg,
            n_points=g.n_points,
        )

    def to_heatmap_points(self, sample_max: int | None = 10_000) -> list[list[float]]:
        if self._grid is None:
            raise RuntimeError("Chame fit() antes de to_heatmap_points().")
        g = self._grid
        dens = g.density
        points: list[list[float]] = []
        for i, lat in enumerate(g.yi):
            for j, lng in enumerate(g.xi):
                w = float(dens[i, j])
                if w <= 0:
                    continue
                points.append([float(lat), float(lng), w])
        if sample_max is not None and len(points) > sample_max:
            weights = np.array([p[2] for p in points])
            rng = np.random.default_rng(42)
            p = weights / weights.sum()
            idx = rng.choice(len(points), size=sample_max, replace=False, p=p)
            points = [points[i] for i in idx]
        return points

    def params(self) -> dict[str, Any]:
        return {**super().params(), "cell_deg": self.cell_deg}
