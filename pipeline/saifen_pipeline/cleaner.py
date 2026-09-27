"""
Limpeza, normalização e categorização das ocorrências SSP-SP.

Responsabilidades:
    1. Adaptar produto (celulares | spdados) para colunas canônicas.
    2. Marcar geo_quality sem imputar coordenadas.
    3. Padronizar tipo de crime e período do dia.
    4. Filtrar ano-fonte e bbox da capital.
    5. Dedup por boletim.
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Final

import pandas as pd

from saifen_pipeline import config
from saifen_pipeline.adapters import detect_adapter

CLEAN_COLUMNS: Final[list[str]] = [
    "event_id",
    "lat",
    "lng",
    "crime_type",
    "crime_type_raw",
    "period",
    "occurred_at",
    "neighborhood",
    "city",
    "street",
    "police_unit",
    "sectional",
    "department",
    "phone_brand",
    "bo_number",
    "source",
    "source_year",
    "source_file",
    "geo_quality",
    "ingestion_timestamp",
]


def _to_crime_type(rubrica: str | float) -> str:
    """Mapeia natureza/RUBRICA para o vocabulário do frontend."""
    if not isinstance(rubrica, str):
        return "outros"
    r = rubrica.lower()
    if "furto" in r:
        return "furto"
    if "roubo" in r:
        return "roubo"
    return "outros"


def _hour_to_period(hour: int | float) -> str | None:
    if pd.isna(hour):
        return None
    h = int(hour)
    if 6 <= h < 12:
        return "manha"
    if 12 <= h < 18:
        return "tarde"
    if 18 <= h < 24:
        return "noite"
    return "madrugada"


def _descr_periodo_to_period(descr: str | float) -> str | None:
    if not isinstance(descr, str):
        return None
    d = descr.strip().lower()
    if "manh" in d:
        return "manha"
    if "tarde" in d:
        return "tarde"
    if "noite" in d:
        return "noite"
    if "madrugada" in d:
        return "madrugada"
    return None


def _extract_hour(hora: object) -> int | None:
    try:
        if hora is None or pd.isna(hora):
            return None
    except (ValueError, TypeError):
        pass
    if hasattr(hora, "hour"):
        h = hora.hour
        if h is None or (isinstance(h, float) and pd.isna(h)):
            return None
        return int(h)
    text = str(hora).strip()
    if not text or text.lower() in {"nan", "nat", "none"}:
        return None
    try:
        return int(text.split(":")[0])
    except (ValueError, IndexError):
        return None


def _event_id(row: pd.Series) -> str:
    key = f"{row.get('bo_number')}|{row.get('versao')}|{row.get('ano_bo')}|{row.get('lat')}|{row.get('lng')}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:16]


def _is_sao_paulo_city(value: object) -> bool:
    if not isinstance(value, str):
        return True
    v = value.upper().replace("Ã", "A").replace("Á", "A").replace(".", "").replace(" ", "")
    return (
        v in {"SAOPAULO", "SPAULO", "SAOPAULO/SP", "SÃOPAULO"} or "SAOPAULO" in v or v in {"SPAULO"}
    )


def _tag_geo_quality(
    df: pd.DataFrame,
    bbox: tuple[float, float, float, float] | None,
) -> pd.Series:
    lat = pd.to_numeric(df["lat"], errors="coerce")
    lng = pd.to_numeric(df["lng"], errors="coerce")
    quality = pd.Series("valid", index=df.index, dtype="object")
    missing = lat.isna() | lng.isna()
    quality.loc[missing] = "missing"
    zero = (~missing) & ((lat == 0) | (lng == 0))
    quality.loc[zero] = "zero"
    if bbox is not None:
        min_lng, min_lat, max_lng, max_lat = bbox
        inside = lat.between(min_lat, max_lat) & lng.between(min_lng, max_lng)
        quality.loc[(~missing) & (~zero) & (~inside)] = "out_of_bbox"
    return quality


def filter_bbox(
    df: pd.DataFrame,
    bbox: tuple[float, float, float, float] = config.SP_BBOX,
    lat_col: str = "lat",
    lng_col: str = "lng",
) -> pd.DataFrame:
    """Mantém apenas linhas dentro da bbox (min_lng, min_lat, max_lng, max_lat)."""
    min_lng, min_lat, max_lng, max_lat = bbox
    mask = df[lat_col].between(min_lat, max_lat) & df[lng_col].between(min_lng, max_lng)
    return df.loc[mask].copy()


def clean(
    df_raw: pd.DataFrame,
    bbox: tuple[float, float, float, float] | None = config.SP_BBOX,
    drop_duplicate_bo: bool = True,
    source_year: int | None = config.SOURCE_YEAR,
    heatmap_ready: bool = True,
) -> pd.DataFrame:
    """
    Limpeza completa: input bruto -> DataFrame padronizado.

    Parameters
    ----------
    heatmap_ready : bool
        Se True (padrão), devolve só linhas com geo_quality==valid
        (compatível com o heatmap / testes existentes).
        Se False, mantém todas as linhas com geo_quality preenchido.
    """
    adapter = detect_adapter(df_raw)
    df = adapter.prepare(df_raw)
    rows_in = len(df_raw)
    ingested_at = datetime.now(timezone.utc).isoformat(timespec="seconds")

    df["lat"] = pd.to_numeric(df["lat"], errors="coerce")
    df["lng"] = pd.to_numeric(df["lng"], errors="coerce")
    df["geo_quality"] = _tag_geo_quality(df, bbox=bbox)

    df["crime_type_raw"] = df["crime_type_raw"].astype("string")
    df["crime_type"] = df["crime_type_raw"].map(_to_crime_type)
    df["occurred_at"] = pd.to_datetime(df["occurred_at_raw"], errors="coerce")

    hours = df["hora_raw"].map(_extract_hour)
    from_hour = hours.map(lambda h: _hour_to_period(h) if h is not None else None)
    from_descr = df["period_raw"].map(_descr_periodo_to_period)
    df["period"] = from_hour.fillna(from_descr)

    for col in ("neighborhood", "city", "street", "police_unit", "sectional", "department"):
        df[col] = df[col].astype("string").str.strip()
    df["neighborhood"] = df["neighborhood"].str.upper()
    df["city"] = df["city"].str.upper()

    df["source"] = df["_source"]
    df["source_year"] = source_year
    df["source_file"] = df["source_file"].astype("string")
    df["ingestion_timestamp"] = ingested_at
    df["event_id"] = df.apply(_event_id, axis=1)

    drop_reasons: dict[str, int] = {
        "geo_missing": int((df["geo_quality"] == "missing").sum()),
        "geo_zero": int((df["geo_quality"] == "zero").sum()),
        "geo_out_of_bbox": int((df["geo_quality"] == "out_of_bbox").sum()),
    }

    if source_year is not None:
        in_year = df["occurred_at"].dt.year.eq(source_year) | df["occurred_at"].isna()
        drop_reasons["outside_source_year"] = int((~in_year).sum())
        df = df.loc[in_year].copy()

    if drop_duplicate_bo:
        before = len(df)
        key_cols = [c for c in ("bo_number", "versao", "ano_bo") if c in df.columns]
        if key_cols and df["bo_number"].notna().any():
            df = df.drop_duplicates(subset=key_cols, keep="first")
        drop_reasons["duplicate_bo"] = before - len(df)

    if heatmap_ready:
        df = df.loc[df["geo_quality"] == "valid"].copy()

    out = df[[c for c in CLEAN_COLUMNS if c in df.columns]].reset_index(drop=True)
    out.attrs["rows_in"] = rows_in
    out.attrs["rows_out"] = len(out)
    out.attrs["drop_rate"] = 1 - len(out) / max(rows_in, 1)
    out.attrs["drop_reasons"] = drop_reasons
    out.attrs["source"] = adapter.name
    return out


def summarize(df_clean: pd.DataFrame) -> dict:
    """Sumário descritivo para arquivos output/summary.json."""
    n = len(df_clean)
    by_type = df_clean["crime_type"].value_counts().to_dict() if n else {}
    by_period = df_clean["period"].value_counts(dropna=False).to_dict() if n else {}
    top_neigh = df_clean["neighborhood"].value_counts().head(15).to_dict() if n else {}
    top_brands: dict = {}
    if n and "phone_brand" in df_clean.columns:
        top_brands = df_clean["phone_brand"].dropna().value_counts().head(10).to_dict()
    date_min = df_clean["occurred_at"].min() if n else pd.NaT
    date_max = df_clean["occurred_at"].max() if n else pd.NaT
    bbox_actual = [None, None, None, None]
    if n and df_clean["lng"].notna().any():
        bbox_actual = [
            float(df_clean["lng"].min()),
            float(df_clean["lat"].min()),
            float(df_clean["lng"].max()),
            float(df_clean["lat"].max()),
        ]

    return {
        "total_incidents": n,
        "by_crime_type": {k: int(v) for k, v in by_type.items()},
        "by_period": {str(k): int(v) for k, v in by_period.items()},
        "top_neighborhoods": {k: int(v) for k, v in top_neigh.items() if k is not None},
        "top_phone_brands": {str(k): int(v) for k, v in top_brands.items()},
        "date_range": {
            "min": str(date_min) if pd.notna(date_min) else None,
            "max": str(date_max) if pd.notna(date_max) else None,
        },
        "bbox": bbox_actual,
        "drop_reasons": df_clean.attrs.get("drop_reasons", {}),
        "source": df_clean.attrs.get("source"),
        "disclaimer": config.DISCLAIMER,
    }
