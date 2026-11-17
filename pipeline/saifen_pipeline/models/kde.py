"""Adapter SpatialModel sobre o KDE scipy já existente."""

from __future__ import annotations

from typing import Any, Literal

import numpy as np
import pandas as pd

from saifen_pipeline import config
from saifen_pipeline.kde import FittedKDE, KDEGrid
from saifen_pipeline.models.base import SpatialModel


class KDEModel(SpatialModel):
    name = "kde"
    version = "0.3.0"

    def __init__(
        self,
        bandwidth: Literal["scott", "silverman"] | float = config.KDE_BANDWIDTH,
        bandwidth_m: float | None = None,
        sample_max: int | None = 10_000,
        seed: int = 42,
        grid_size: int = config.KDE_GRID_SIZE,
    ) -> None:
        self.bandwidth = bandwidth
        self.bandwidth_m = bandwidth_m
        self.sample_max = sample_max
        self.seed = seed
        self.grid_size = grid_size
        self._fitted: FittedKDE | None = None

    def fit(self, df: pd.DataFrame) -> KDEModel:
        self._fitted = FittedKDE(
            df["lat"].to_numpy(),
            df["lng"].to_numpy(),
            self.bandwidth,
            self.bandwidth_m,
            self.sample_max,
            self.seed,
        )
        return self

    def _model(self) -> FittedKDE:
        if self._fitted is None:
            raise RuntimeError("Chame fit() antes de prever.")
        return self._fitted

    def predict_grid(
        self,
        bbox: tuple[float, float, float, float] | None = None,
        grid_size: int | None = None,
    ) -> KDEGrid:
        return self._model().grid_density(bbox or config.SP_BBOX, grid_size or self.grid_size)

    def score_centroids(self, lats: np.ndarray, lngs: np.ndarray) -> np.ndarray:
        return self._model().score(lats, lngs)

    def to_heatmap_points(self, sample_max: int | None = None) -> list[list[float]]:
        return self._model().point_heatmap(sample_max)

    def params(self) -> dict[str, Any]:
        return {
            **super().params(),
            "bandwidth": self.bandwidth,
            "bandwidth_m": self.bandwidth_m,
            "sample_max": self.sample_max,
            "seed": self.seed,
            "grid_size": self.grid_size,
        }
