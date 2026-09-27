"""Agregação espacial em grade regular (~H3 res 8)."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from saifen_pipeline import config


@dataclass(frozen=True)
class CountGrid:
    """Contagens por célula de grade regular."""

    xi: np.ndarray
    yi: np.ndarray
    counts: np.ndarray  # shape (len(yi), len(xi))
    bbox: tuple[float, float, float, float]
    cell_deg: float
    n_points: int

    @property
    def density(self) -> np.ndarray:
        peak = float(self.counts.max()) if self.counts.size else 0.0
        if peak <= 0:
            return np.zeros_like(self.counts, dtype=np.float32)
        return (self.counts / peak).astype(np.float32)


def cell_indices(
    lat: float,
    lng: float,
    bbox: tuple[float, float, float, float] = config.SP_BBOX,
    cell_deg: float = config.GRID_CELL_DEG,
) -> tuple[int, int]:
    min_lng, min_lat, max_lng, max_lat = bbox
    j = int(np.floor((lng - min_lng) / cell_deg))
    i = int(np.floor((lat - min_lat) / cell_deg))
    n_j = max(int(np.ceil((max_lng - min_lng) / cell_deg)), 1)
    n_i = max(int(np.ceil((max_lat - min_lat) / cell_deg)), 1)
    j = min(max(j, 0), n_j - 1)
    i = min(max(i, 0), n_i - 1)
    return i, j


def cell_id(lat: float, lng: float, **kwargs) -> str:
    i, j = cell_indices(lat, lng, **kwargs)
    return f"{i}:{j}"


def assign_cells(
    df: pd.DataFrame,
    bbox: tuple[float, float, float, float] = config.SP_BBOX,
    cell_deg: float = config.GRID_CELL_DEG,
    lat_col: str = "lat",
    lng_col: str = "lng",
) -> pd.DataFrame:
    out = df.copy()
    ids = [
        cell_id(float(lat), float(lng), bbox=bbox, cell_deg=cell_deg)
        for lat, lng in zip(out[lat_col], out[lng_col])
    ]
    out["cell_id"] = ids
    return out


def aggregate_counts(
    df: pd.DataFrame,
    bbox: tuple[float, float, float, float] = config.SP_BBOX,
    cell_deg: float = config.GRID_CELL_DEG,
    lat_col: str = "lat",
    lng_col: str = "lng",
) -> CountGrid:
    min_lng, min_lat, max_lng, max_lat = bbox
    n_j = max(int(np.ceil((max_lng - min_lng) / cell_deg)), 1)
    n_i = max(int(np.ceil((max_lat - min_lat) / cell_deg)), 1)
    xi = min_lng + (np.arange(n_j) + 0.5) * cell_deg
    yi = min_lat + (np.arange(n_i) + 0.5) * cell_deg
    counts = np.zeros((n_i, n_j), dtype=np.int32)
    if df.empty:
        return CountGrid(xi=xi, yi=yi, counts=counts, bbox=bbox, cell_deg=cell_deg, n_points=0)
    for lat, lng in zip(df[lat_col].to_numpy(), df[lng_col].to_numpy()):
        i, j = cell_indices(float(lat), float(lng), bbox=bbox, cell_deg=cell_deg)
        counts[i, j] += 1
    return CountGrid(
        xi=xi,
        yi=yi,
        counts=counts,
        bbox=bbox,
        cell_deg=cell_deg,
        n_points=len(df),
    )


def features_frame(grid: CountGrid) -> pd.DataFrame:
    rows = []
    for i, lat in enumerate(grid.yi):
        for j, lng in enumerate(grid.xi):
            c = int(grid.counts[i, j])
            if c == 0:
                continue
            rows.append(
                {
                    "cell_id": f"{i}:{j}",
                    "centroid_lat": float(lat),
                    "centroid_lng": float(lng),
                    "count": c,
                    "rate_per_100k": None,
                    "exposure": None,
                    "density": float(grid.density[i, j]),
                }
            )
    return pd.DataFrame(rows)
