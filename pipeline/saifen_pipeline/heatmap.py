"""Geração dos artefatos de heatmap a partir de um SpatialModel."""

from __future__ import annotations

import inspect
from pathlib import Path

import numpy as np
import pandas as pd

from saifen_pipeline import config, exporter
from saifen_pipeline.log import log_event
from saifen_pipeline.models.base import SpatialModel


def _refit(model: SpatialModel, df: pd.DataFrame) -> SpatialModel:
    sig = inspect.signature(type(model).__init__)
    kwargs = {k: v for k, v in model.params().items() if k in sig.parameters}
    clone = type(model)(**kwargs)
    clone.fit(df)
    return clone


def generate_artifacts(
    df: pd.DataFrame,
    model: SpatialModel,
    per_type: bool = True,
    per_period: bool = True,
    min_density: float = config.KDE_MIN_DENSITY,
    sample_max: int = 10_000,
    write_grid: bool = True,
    write_crimes: bool = True,
) -> list[Path]:
    outputs: list[Path] = []
    points = model.to_heatmap_points(sample_max=sample_max)
    outputs.append(
        exporter.write_heatmap_points(
            points,
            crime_type="all",
            period="all",
            extra_meta=model.params(),
        )
    )
    log_event("heatmap.points", count=len(points), crime_type="all", period="all")

    if write_grid:
        grid = model.predict_grid(bbox=config.SP_BBOX)
        outputs.append(exporter.write_heatmap_grid(grid, min_density=min_density))
        log_event("heatmap.grid", cells=int((grid.zi >= min_density).sum()))

    if per_type and "crime_type" in df.columns:
        for ctype in config.HEATMAP_CRIME_TYPES:
            subset = df[df["crime_type"] == ctype]
            if len(subset) < 3:
                continue
            try:
                slice_model = _refit(model, subset)
            except (TypeError, ValueError, np.linalg.LinAlgError):
                log_event("heatmap.slice_skip", crime_type=ctype, n=len(subset))
                continue
            pts = slice_model.to_heatmap_points(sample_max=max(sample_max // 2, 100))
            outputs.append(
                exporter.write_heatmap_points(
                    pts,
                    path=config.HEATMAP_DIR / f"heatmap_points__{ctype}.json",
                    crime_type=ctype,
                    period="all",
                    extra_meta=slice_model.params(),
                )
            )
            log_event("heatmap.points", count=len(pts), crime_type=ctype, period="all")
            if per_period and "period" in subset.columns:
                for period in config.PERIODS:
                    sub2 = subset[subset["period"] == period]
                    if len(sub2) < 3:
                        continue
                    try:
                        pmodel = _refit(model, sub2)
                    except (TypeError, ValueError, np.linalg.LinAlgError):
                        continue
                    ppts = pmodel.to_heatmap_points(sample_max=max(sample_max // 4, 50))
                    outputs.append(
                        exporter.write_heatmap_points(
                            ppts,
                            path=config.HEATMAP_DIR / f"heatmap_points__{ctype}__{period}.json",
                            crime_type=ctype,
                            period=period,
                            extra_meta=pmodel.params(),
                        )
                    )
                    log_event(
                        "heatmap.points",
                        count=len(ppts),
                        crime_type=ctype,
                        period=period,
                    )

    if write_crimes:
        keep = ("crime_type", "period", "occurred_at", "neighborhood")
        sample = df.sample(min(5_000, len(df)), random_state=0) if len(df) else df
        outputs.append(exporter.write_crimes_geojson(sample, keep_cols=keep))

    return outputs
