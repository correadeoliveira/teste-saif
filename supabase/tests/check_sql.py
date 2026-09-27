#!/usr/bin/env python3
"""Contrato estático das RPCs (sem Postgres/Docker).

Confere que as migrations existem na ordem certa e que a 006 não
regrediu: device_id obrigatório, clamp de raio, limiares iguais a
mobile/src/services/zone.ts.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SQL_DIR = ROOT / "supabase" / "migrations"
ZONE_TS = ROOT / "mobile" / "src" / "services" / "zone.ts"
SQL_006 = SQL_DIR / "20260621000006_report_crime_and_zone_risk.sql"

EXPECTED_MIGRATIONS = [
    "20260621000001_enable_postgis.sql",
    "20260621000002_create_crimes.sql",
    "20260621000003_create_heatmap_grid.sql",
    "20260621000004_create_views_and_rpcs.sql",
    "20260621000005_create_behavior_profiles.sql",
    "20260621000006_report_crime_and_zone_risk.sql",
]


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    raise SystemExit(1)


def squeeze(text: str) -> str:
    return re.sub(r"\s+", "", text.lower())


def clamp_radius(radius: int | None) -> int:
    value = 250 if radius is None else radius
    return min(max(value, 50), 2000)


def main() -> None:
    found = sorted(p.name for p in SQL_DIR.glob("*.sql"))
    if found != EXPECTED_MIGRATIONS:
        fail(f"migrations fora de ordem ou faltando:\n  {found}\n  esperado {EXPECTED_MIGRATIONS}")

    sql = SQL_006.read_text(encoding="utf-8")
    compact = squeeze(sql)
    zone = ZONE_TS.read_text(encoding="utf-8")

    if "if p_device_id is null" not in sql:
        fail("006 deve rejeitar p_device_id null")
    if "device_required" not in sql:
        fail("006 deve devolver error device_required")
    if "least(greatest(coalesce(p_radius_meters,250),50),2000)" not in compact:
        fail("006 deve clampar o raio em [50, 2000]")
    if "securitydefiner" not in compact:
        fail("report_crime precisa de SECURITY DEFINER (MVP anon)")

    for needle in (
        "maxdensity>=0.75",
        "nearbycount>=20",
        "maxdensity>=0.4",
        "nearbycount>=8",
        "maxdensity>=0.2",
        "nearbycount>=3",
    ):
        if needle not in squeeze(zone):
            fail(f"zone.ts perdeu limiar {needle}")

    for needle in (
        "dens.d>=0.75ornearby.n>=20",
        "dens.d>=0.40ornearby.n>=8",
        "dens.d>=0.20ornearby.n>=3",
    ):
        if needle not in compact:
            fail(f"zone_risk SQL perdeu limiar {needle}")

    assert clamp_radius(99999) == 2000
    assert clamp_radius(10) == 50
    assert clamp_radius(250) == 250
    assert clamp_radius(None) == 250
    print("sql-contract ok")


if __name__ == "__main__":
    main()
