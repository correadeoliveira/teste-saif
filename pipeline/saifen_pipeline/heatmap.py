"""Geração dos artefatos de heatmap a partir de um SpatialModel."""

from __future__ import annotations

import inspect
from pathlib import Path

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
    output_dir: Path | None = None,
) -> list[Path]:
    dest = output_dir or config.HEATMAP_DIR
    outputs: list[Path] = []

    def write_points(
        fitted: SpatialModel, limit: int, crime_type: str = "all", period: str = "all"
    ) -> None:
        suffix = "" if crime_type == "all" else f"__{crime_type}"
        if period != "all":
            suffix += f"__{period}"
        points = fitted.to_heatmap_points(sample_max=limit)
        outputs.append(
            exporter.write_heatmap_points(
                points,
                dest / f"heatmap_points{suffix}.json",
                crime_type=crime_type,
                period=period,
                extra_meta=fitted.params(),
            )
        )
        log_event("heatmap.points", count=len(points), crime_type=crime_type, period=period)

    def fit_slice(subset: pd.DataFrame, crime_type: str, period: str, limit: int) -> None:
        try:
            if len(subset) < 3:
                raise ValueError("insufficient_points")
            fitted = _refit(model, subset)
        except ValueError:
            log_event("heatmap.slice_skip", crime_type=crime_type, period=period, count=len(subset))
            return
        write_points(fitted, limit, crime_type, period)

    write_points(model, sample_max)
    if write_grid:
        grid = model.predict_grid(bbox=config.SP_BBOX)
        outputs.append(
            exporter.write_heatmap_grid(grid, dest / "heatmap_grid.geojson", min_density)
        )
        log_event("heatmap.grid", cells=int((grid.zi >= min_density).sum()))

    if per_type and "crime_type" in df.columns:
        for crime_type in config.HEATMAP_CRIME_TYPES:
            subset = df[df["crime_type"] == crime_type]
            fit_slice(subset, crime_type, "all", max(sample_max // 2, 100))
            if per_period and "period" in subset.columns:
                for period in config.PERIODS:
                    subset_period = subset[subset["period"] == period]
                    fit_slice(subset_period, crime_type, period, max(sample_max // 4, 50))

    if write_crimes:
        keep = ("crime_type", "period", "occurred_at", "neighborhood")
        sample = df.sample(min(5_000, len(df)), random_state=0) if len(df) else df
        outputs.append(exporter.write_crimes_geojson(sample, dest / "crimes.geojson", keep))

    return outputs
