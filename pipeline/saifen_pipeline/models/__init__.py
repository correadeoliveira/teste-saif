"""Registry dos modelos espaciais."""

from __future__ import annotations

from saifen_pipeline.models.base import SpatialModel
from saifen_pipeline.models.baseline import BaselineCountModel
from saifen_pipeline.models.kde import KDEModel
from saifen_pipeline.models.kriging import OrdinaryKrigingModel

MODELS = {
    "baseline": BaselineCountModel,
    "kde": KDEModel,
    "kriging": OrdinaryKrigingModel,
}


def get_model(name: str, **kwargs) -> SpatialModel:
    key = (name or "kde").lower()
    if key not in MODELS:
        raise ValueError(f"Modelo desconhecido: {name}. Opções: {sorted(MODELS)}")
    return MODELS[key](**kwargs)
