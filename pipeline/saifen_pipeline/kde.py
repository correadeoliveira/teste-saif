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
'silverman' ou um float manual (em graus, espaço lat/lng).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np
import pandas as pd
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


def _build_kde(
    lats: np.ndarray,
    lngs: np.ndarray,
    bandwidth: Literal["scott", "silverman"] | float = config.KDE_BANDWIDTH,
) -> gaussian_kde:
    """Constrói KDE 2D (input em [lng, lat] para alinhar com xy convencional)."""
    if lats.size < 3:
        raise ValueError(
            f"KDE precisa de ao menos 3 pontos; recebido: {lats.size}."
        )
    xy = np.vstack([lngs, lats])
    return gaussian_kde(xy, bw_method=bandwidth)


def point_heatmap(
    df: pd.DataFrame,
    lat_col: str = "lat",
    lng_col: str = "lng",
    bandwidth: Literal["scott", "silverman"] | float = config.KDE_BANDWIDTH,
    sample_max: int | None = 5000,
    seed: int = 42,
) -> list[list[float]]:
    """
    Avalia KDE nos próprios pontos e devolve [[lat, lng, weight], ...].

    Parameters
    ----------
    df : pd.DataFrame com colunas lat/lng (limpas).
    sample_max : int | None
        Se o dataset for grande, faz amostragem estratificada antes de
        construir o KDE para evitar custo O(n²). None => sem amostragem.
        5000 já é mais que suficiente para um heatmap visualmente fiel
        em escala de bairro.

    Returns
    -------
    list[list[float]]
        Compatível com Leaflet.heat: cada elemento é [lat, lng, weight].
    """
    if df.empty:
        return []

    lats = df[lat_col].to_numpy()
    lngs = df[lng_col].to_numpy()

    if sample_max is not None and lats.size > sample_max:
        rng = np.random.default_rng(seed)
        idx = rng.choice(lats.size, size=sample_max, replace=False)
        lats_s, lngs_s = lats[idx], lngs[idx]
    else:
        lats_s, lngs_s = lats, lngs

    kde = _build_kde(lats_s, lngs_s, bandwidth=bandwidth)
    density = kde(np.vstack([lngs_s, lats_s]))

    if density.max() > 0:
        weights = density / density.max()
    else:
        weights = np.zeros_like(density)

    return [
        [float(la), float(ln), float(w)]
        for la, ln, w in zip(lats_s, lngs_s, weights)
    ]


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
    """
    Avalia KDE em uma grade regular sobre `bbox`.

    Útil para gerar GeoJSON de células (Mapbox GL JS, PostGIS hex/quad).

    Parameters
    ----------
    bbox : tuple ou None
        (min_lng, min_lat, max_lng, max_lat). Default = bbox real dos dados.
    grid_size : int
        N células por eixo (grade N x N).
    sample_max : int | None
        Amostragem do conjunto de treino do KDE (não da grade).

    Returns
    -------
    KDEGrid
    """
    if df.empty:
        raise ValueError("DataFrame vazio — sem dados para KDE.")

    lats = df[lat_col].to_numpy()
    lngs = df[lng_col].to_numpy()

    if bbox is None:
        bbox = (
            float(lngs.min()),
            float(lats.min()),
            float(lngs.max()),
            float(lats.max()),
        )

    if sample_max is not None and lats.size > sample_max:
        rng = np.random.default_rng(seed)
        idx = rng.choice(lats.size, size=sample_max, replace=False)
        lats_t, lngs_t = lats[idx], lngs[idx]
    else:
        lats_t, lngs_t = lats, lngs

    kde = _build_kde(lats_t, lngs_t, bandwidth=bandwidth)
    bw_factor = float(kde.factor)

    xi = np.linspace(bbox[0], bbox[2], grid_size)
    yi = np.linspace(bbox[1], bbox[3], grid_size)
    XX, YY = np.meshgrid(xi, yi)
    grid_xy = np.vstack([XX.ravel(), YY.ravel()])
    zi = kde(grid_xy).reshape(grid_size, grid_size)

    zmax = zi.max()
    if zmax > 0:
        zi = zi / zmax

    return KDEGrid(
        xi=xi,
        yi=yi,
        zi=zi.astype(np.float32),
        bbox=bbox,
        bandwidth=bw_factor,
        n_points=int(lats.size),
    )
