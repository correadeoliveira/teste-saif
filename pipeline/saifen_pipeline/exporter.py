"""
Serialização dos artefatos consumíveis pelo frontend.

Convenções:
    - heatmap_points.json   : [[lat, lng, weight], ...] (Leaflet.heat)
    - heatmap_grid.geojson  : FeatureCollection de Polygons (Mapbox GL JS)
    - crimes.geojson        : FeatureCollection de Points (debug / Supabase)
    - summary.json          : estatísticas descritivas

Todos os arquivos vão para `output/heatmaps/` por padrão e podem ser
servidos estaticamente (Vercel/Netlify) ou ingeridos no Supabase
(via shape PostGIS).
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from saifen_pipeline import config
from saifen_pipeline.kde import KDEGrid


def _meta(extra: dict | None = None) -> dict[str, Any]:
    out = {
        "generator": "saifen_pipeline",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "version": "0.1.0",
    }
    if extra:
        out.update(extra)
    return out


def write_heatmap_points(
    points: list[list[float]],
    path: Path = config.HEATMAP_DIR / "heatmap_points.json",
    crime_type: str = "all",
    period: str = "all",
) -> Path:
    """Salva pontos no formato Leaflet.heat ([[lat, lng, weight], ...])."""
    payload = {
        "meta": _meta({"crime_type": crime_type, "period": period}),
        "count": len(points),
        "points": points,
    }
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    return path


def grid_to_geojson(
    grid: KDEGrid,
    min_density: float = config.KDE_MIN_DENSITY,
) -> dict[str, Any]:
    """
    Converte um KDEGrid em FeatureCollection de quadrículas (Polygon).

    Cada feature tem `properties.density ∈ [0,1]`, pronto para
    `fill-opacity` interpolado no Mapbox GL JS.

    Células abaixo de `min_density` são descartadas para enxugar o JSON.
    """
    xi, yi, zi = grid.xi, grid.yi, grid.zi
    dx = float(xi[1] - xi[0]) if len(xi) > 1 else 0.0
    dy = float(yi[1] - yi[0]) if len(yi) > 1 else 0.0

    features: list[dict[str, Any]] = []
    for i, y in enumerate(yi):
        for j, x in enumerate(xi):
            d = float(zi[i, j])
            if d < min_density:
                continue
            features.append(
                {
                    "type": "Feature",
                    "properties": {"density": round(d, 4)},
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [
                            [
                                [x,       y],
                                [x + dx,  y],
                                [x + dx,  y + dy],
                                [x,       y + dy],
                                [x,       y],
                            ]
                        ],
                    },
                }
            )

    return {
        "type": "FeatureCollection",
        "bbox": list(grid.bbox),
        "metadata": _meta(
            {
                "grid_size": len(xi),
                "n_points": grid.n_points,
                "bandwidth": grid.bandwidth,
                "min_density_threshold": min_density,
            }
        ),
        "features": features,
    }


def write_heatmap_grid(
    grid: KDEGrid,
    path: Path = config.HEATMAP_DIR / "heatmap_grid.geojson",
    min_density: float = config.KDE_MIN_DENSITY,
) -> Path:
    fc = grid_to_geojson(grid, min_density=min_density)
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(fc, ensure_ascii=False, separators=(",", ":")))
    return path


def write_crimes_geojson(
    df: pd.DataFrame,
    path: Path = config.HEATMAP_DIR / "crimes.geojson",
    keep_cols: tuple[str, ...] = (
        "crime_type",
        "period",
        "occurred_at",
        "neighborhood",
        "phone_brand",
    ),
) -> Path:
    """Exporta cada ocorrência como Point (útil para debug / camadas de marker)."""
    features = []
    for row in df.itertuples(index=False):
        props = {}
        for c in keep_cols:
            v = getattr(row, c, None)
            if isinstance(v, (pd.Timestamp, datetime)):
                v = v.isoformat()
            elif isinstance(v, float) and np.isnan(v):
                v = None
            elif v is None or pd.isna(v):
                v = None
            props[c] = v

        features.append(
            {
                "type": "Feature",
                "properties": props,
                "geometry": {
                    "type": "Point",
                    "coordinates": [float(row.lng), float(row.lat)],
                },
            }
        )

    fc = {
        "type": "FeatureCollection",
        "metadata": _meta({"count": len(features)}),
        "features": features,
    }
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(fc, ensure_ascii=False, separators=(",", ":")))
    return path


def write_summary(
    summary: dict,
    path: Path = config.OUTPUT_DIR / "summary.json",
) -> Path:
    payload = {"meta": _meta(), **summary}
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    return path


def write_processed_parquet(
    df: pd.DataFrame,
    path: Path = config.PROCESSED_DIR / "celulares_clean.parquet",
) -> Path:
    """Cache local em parquet (ignored pelo git)."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(path, index=False)
    return path
