"""
Limpeza, normalização e categorização das ocorrências SSP-SP.

Responsabilidades:
    1. Manter apenas linhas com latitude/longitude válidas e dentro da bbox.
    2. Padronizar tipo de crime (RUBRICA -> 'furto' | 'roubo').
    3. Padronizar período do dia (HORA_OCORRENCIA + DESCR_PERIODO ->
       'manha' | 'tarde' | 'noite' | 'madrugada').
    4. Normalizar string fields (BAIRRO, CIDADE em uppercase, sem espaços extras).
    5. Reduzir o DataFrame às colunas que o pipeline downstream consome.

Esse módulo é puro: recebe DataFrame, devolve DataFrame, sem I/O.
"""

from __future__ import annotations

from typing import Final

import numpy as np
import pandas as pd

from saifen_pipeline import config

# ── Colunas finais expostas após limpeza ─────────────────────────────
CLEAN_COLUMNS: Final[list[str]] = [
    "lat",
    "lng",
    "crime_type",     # 'furto' | 'roubo' | 'outros'
    "period",         # 'manha' | 'tarde' | 'noite' | 'madrugada'
    "occurred_at",    # datetime64[ns]
    "neighborhood",   # str (UPPER)
    "city",           # str (UPPER)
    "street",         # str
    "police_unit",    # NOME_DELEGACIA
    "phone_brand",    # MARCA_OBJETO
    "bo_number",      # NUM_BO (chave do boletim)
    "source_file",    # arquivo de origem
]


def _to_crime_type(rubrica: str | float) -> str:
    """Mapeia coluna RUBRICA para o vocabulário do frontend."""
    if not isinstance(rubrica, str):
        return "outros"
    r = rubrica.lower()
    if "furto" in r:
        return "furto"
    if "roubo" in r:
        return "roubo"
    return "outros"


def _hour_to_period(hour: int | float) -> str | None:
    """Converte hora (0-23) em bucket de período."""
    if pd.isna(hour):
        return None
    h = int(hour)
    if 6 <= h < 12:
        return "manha"
    if 12 <= h < 18:
        return "tarde"
    if 18 <= h < 24:
        return "noite"
    return "madrugada"  # 0 <= h < 6


def _descr_periodo_to_period(descr: str | float) -> str | None:
    """Fallback usando DESCR_PERIODO (texto livre da SSP)."""
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


def _resolve_period(row: pd.Series) -> str | None:
    """
    Decide período a partir de HORA_OCORRENCIA; cai em DESCR_PERIODO
    se a hora estiver ausente.
    """
    hora = row.get(config.SSP_HORA_OCORRENCIA_COL)
    if pd.notna(hora):
        h = hora.hour if hasattr(hora, "hour") else int(str(hora).split(":")[0])
        return _hour_to_period(h)
    return _descr_periodo_to_period(row.get(config.SSP_PERIODO_COL))


def filter_bbox(
    df: pd.DataFrame,
    bbox: tuple[float, float, float, float] = config.SP_BBOX,
    lat_col: str = "lat",
    lng_col: str = "lng",
) -> pd.DataFrame:
    """Mantém apenas linhas dentro da bbox (min_lng, min_lat, max_lng, max_lat)."""
    min_lng, min_lat, max_lng, max_lat = bbox
    mask = (
        df[lat_col].between(min_lat, max_lat)
        & df[lng_col].between(min_lng, max_lng)
    )
    return df.loc[mask].copy()


def clean(
    df_raw: pd.DataFrame,
    bbox: tuple[float, float, float, float] | None = config.SP_BBOX,
    drop_duplicate_bo: bool = True,
) -> pd.DataFrame:
    """
    Limpeza completa: input bruto -> DataFrame padronizado.

    Parameters
    ----------
    df_raw : pd.DataFrame
        Saída de loader.load_ssp_xlsx ou load_all_raw.
    bbox : tuple | None
        Bounding box para filtrar coordenadas válidas. None => sem filtro.
    drop_duplicate_bo : bool
        Se True (padrão), remove linhas duplicadas pelo NUM_BO+VERSAO+ANO_BO.
        A SSP gera uma linha por objeto subtraído; isso colapsa em
        uma linha por boletim para evitar superestimar a densidade.

    Returns
    -------
    pd.DataFrame com colunas de CLEAN_COLUMNS.
    """
    df = df_raw.copy()

    df = df.rename(
        columns={
            config.SSP_LAT_COL: "lat",
            config.SSP_LNG_COL: "lng",
        }
    )

    df["lat"] = pd.to_numeric(df["lat"], errors="coerce")
    df["lng"] = pd.to_numeric(df["lng"], errors="coerce")
    df = df.dropna(subset=["lat", "lng"])
    df = df[(df["lat"] != 0) & (df["lng"] != 0)]
    if bbox is not None:
        df = filter_bbox(df, bbox=bbox)

    df["crime_type"] = df[config.SSP_RUBRICA_COL].map(_to_crime_type)
    df["period"] = df.apply(_resolve_period, axis=1)
    df["occurred_at"] = pd.to_datetime(
        df[config.SSP_DATA_OCORRENCIA_COL], errors="coerce"
    )

    df["neighborhood"] = (
        df.get(config.SSP_BAIRRO_COL, pd.Series(dtype="object"))
        .astype("string")
        .str.strip()
        .str.upper()
    )
    df["city"] = (
        df.get(config.SSP_CIDADE_COL, pd.Series(dtype="object"))
        .astype("string")
        .str.strip()
        .str.upper()
    )
    df["street"] = (
        df.get(config.SSP_LOGRADOURO_COL, pd.Series(dtype="object"))
        .astype("string")
        .str.strip()
    )
    df["police_unit"] = df.get("NOME_DELEGACIA", pd.Series(dtype="object"))
    df["phone_brand"] = df.get("MARCA_OBJETO", pd.Series(dtype="object"))
    df["bo_number"] = df.get("NUM_BO", pd.Series(dtype="object"))
    df["source_file"] = df.get("_source_file", pd.Series(dtype="object"))

    if drop_duplicate_bo:
        key_cols = [c for c in ("NUM_BO", "VERSAO", "ANO_BO") if c in df.columns]
        if key_cols:
            df = df.drop_duplicates(subset=key_cols, keep="first")

    out = df[CLEAN_COLUMNS].reset_index(drop=True)
    out.attrs["rows_in"] = len(df_raw)
    out.attrs["rows_out"] = len(out)
    out.attrs["drop_rate"] = 1 - len(out) / max(len(df_raw), 1)
    return out


def summarize(df_clean: pd.DataFrame) -> dict:
    """Sumário descritivo para arquivos output/summary.json."""
    n = len(df_clean)
    by_type = df_clean["crime_type"].value_counts().to_dict()
    by_period = df_clean["period"].value_counts(dropna=False).to_dict()
    top_neigh = (
        df_clean["neighborhood"]
        .value_counts()
        .head(15)
        .to_dict()
    )
    top_brands = (
        df_clean["phone_brand"]
        .value_counts()
        .head(10)
        .to_dict()
    )
    date_min = df_clean["occurred_at"].min()
    date_max = df_clean["occurred_at"].max()
    bbox_actual = (
        float(df_clean["lng"].min()),
        float(df_clean["lat"].min()),
        float(df_clean["lng"].max()),
        float(df_clean["lat"].max()),
    )

    return {
        "total_incidents": n,
        "by_crime_type": {k: int(v) for k, v in by_type.items()},
        "by_period": {str(k): int(v) for k, v in by_period.items()},
        "top_neighborhoods": {k: int(v) for k, v in top_neigh.items()},
        "top_phone_brands": {k: int(v) for k, v in top_brands.items()},
        "date_range": {
            "min": str(date_min) if pd.notna(date_min) else None,
            "max": str(date_max) if pd.notna(date_max) else None,
        },
        "bbox": list(bbox_actual),
    }
