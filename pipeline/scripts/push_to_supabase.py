#!/usr/bin/env python3
"""
push_to_supabase.py
───────────────────
Sobe o dataset limpo para o Supabase (tabelas `crimes` e `heatmap_grid`)
seguindo a arquitetura MVP:

    crimes        — pontos individuais (PostGIS POINT)
    heatmap_grid  — células KDE (PostGIS POLYGON + density)

Stub do MVP: configurar credenciais em `.env`:

    SUPABASE_URL=https://xxx.supabase.co
    SUPABASE_SERVICE_KEY=eyJ...

Tabelas esperadas (criar manualmente no SQL editor do Supabase):

    create extension if not exists postgis;

    create table if not exists crimes (
        id            bigserial primary key,
        lat           double precision not null,
        lng           double precision not null,
        crime_type    text,
        period        text,
        occurred_at   timestamptz,
        neighborhood  text,
        city          text,
        street        text,
        police_unit   text,
        phone_brand   text,
        bo_number     text,
        source_file   text,
        geom          geography(point, 4326) generated always as (
            st_setsrid(st_makepoint(lng, lat), 4326)::geography
        ) stored
    );

    create table if not exists heatmap_grid (
        id          bigserial primary key,
        density     real not null,
        cell        geography(polygon, 4326) not null,
        generated_at timestamptz default now()
    );

Uso:
    python scripts/push_to_supabase.py                # sobe crimes (incremental)
    python scripts/push_to_supabase.py --truncate     # apaga tabelas antes
    python scripts/push_to_supabase.py --grid-only    # só heatmap_grid
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import pandas as pd

PIPELINE_DIR = Path(__file__).resolve().parents[1]
if str(PIPELINE_DIR) not in sys.path:
    sys.path.insert(0, str(PIPELINE_DIR))

from saifen_pipeline import config  # noqa: E402
from saifen_pipeline.integrations import supabase as sb  # noqa: E402

CHUNK_SIZE = sb.CHUNK_SIZE


def _connect():
    return sb.get_client()


def _push_crimes(client, df: pd.DataFrame, truncate: bool) -> None:
    if truncate:
        print("[crimes] TRUNCATE ...")
        client.table("crimes").delete().neq("id", 0).execute()

    records = []
    for r in df.itertuples(index=False):
        records.append(
            {
                "lat": float(r.lat),
                "lng": float(r.lng),
                "crime_type": r.crime_type,
                "period": r.period,
                "occurred_at": r.occurred_at.isoformat() if pd.notna(r.occurred_at) else None,
                "neighborhood": r.neighborhood if pd.notna(r.neighborhood) else None,
                "city": r.city if pd.notna(r.city) else None,
                "street": r.street if pd.notna(r.street) else None,
                "police_unit": r.police_unit if pd.notna(r.police_unit) else None,
                "phone_brand": r.phone_brand if pd.notna(r.phone_brand) else None,
                "bo_number": r.bo_number if pd.notna(r.bo_number) else None,
                "source_file": r.source_file if pd.notna(r.source_file) else None,
            }
        )

    print(f"[crimes] inserindo {len(records):,} registros em lotes de {CHUNK_SIZE}...")
    for i in range(0, len(records), CHUNK_SIZE):
        chunk = records[i : i + CHUNK_SIZE]
        client.table("crimes").insert(chunk).execute()
        print(f"  · {i + len(chunk):>6,}/{len(records):,}")


def _push_grid(client, truncate: bool) -> None:
    geojson_path = config.HEATMAP_DIR / "heatmap_grid.geojson"
    if not geojson_path.exists():
        print(
            f"AVISO: {geojson_path} não existe. "
            "Rode `python scripts/generate_heatmap.py` antes.",
            file=sys.stderr,
        )
        return

    fc = json.loads(geojson_path.read_text())
    if truncate:
        print("[heatmap_grid] TRUNCATE ...")
        client.table("heatmap_grid").delete().neq("id", 0).execute()

    records = []
    for feat in fc["features"]:
        coords = feat["geometry"]["coordinates"][0]
        wkt = "POLYGON((" + ", ".join(f"{x} {y}" for x, y in coords) + "))"
        records.append(
            {
                "density": float(feat["properties"]["density"]),
                "cell": f"SRID=4326;{wkt}",
            }
        )

    print(f"[heatmap_grid] inserindo {len(records):,} células...")
    for i in range(0, len(records), CHUNK_SIZE):
        chunk = records[i : i + CHUNK_SIZE]
        client.table("heatmap_grid").insert(chunk).execute()
        print(f"  · {i + len(chunk):>6,}/{len(records):,}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--truncate", action="store_true", help="Limpa tabelas antes do insert.")
    parser.add_argument("--grid-only", action="store_true", help="Sobe apenas heatmap_grid.")
    parser.add_argument("--crimes-only", action="store_true", help="Sobe apenas crimes.")
    args = parser.parse_args()

    client = _connect()
    print("✓ Conectado ao Supabase")

    if not args.grid_only:
        parquet = config.PROCESSED_DIR / "celulares_clean.parquet"
        if not parquet.exists():
            print(f"ERRO: {parquet} ausente — rode `python scripts/process_xlsx.py`", file=sys.stderr)
            return 1
        df = pd.read_parquet(parquet)
        _push_crimes(client, df, truncate=args.truncate)

    if not args.crimes_only:
        _push_grid(client, truncate=args.truncate)

    print("\n✔ Supabase atualizado")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
