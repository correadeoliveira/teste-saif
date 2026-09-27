"""
Ingestão e validação de planilhas brutas da SSP-SP.

Não baixa da internet (não há permalink estável). Espera o XLSX
já dropado em data/raw/. Calcula SHA-256, inspeciona sheets/colunas
e grava data/raw/manifest.json.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd

from saifen_pipeline import config
from saifen_pipeline.adapters.base import normalize_column_name
from saifen_pipeline.log import log_event

CELULARES_GLOB = "CelularesSubtraidos_*.xlsx"
SPDADOS_GLOB = "SPDadosCriminais_*.xlsx"


def sha256_file(path: Path, chunk_size: int = 1 << 20) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        while True:
            chunk = fh.read(chunk_size)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def _load_schema(product: str) -> dict[str, Any]:
    path = config.SCHEMA_DIR / f"{product}_{config.SOURCE_YEAR}.json"
    if not path.exists():
        raise FileNotFoundError(f"Schema snapshot ausente: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def detect_product(path: Path) -> str:
    name = path.name.lower()
    if name.startswith("spdadoscriminais"):
        return "spdados"
    if name.startswith("celularessubtraidos"):
        return "celulares"
    return "unknown"


def list_candidate_files(raw_dir: Path | None = None, year: int | None = None) -> list[Path]:
    raw_dir = raw_dir or config.RAW_DIR
    year = year or config.SOURCE_YEAR
    spdados = sorted(raw_dir.glob(f"SPDadosCriminais_{year}.xlsx"))
    if spdados:
        return spdados
    celulares = sorted(raw_dir.glob(f"CelularesSubtraidos_{year}.xlsx"))
    if celulares:
        return celulares
    # fallback: qualquer xlsx do ano / padrão conhecido
    all_xlsx = sorted(p for p in raw_dir.glob("*.xlsx") if not p.name.startswith("~$"))
    return all_xlsx


def resolve_source(raw_dir: Path | None = None, year: int | None = None) -> Path:
    files = list_candidate_files(raw_dir, year)
    if not files:
        raise FileNotFoundError(
            f"Nenhum .xlsx em {raw_dir or config.RAW_DIR}. "
            "Baixe SPDadosCriminais_2026.xlsx ou CelularesSubtraidos_2026.xlsx "
            "em https://www.ssp.sp.gov.br/estatistica/consultas e coloque em data/raw/."
        )
    # Preferência: spdados > celulares (plano)
    spdados = [p for p in files if detect_product(p) == "spdados"]
    if spdados:
        return spdados[0]
    celulares = [p for p in files if detect_product(p) == "celulares"]
    if celulares:
        return celulares[0]
    return files[0]


def _detect_data_sheet(path: Path) -> str:
    xf = pd.ExcelFile(path)
    sheets = xf.sheet_names
    for s in sheets:
        if s.upper().startswith("CELULAR"):
            return s
    for s in sheets:
        upper = s.upper()
        if upper in {"METODOLOGIA", "DICIONARIO DE DADOS", "DICIONÁRIO DE DADOS"}:
            continue
        peek = pd.read_excel(path, sheet_name=s, nrows=0)
        cols = {normalize_column_name(c) for c in peek.columns}
        if "LATITUDE" in cols and "LONGITUDE" in cols:
            return s
    raise ValueError(
        f"Nenhuma sheet de dados com LATITUDE/LONGITUDE em {path.name}. "
        f"Sheets: {sheets}"
    )


def profile_xlsx(path: Path, sample_rows: int | None = None) -> dict[str, Any]:
    """Inspeciona sheets, colunas, n linhas e qualidade geo (sem imputar)."""
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(path)

    xf = pd.ExcelFile(path)
    sheets = xf.sheet_names
    data_sheet = _detect_data_sheet(path)
    header = pd.read_excel(path, sheet_name=data_sheet, nrows=0)
    columns = [str(c) for c in header.columns]
    norm_cols = [normalize_column_name(c) for c in columns]

    usecols = [c for c in columns if normalize_column_name(c) in {"LATITUDE", "LONGITUDE"}]
    geo = pd.read_excel(path, sheet_name=data_sheet, usecols=usecols or None)
    n_rows = int(len(geo))

    lat = pd.to_numeric(geo.get("LATITUDE", geo.iloc[:, 0] if usecols else None), errors="coerce")
    lng = pd.to_numeric(geo.get("LONGITUDE", geo.iloc[:, 1] if len(geo.columns) > 1 else None), errors="coerce")
    n_missing = int((lat.isna() | lng.isna()).sum())
    n_zero = int(((lat == 0) | (lng == 0)).sum())
    n_valid_raw = n_rows - n_missing - n_zero

    product = detect_product(path)
    checksum = sha256_file(path)

    profile: dict[str, Any] = {
        "file": path.name,
        "path": str(path),
        "product": product,
        "sha256": checksum,
        "size_bytes": path.stat().st_size,
        "sheets": sheets,
        "data_sheet": data_sheet,
        "n_columns": len(columns),
        "columns": columns,
        "columns_normalized": norm_cols,
        "n_rows": n_rows,
        "geo": {
            "n_missing": n_missing,
            "n_zero": n_zero,
            "n_nonnull_nonzero": n_valid_raw,
            "pct_missing_or_zero": round((n_missing + n_zero) / max(n_rows, 1), 4),
        },
        "profiled_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source_year": config.SOURCE_YEAR,
    }
    if sample_rows:
        profile["sample_rows"] = sample_rows
    return profile


def validate_profile(profile: dict[str, Any], product: str | None = None) -> list[str]:
    """Retorna lista de erros. Vazia = ok."""
    product = product or profile.get("product") or "celulares"
    if product == "unknown":
        product = "celulares"
    schema = _load_schema(product if product in {"celulares", "spdados"} else "celulares")
    errors: list[str] = []
    cols = {c.upper().replace(" ", "_") for c in profile.get("columns_normalized", [])}

    for required in schema.get("required_columns", []):
        if required.upper().replace(" ", "_") not in cols:
            errors.append(f"coluna obrigatória ausente: {required}")

    for group_key in ("nature_columns_any", "date_columns_any"):
        options = schema.get(group_key) or []
        if options and not any(o.upper().replace(" ", "_") in cols for o in options):
            errors.append(f"nenhuma coluna de {group_key} encontrada: {options}")

    if profile.get("n_rows", 0) < 1:
        errors.append("sheet de dados vazia")
    return errors


def write_manifest(
    profiles: list[dict[str, Any]],
    path: Path | None = None,
) -> Path:
    path = path or config.MANIFEST_PATH
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "SSP-SP consultas (drop manual — sem permalink estável)",
        "source_url": "https://www.ssp.sp.gov.br/estatistica/consultas",
        "disclaimer": config.DISCLAIMER,
        "files": profiles,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def ingest(
    raw_dir: Path | None = None,
    year: int | None = None,
    strict: bool = True,
) -> dict[str, Any]:
    """Valida o XLSX escolhido, grava manifest e devolve o profile."""
    source = resolve_source(raw_dir, year)
    log_event("ingest.start", file=source.name, product=detect_product(source))
    profile = profile_xlsx(source)
    errors = validate_profile(profile)
    profile["schema_errors"] = errors
    if errors and strict:
        log_event("ingest.invalid", file=source.name, errors=errors)
        raise ValueError(f"Schema inválido em {source.name}: {errors}")
    write_manifest([profile])
    log_event(
        "ingest.ok",
        file=source.name,
        sha256=profile["sha256"],
        n_rows=profile["n_rows"],
        geo_missing=profile["geo"]["n_missing"],
        geo_zero=profile["geo"]["n_zero"],
        product=profile["product"],
        data_sheet=profile["data_sheet"],
    )
    return profile
