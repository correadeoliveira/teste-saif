"""
Estimação de Densidade por Kernel (KDE) 2D.

Implementa duas estratégias de saída, ambas usadas pelo frontend:

    1. point_heatmap : lista de [lat, lng, weight∈[0,1]]
       Pesos vêm da densidade KDE avaliada no próprio ponto.
       Formato cru compatível com Leaflet.heat (em uso hoje).

    2. grid_density : matriz NxN de densidade normalizada [0,1]
       Avaliada numa grade regular sobre uma bbox.
       Vira GeoJSON via exporter.grid_to_geojson e alimenta
       camadas Mapbox GL JS / heatmap analítico (PostGIS).

A escolha do bandwidth segue a regra de Scott por padrão; aceita
'silverman', um fator de covariância ou largura fixa em metros.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np
import pandas as pd
from scipy.spatial.distance import cdist
from scipy.stats import gaussian_kde

from saifen_pipeline import config


@dataclass(frozen=True)
class KDEGrid:
    """Resultado da KDE avaliada sobre uma grade regular."""

    xi: np.ndarray  # 1D: longitudes (size N)
    yi: np.ndarray  # 1D: latitudes  (size N)
    zi: np.ndarray  # 2D: densidade normalizada [0,1] (shape N x N)
    bbox: tuple[float, float, float, float]
    bandwidth: float
    n_points: int

    @property
    def cell_size_deg(self) -> tuple[float, float]:
        dx = float(self.xi[1] - self.xi[0]) if len(self.xi) > 1 else 0.0
        dy = float(self.yi[1] - self.yi[0]) if len(self.yi) > 1 else 0.0
        return (dx, dy)


def normalize_density(density: np.ndarray) -> np.ndarray:
    peak = density.max()
    return density / peak if peak > 0 else np.zeros_like(density)


class FittedKDE:
    """Reuses the same training sample for point, grid, and evaluation scores."""

    def __init__(
        self,
        lats: np.ndarray,
        lngs: np.ndarray,
        bandwidth: Literal["scott", "silverman"] | float,
        bandwidth_m: float | None,
        sample_max: int | None,
        seed: int,
    ) -> None:
        if len(lats) < 3:
            raise ValueError("KDE precisa de ao menos 3 pontos.")
        if sample_max is not None and sample_max < 3:
            raise ValueError("sample_max do KDE deve ser pelo menos 3.")
        self.n_points = len(lats)
        self.seed = seed
        self.bandwidth_m = bandwidth_m
        if sample_max is not None and self.n_points > sample_max:
            idx = np.random.default_rng(seed).choice(self.n_points, size=sample_max, replace=False)
            lats, lngs = lats[idx], lngs[idx]
        self.points = np.column_stack((lngs, lats))
        if not np.isfinite(self.points).all():
            raise ValueError("KDE requer coordenadas finitas.")
        self.kde = None
        if bandwidth_m is not None:
            if not np.isfinite(bandwidth_m) or bandwidth_m <= 0:
                raise ValueError("Bandwidth em metros deve ser positivo e finito.")
            self.metric_points = self._to_meters(self.points)
            self.factor = bandwidth_m
        else:
            if not isinstance(bandwidth, str) and (not np.isfinite(bandwidth) or bandwidth <= 0):
                raise ValueError("Bandwidth KDE deve ser um fator positivo e finito.")
            try:
                self.kde = gaussian_kde(self.points.T, bw_method=bandwidth)
            except np.linalg.LinAlgError as exc:
                raise ValueError("Amostra KDE colinear ou com variância insuficiente.") from exc
            self.factor = float(self.kde.factor)

    @staticmethod
    def _to_meters(points: np.ndarray) -> np.ndarray:
        lat, lng = config.SP_CENTER
        scale = np.array([111_320.0 * np.cos(np.deg2rad(lat)), 111_320.0])
        return (points - [lng, lat]) * scale

    def score(self, lats: np.ndarray, lngs: np.ndarray) -> np.ndarray:
        points = np.column_stack((lngs, lats))
        if self.kde is not None:
            return self.kde(points.T)

        # The constant kernel denominator cancels when scores are normalized.
        metric_points = self._to_meters(points)
        scores = np.empty(len(points))
        for start in range(0, len(points), 256):
            rows = slice(start, start + 256)
            distances = cdist(metric_points[rows], self.metric_points, metric="sqeuclidean")
            distances *= -0.5 / self.factor**2
            np.exp(distances, out=distances)
            scores[rows] = distances.mean(axis=1)
        return scores

    def point_heatmap(self, sample_max: int | None) -> list[list[float]]:
        points = self.points
        if sample_max is not None and len(points) > sample_max:
            idx = np.random.default_rng(self.seed).choice(
                len(points), size=sample_max, replace=False
            )
            points = points[idx]
        if not len(points):
            return []
        lngs, lats = points.T
        weights = normalize_density(self.score(lats, lngs))
        return np.column_stack((lats, lngs, weights)).tolist()

    def grid_density(self, bbox: tuple[float, float, float, float], grid_size: int) -> KDEGrid:
        if grid_size < 2:
            raise ValueError("grid_size deve ser pelo menos 2.")
        xi = np.linspace(bbox[0], bbox[2], grid_size)
        yi = np.linspace(bbox[1], bbox[3], grid_size)
        xx, yy = np.meshgrid(xi, yi)
        scores = self.score(yy.ravel(), xx.ravel()).reshape(yy.shape)
        return KDEGrid(
            xi=xi,
            yi=yi,
            zi=normalize_density(scores).astype(np.float32),
            bbox=bbox,
            bandwidth=self.factor,
            n_points=self.n_points,
        )


def point_heatmap(
    df: pd.DataFrame,
    lat_col: str = "lat",
    lng_col: str = "lng",
    bandwidth: Literal["scott", "silverman"] | float = config.KDE_BANDWIDTH,
    sample_max: int | None = 5000,
    seed: int = 42,
) -> list[list[float]]:
    """Avalia a densidade nos próprios pontos da amostra."""
    if df.empty:
        return []
    kde = FittedKDE(
        df[lat_col].to_numpy(), df[lng_col].to_numpy(), bandwidth, None, sample_max, seed
    )
    return kde.point_heatmap(None)


def grid_density(
    df: pd.DataFrame,
    lat_col: str = "lat",
    lng_col: str = "lng",
    bbox: tuple[float, float, float, float] | None = None,
    grid_size: int = config.KDE_GRID_SIZE,
    bandwidth: Literal["scott", "silverman"] | float = config.KDE_BANDWIDTH,
    sample_max: int | None = 10000,
    seed: int = 42,
) -> KDEGrid:
    """Avalia a densidade em uma grade regular para exportar GeoJSON."""
    lats = df[lat_col].to_numpy()
    lngs = df[lng_col].to_numpy()
    kde = FittedKDE(lats, lngs, bandwidth, None, sample_max, seed)
    if bbox is None:
        bbox = (float(lngs.min()), float(lats.min()), float(lngs.max()), float(lats.max()))
    return kde.grid_density(bbox, grid_size)
