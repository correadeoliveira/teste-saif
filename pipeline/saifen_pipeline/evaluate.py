"""Validação temporal intra-anual (sem leakage)."""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from scipy.stats import spearmanr

from saifen_pipeline import config, spatial
from saifen_pipeline.models.base import SpatialModel


def temporal_split(
    df: pd.DataFrame,
    year: int = config.SOURCE_YEAR,
) -> dict[str, pd.DataFrame]:
    """
    Split por mês dentro do ano-fonte.

    Train: todos os meses menos os dois últimos
    Validation: penúltimo mês
    Test: último mês

    Se houver menos de 3 meses, cai para corte 60/20/20 ordenado no tempo.
    """
    d = df.dropna(subset=["occurred_at"]).copy()
    d = d.loc[d["occurred_at"].dt.year == year]
    if d.empty:
        raise ValueError(f"Nenhuma linha com occurred_at em {year}.")
    d = d.sort_values("occurred_at")
    months = sorted(d["occurred_at"].dt.month.unique().tolist())
    if len(months) >= 3:
        test_m = months[-1]
        val_m = months[-2]
        train_m = set(months[:-2])
        train = d.loc[d["occurred_at"].dt.month.isin(train_m)]
        val = d.loc[d["occurred_at"].dt.month == val_m]
        test = d.loc[d["occurred_at"].dt.month == test_m]
    else:
        n = len(d)
        i_train = max(int(n * 0.6), 1)
        i_val = max(int(n * 0.8), i_train + 1)
        train, val, test = d.iloc[:i_train], d.iloc[i_train:i_val], d.iloc[i_val:]
    if train.empty or test.empty:
        raise ValueError("Split temporal resultou em train ou test vazio.")
    return {"train": train, "validation": val, "test": test}


def _cell_vector(df: pd.DataFrame, cell_ids: list[str]) -> np.ndarray:
    counts = df["cell_id"].value_counts().to_dict() if not df.empty else {}
    return np.array([float(counts.get(cid, 0.0)) for cid in cell_ids], dtype=np.float64)


def _scores_from_model(
    model: SpatialModel,
    cell_ids: list[str],
    centroids: dict[str, tuple[float, float]],
) -> np.ndarray:
    grid = model.predict_grid()
    # mapa (i,j) -> density via cell_id format
    lookup: dict[str, float] = {}
    for i, _lat in enumerate(grid.yi):
        for j, _lng in enumerate(grid.xi):
            lookup[f"{i}:{j}"] = float(grid.zi[i, j])
    # Se a grade do modelo não coincidir com a de avaliação (KDE 200x200 vs grid ~H3),
    # amostrar a densidade no centróide mais próximo da grade do modelo.
    if not any(cid in lookup for cid in cell_ids[: min(20, len(cell_ids))]):
        scores = []
        xi, yi, zi = grid.xi, grid.yi, grid.zi
        for cid in cell_ids:
            lat, lng = centroids[cid]
            j = int(np.argmin(np.abs(xi - lng)))
            i = int(np.argmin(np.abs(yi - lat)))
            scores.append(float(zi[i, j]))
        return np.array(scores, dtype=np.float64)
    return np.array([lookup.get(cid, 0.0) for cid in cell_ids], dtype=np.float64)


def precision_at_fraction(y_true: np.ndarray, y_pred: np.ndarray, frac: float = 0.10) -> float:
    n = len(y_true)
    if n == 0:
        return float("nan")
    k = max(1, int(round(n * frac)))
    pred_top = np.argsort(y_pred)[::-1][:k]
    true_top = set(np.argsort(y_true)[::-1][:k].tolist())
    hits = sum(1 for i in pred_top if int(i) in true_top)
    return hits / k


def evaluate_split(
    model: SpatialModel,
    split: dict[str, pd.DataFrame],
    bbox: tuple[float, float, float, float] = config.SP_BBOX,
) -> dict[str, Any]:
    """Avalia ranking de hotspots no período seguinte (células de grade)."""
    frames = {k: spatial.assign_cells(v, bbox=bbox) for k, v in split.items() if len(v)}
    union = pd.concat(frames.values(), ignore_index=True)
    cell_ids = sorted(union["cell_id"].unique().tolist())
    centroids = {
        cid: (
            float(union.loc[union["cell_id"] == cid, "lat"].mean()),
            float(union.loc[union["cell_id"] == cid, "lng"].mean()),
        )
        for cid in cell_ids
    }
    y_test = _cell_vector(frames["test"], cell_ids)
    y_val = _cell_vector(frames.get("validation", frames["test"].iloc[0:0]), cell_ids)
    y_pred = _scores_from_model(model, cell_ids, centroids)

    def _pack(y: np.ndarray) -> dict[str, float]:
        if y.sum() == 0 or np.allclose(y_pred, y_pred[0]):
            spear = float("nan")
        else:
            spear = float(spearmanr(y_pred, y).correlation)
        scale = y.sum() / y_pred.sum() if y_pred.sum() > 0 else 0.0
        yhat = y_pred * scale
        mae = float(np.mean(np.abs(yhat - y)))
        rmse = float(np.sqrt(np.mean((yhat - y) ** 2)))
        return {
            "spearman": spear,
            "precision_at_10pct": precision_at_fraction(y, y_pred, 0.10),
            "mae": mae,
            "rmse": rmse,
        }

    return {
        "n_cells": len(cell_ids),
        "n_train": int(len(split["train"])),
        "n_validation": int(len(split.get("validation", []))),
        "n_test": int(len(split["test"])),
        "train_months": sorted(split["train"]["occurred_at"].dt.month.unique().tolist()),
        "validation_months": sorted(split["validation"]["occurred_at"].dt.month.unique().tolist())
        if len(split.get("validation", []))
        else [],
        "test_months": sorted(split["test"]["occurred_at"].dt.month.unique().tolist()),
        "test": _pack(y_test),
        "validation": _pack(y_val) if y_val.sum() > 0 else {},
        "note": (
            "Split intra-anual: o modelo é treinado em meses anteriores e avaliado "
            "no último mês disponível de 2026. Não é holdout 2022–2025."
        ),
    }
