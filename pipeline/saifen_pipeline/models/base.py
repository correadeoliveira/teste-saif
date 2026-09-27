"""Interface comum dos modelos espaciais."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

import pandas as pd

from saifen_pipeline.kde import KDEGrid


class SpatialModel(ABC):
    name: str = "base"
    version: str = "0.1.0"

    @abstractmethod
    def fit(self, df: pd.DataFrame) -> SpatialModel:
        """Ajusta o modelo aos pontos de treino (lat/lng)."""

    @abstractmethod
    def predict_grid(
        self,
        bbox: tuple[float, float, float, float] | None = None,
        grid_size: int | None = None,
    ) -> KDEGrid:
        """Densidade/score normalizado em grade regular."""

    @abstractmethod
    def to_heatmap_points(self, sample_max: int | None = 10_000) -> list[list[float]]:
        """Lista [[lat, lng, weight]] para Leaflet.heat."""

    def params(self) -> dict[str, Any]:
        return {"name": self.name, "version": self.version}
