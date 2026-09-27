"""Adapter SpatialModel sobre o KDE scipy já existente."""

from __future__ import annotations

from typing import Any, Literal

import pandas as pd

from saifen_pipeline import config, kde as kde_impl
from saifen_pipeline.kde import KDEGrid
from saifen_pipeline.models.base import SpatialModel

# 1 grau de latitude ≈ 111_320 m. Em SP, 1° lng ≈ 111_320 * cos(-23.55°).
_METERS_PER_DEG_LAT = 111_320.0
_METERS_PER_DEG_LNG = 111_320.0 * 0.917  # cos(23.55°)


def bandwidth_meters_to_degrees(meters: float) -> float:
    """Converte bandwidth métrico em graus (média lat/lng local)."""
    mean_m_per_deg = (_METERS_PER_DEG_LAT + _METERS_PER_DEG_LNG) / 2.0
    return meters / mean_m_per_deg


class KDEModel(SpatialModel):
    name = "kde"
    version = "0.2.0"

    def __init__(
        self,
        bandwidth: Literal["scott", "silverman"] | float = config.KDE_BANDWIDTH,
        bandwidth_m: float | None = None,
        sample_max: int | None = 10_000,
        seed: int = 42,
        grid_size: int = config.KDE_GRID_SIZE,
    ) -> None:
        if bandwidth_m is not None:
            bandwidth = bandwidth_meters_to_degrees(bandwidth_m)
        self.bandwidth = bandwidth
        self.bandwidth_m = bandwidth_m
        self.sample_max = sample_max
        self.seed = seed
        self.grid_size = grid_size
        self._df: pd.DataFrame | None = None

    def fit(self, df: pd.DataFrame) -> KDEModel:
        if len(df) < 3:
            raise ValueError("KDE precisa de ao menos 3 pontos.")
        self._df = df[["lat", "lng"]].copy()
        return self

    def predict_grid(
        self,
        bbox: tuple[float, float, float, float] | None = None,
        grid_size: int | None = None,
    ) -> KDEGrid:
        if self._df is None:
            raise RuntimeError("Chame fit() antes de predict_grid().")
        return kde_impl.grid_density(
            self._df,
            bbox=bbox or config.SP_BBOX,
            grid_size=grid_size or self.grid_size,
            bandwidth=self.bandwidth,
            sample_max=self.sample_max,
            seed=self.seed,
        )

    def to_heatmap_points(self, sample_max: int | None = None) -> list[list[float]]:
        if self._df is None:
            raise RuntimeError("Chame fit() antes de to_heatmap_points().")
        return kde_impl.point_heatmap(
            self._df,
            bandwidth=self.bandwidth,
            sample_max=sample_max if sample_max is not None else self.sample_max,
            seed=self.seed,
        )

    def params(self) -> dict[str, Any]:
        return {
            **super().params(),
            "bandwidth": self.bandwidth,
            "bandwidth_m": self.bandwidth_m,
            "sample_max": self.sample_max,
            "seed": self.seed,
            "grid_size": self.grid_size,
        }
