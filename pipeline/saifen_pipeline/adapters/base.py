"""Detecção de produto SSP e normalização de nomes de coluna."""

from __future__ import annotations

from typing import Protocol

import pandas as pd


def normalize_column_name(name: object) -> str:
    text = str(name).strip().upper()
    return "_".join(text.replace("-", " ").split())


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out.columns = [normalize_column_name(c) for c in out.columns]
    return out


class SourceAdapter(Protocol):
    name: str

    def prepare(self, df: pd.DataFrame) -> pd.DataFrame:
        """Devolve DataFrame com colunas canônicas pré-cleaner."""
        ...


def detect_adapter(df: pd.DataFrame) -> SourceAdapter:
    from saifen_pipeline.adapters.celulares import CelularesAdapter
    from saifen_pipeline.adapters.spdados import SpDadosAdapter

    cols = {normalize_column_name(c) for c in df.columns}
    if CelularesAdapter.matches(cols):
        return CelularesAdapter()
    if SpDadosAdapter.matches(cols):
        return SpDadosAdapter()
    raise ValueError(
        "Schema SSP desconhecido. Esperado produto 'celulares' (RUBRICA) "
        f"ou 'spdados' (NATUREZA_APURADA). Colunas: {sorted(cols)[:20]}"
    )
