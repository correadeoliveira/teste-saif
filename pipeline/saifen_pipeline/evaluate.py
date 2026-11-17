"""Avaliação temporal de hotspots em uma grade fixa de São Paulo."""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from scipy.stats import spearmanr

from saifen_pipeline import config, spatial
from saifen_pipeline.models.base import SpatialModel


class InsufficientEvaluation(ValueError):
    """Não há observações suficientes no recorte de avaliação."""


def temporal_split(df: pd.DataFrame, year: int = config.SOURCE_YEAR) -> dict[str, pd.DataFrame]:
    data = df.dropna(subset=["occurred_at"])
    data = data.loc[data["occurred_at"].dt.year == year].sort_values("occurred_at")
    groups = data["occurred_at"].dt.month
    values = groups.unique()
    if len(values) >= 3:
        train_end, validation_end = values[-3:-1]
    else:
        groups = data["occurred_at"].dt.normalize()
        values = groups.unique()
        n = len(values)
        if n < 3:
            raise InsufficientEvaluation("A avaliação requer pelo menos três datas distintas.")
        train_size = min(max(int(n * 0.6), 1), n - 2)
        validation_size = min(max(int(n * 0.8), train_size + 1), n - 1)
        train_end, validation_end = values[[train_size - 1, validation_size - 1]]
    return {
        "train": data.loc[groups <= train_end],
        "validation": data.loc[(groups > train_end) & (groups <= validation_end)],
        "test": data.loc[groups > validation_end],
    }


def _top(scores: np.ndarray, frac: float) -> np.ndarray:
    return np.argsort(-scores, kind="stable")[: max(1, round(len(scores) * frac))]


def precision_at_fraction(y_true: np.ndarray, y_pred: np.ndarray, frac: float = 0.10) -> float:
    pred = _top(y_pred, frac)
    return float(len(set(pred) & set(_top(y_true, frac))) / len(pred)) if len(pred) else 0.0


def _in_bounds(df: pd.DataFrame, bbox: tuple[float, float, float, float]) -> pd.DataFrame:
    min_lng, min_lat, max_lng, max_lat = bbox
    return df.loc[df["lat"].between(min_lat, max_lat) & df["lng"].between(min_lng, max_lng)]


def _calendar_days(df: pd.DataFrame) -> int:
    days = df["occurred_at"].dt.normalize()
    return (days.max() - days.min()).days + 1


def evaluate_split(
    model: SpatialModel,
    split: dict[str, pd.DataFrame],
    bbox: tuple[float, float, float, float] = config.SP_BBOX,
    *,
    include_test: bool = True,
) -> dict[str, Any]:
    frames = {name: _in_bounds(frame, bbox) for name, frame in split.items()}
    required = ("train", "validation", "test") if include_test else ("train", "validation")
    if any(frames[name].empty for name in required):
        raise InsufficientEvaluation("Período sem dados na grade de avaliação.")

    grids = {name: spatial.aggregate_counts(frames[name], bbox=bbox) for name in required}
    train_grid = grids["train"]
    xx, yy = np.meshgrid(train_grid.xi, train_grid.yi)
    scores = model.score_centroids(yy.ravel(), xx.ravel())
    total_scores = scores.sum()
    distribution = scores / total_scores if total_scores > 0 else np.zeros_like(scores)
    daily_rate = len(frames["train"]) / _calendar_days(split["train"])

    def pack(name: str) -> dict[str, float | None]:
        counts = grids[name].counts.ravel()
        estimated = distribution * daily_rate * _calendar_days(split[name])
        error = estimated - counts
        rank = None
        if np.ptp(scores) and np.ptp(counts):
            rank = float(spearmanr(scores, counts).correlation)
        return {
            "spearman": rank,
            "precision_at_10pct": precision_at_fraction(counts, scores),
            "hit_rate_at_10pct": float(counts[_top(scores, 0.10)].sum() / counts.sum()),
            "mae": float(np.mean(np.abs(error))),
            "rmse": float(np.sqrt(np.mean(error**2))),
        }

    result = {"n_cells": len(scores)}
    for name in required:
        result[name + "_months"] = sorted(frames[name]["occurred_at"].dt.month.unique().tolist())
        result["n_" + name] = len(frames[name])
    result["validation"] = pack("validation")
    if include_test:
        result["test"] = pack("test")
    return result


def compare_models(split: dict[str, pd.DataFrame], sample_max: int) -> dict[str, Any]:
    from saifen_pipeline.models import get_model

    models = {
        "baseline": get_model("baseline"),
        "scott": get_model("kde", sample_max=sample_max),
        **{
            f"{m}m": get_model("kde", bandwidth_m=m, sample_max=sample_max)
            for m in (250, 500, 1000)
        },
    }
    validation = {}
    omitted = []
    for name, model in models.items():
        try:
            model.fit(split["train"])
        except ValueError:
            if name == "scott":
                omitted.append(name)
                continue
            raise
        validation[name] = evaluate_split(model, split, include_test=False)["validation"]

    candidates = [name for name in validation if name != "baseline"]
    selected = max(candidates, key=lambda name: validation[name]["hit_rate_at_10pct"])
    held_out = dict.fromkeys(name for name in ("baseline", selected, "scott") if name in validation)
    return {
        "selected_kde": selected,
        "omitted": omitted,
        "validation": validation,
        "holdout": {name: evaluate_split(models[name], split) for name in held_out},
    }
