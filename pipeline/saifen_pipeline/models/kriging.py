"""Ordinary Kriging — stub. Não é o MVP e não entra no caminho default."""

from __future__ import annotations

from typing import Any

import pandas as pd

from saifen_pipeline.kde import KDEGrid
from saifen_pipeline.models.base import SpatialModel


class OrdinaryKrigingModel(SpatialModel):
    name = "kriging"
    version = "0.0.0-stub"

    def fit(self, df: pd.DataFrame) -> OrdinaryKrigingModel:
        raise NotImplementedError(
            "Ordinary Kriging não é o MVP deste pipeline. "
            "Crime é um processo pontual: use --model kde (default) ou --model baseline. "
            "Kriging só faria sentido após agregar taxas por célula, como experimento futuro."
        )

    def predict_grid(
        self,
        bbox: tuple[float, float, float, float] | None = None,
        grid_size: int | None = None,
    ) -> KDEGrid:
        raise NotImplementedError("Ordinary Kriging não implementado.")

    def to_heatmap_points(self, sample_max: int | None = 10_000) -> list[list[float]]:
        raise NotImplementedError("Ordinary Kriging não implementado.")

    def params(self) -> dict[str, Any]:
        return {**super().params(), "status": "stub"}
