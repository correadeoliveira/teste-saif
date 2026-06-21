#!/usr/bin/env python3
"""
generate_heatmap.py
───────────────────
Lê data/processed/celulares_clean.parquet e gera os artefatos
geográficos consumidos pelo frontend:

    output/heatmaps/heatmap_points.json          (todos os crimes)
    output/heatmaps/heatmap_points__<type>.json  (por tipo de crime)
    output/heatmaps/heatmap_grid.geojson         (grade KDE)
    output/heatmaps/crimes.geojson               (pontos individuais — amostra)

Exemplos:
    python scripts/generate_heatmap.py
    python scripts/generate_heatmap.py --grid-size 400 --bandwidth 0.003
    python scripts/generate_heatmap.py --no-per-type
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

PIPELINE_DIR = Path(__file__).resolve().parents[1]
if str(PIPELINE_DIR) not in sys.path:
    sys.path.insert(0, str(PIPELINE_DIR))

from saifen_pipeline import config, exporter, kde  # noqa: E402


def _parse_bandwidth(value: str) -> float | str:
    if value in {"scott", "silverman"}:
        return value
    try:
        return float(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(
            "bandwidth deve ser 'scott', 'silverman' ou um float"
        ) from exc


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--grid-size", type=int, default=config.KDE_GRID_SIZE)
    parser.add_argument("--bandwidth", type=_parse_bandwidth, default=config.KDE_BANDWIDTH)
    parser.add_argument("--sample-max", type=int, default=10_000)
    parser.add_argument("--no-per-type", action="store_true", help="Não gera heatmaps por tipo de crime.")
    parser.add_argument("--no-points", action="store_true", help="Não exporta heatmap_points.json.")
    parser.add_argument("--no-grid", action="store_true", help="Não exporta heatmap_grid.geojson.")
    parser.add_argument("--no-crimes", action="store_true", help="Não exporta crimes.geojson.")
    parser.add_argument(
        "--min-density",
        type=float,
        default=config.KDE_MIN_DENSITY,
        help="Threshold de densidade para incluir células no GeoJSON.",
    )
    args = parser.parse_args()

    parquet = config.PROCESSED_DIR / "celulares_clean.parquet"
    if not parquet.exists():
        print(
            f"ERRO: {parquet} não existe. "
            "Rode antes:  python scripts/process_xlsx.py",
            file=sys.stderr,
        )
        return 1

    df = pd.read_parquet(parquet)
    print(f"[setup] {len(df):,} pontos carregados de {parquet.name}")
    print(f"[setup] bandwidth={args.bandwidth} | grid={args.grid_size}x{args.grid_size} | sample_max={args.sample_max}")

    outputs: list[Path] = []

    if not args.no_points:
        points = kde.point_heatmap(df, sample_max=args.sample_max, bandwidth=args.bandwidth)
        outputs.append(exporter.write_heatmap_points(points))
        print(f"[points] {len(points):,} pontos → heatmap_points.json")

    if not args.no_grid:
        grid = kde.grid_density(
            df,
            bbox=config.SP_BBOX,
            grid_size=args.grid_size,
            bandwidth=args.bandwidth,
            sample_max=args.sample_max,
        )
        outputs.append(exporter.write_heatmap_grid(grid, min_density=args.min_density))
        print(f"[grid]   {args.grid_size}x{args.grid_size} → heatmap_grid.geojson")

    if not args.no_per_type:
        for ctype in df["crime_type"].dropna().unique():
            subset = df[df["crime_type"] == ctype]
            if len(subset) < 100:
                continue
            pts = kde.point_heatmap(subset, sample_max=args.sample_max // 2, bandwidth=args.bandwidth)
            outputs.append(
                exporter.write_heatmap_points(
                    pts,
                    path=config.HEATMAP_DIR / f"heatmap_points__{ctype}.json",
                    crime_type=ctype,
                )
            )
            print(f"[type]   {ctype:10s} ({len(subset):>6,} pontos) → heatmap_points__{ctype}.json")

    if not args.no_crimes:
        sample = df.sample(min(5_000, len(df)), random_state=0)
        outputs.append(exporter.write_crimes_geojson(sample))
        print(f"[geojson] {len(sample):,} pontos → crimes.geojson")

    print("\nArquivos gerados:")
    for p in outputs:
        size_kb = p.stat().st_size / 1024
        print(f"   {p.relative_to(config.ROOT_DIR)} ({size_kb:,.1f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
