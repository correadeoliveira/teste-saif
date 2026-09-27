"""Adapter do produto Dados criminais (SPDadosCriminais_<ANO>.xlsx).

Colunas são detectadas de forma permissiva: o schema 2026 só é
confirmado na ingestão. Não imputamos geo quando LATITUDE/LONGITUDE
faltam.
"""

from __future__ import annotations

import pandas as pd

from saifen_pipeline.adapters.base import normalize_columns


def _first_present(df: pd.DataFrame, names: tuple[str, ...]) -> pd.Series:
    for name in names:
        if name in df.columns:
            return df[name]
    return pd.Series([None] * len(df), index=df.index)


class SpDadosAdapter:
    name = "spdados"

    @staticmethod
    def matches(cols: set[str]) -> bool:
        has_geo = "LATITUDE" in cols and "LONGITUDE" in cols
        has_nature = "NATUREZA_APURADA" in cols or "NATUREZAAPURADA" in cols
        return has_geo and has_nature

    def prepare(self, df: pd.DataFrame) -> pd.DataFrame:
        df = normalize_columns(df)
        out = pd.DataFrame(index=df.index)
        out["lat"] = df.get("LATITUDE")
        out["lng"] = df.get("LONGITUDE")
        out["crime_type_raw"] = _first_present(df, ("NATUREZA_APURADA", "NATUREZAAPURADA", "RUBRICA"))
        out["occurred_at_raw"] = _first_present(df, ("DATA_OCORRENCIA", "DATA_OCORRENCIA_BO"))
        out["hora_raw"] = df.get("HORA_OCORRENCIA")
        out["period_raw"] = _first_present(df, ("PERIODO_OCORRENCIA", "DESCR_PERIODO"))
        out["neighborhood"] = df.get("BAIRRO")
        out["city"] = df.get("CIDADE")
        out["street"] = df.get("LOGRADOURO")
        out["police_unit"] = _first_present(df, ("DELEGACIA_ELABORACAO", "NOME_DELEGACIA"))
        out["sectional"] = _first_present(df, ("SECCIONAL_ELABORACAO", "NOME_SECCIONAL"))
        out["department"] = _first_present(df, ("DEPARTAMENTO_ELABORACAO", "NOME_DEPARTAMENTO"))
        out["phone_brand"] = df.get("MARCA_OBJETO") if "MARCA_OBJETO" in df.columns else None
        out["bo_number"] = df.get("NUM_BO")
        out["versao"] = df.get("VERSAO") if "VERSAO" in df.columns else 1
        out["ano_bo"] = df.get("ANO_BO")
        out["source_file"] = df.get("_SOURCE_FILE", df.get("_source_file"))
        out["_source"] = self.name
        return out
