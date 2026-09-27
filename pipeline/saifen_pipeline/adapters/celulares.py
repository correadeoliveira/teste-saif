"""Adapter do produto Celulares Subtraídos (sheet CELULAR_<ANO>)."""

from __future__ import annotations

import pandas as pd

from saifen_pipeline.adapters.base import normalize_columns


class CelularesAdapter:
    name = "celulares"

    @staticmethod
    def matches(cols: set[str]) -> bool:
        return "RUBRICA" in cols and "LATITUDE" in cols and "LONGITUDE" in cols

    def prepare(self, df: pd.DataFrame) -> pd.DataFrame:
        df = normalize_columns(df)
        out = pd.DataFrame(index=df.index)
        out["lat"] = df.get("LATITUDE")
        out["lng"] = df.get("LONGITUDE")
        out["crime_type_raw"] = df.get("RUBRICA")
        out["occurred_at_raw"] = df.get("DATA_OCORRENCIA_BO")
        out["hora_raw"] = df.get("HORA_OCORRENCIA")
        out["period_raw"] = df.get("DESCR_PERIODO")
        out["neighborhood"] = df.get("BAIRRO")
        out["city"] = df.get("CIDADE")
        out["street"] = df.get("LOGRADOURO")
        out["police_unit"] = df.get("NOME_DELEGACIA")
        out["sectional"] = df.get("NOME_SECCIONAL") if "NOME_SECCIONAL" in df.columns else None
        out["department"] = (
            df.get("NOME_DEPARTAMENTO") if "NOME_DEPARTAMENTO" in df.columns else None
        )
        out["phone_brand"] = df.get("MARCA_OBJETO")
        out["bo_number"] = df.get("NUM_BO")
        out["versao"] = df.get("VERSAO") if "VERSAO" in df.columns else 1
        out["ano_bo"] = df.get("ANO_BO")
        out["source_file"] = df.get("_SOURCE_FILE", df.get("_source_file"))
        out["_source"] = self.name
        return out
