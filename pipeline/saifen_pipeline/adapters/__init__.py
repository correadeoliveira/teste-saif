"""Adapters de planilhas SSP → colunas canônicas do cleaner."""

from saifen_pipeline.adapters.base import detect_adapter, normalize_columns
from saifen_pipeline.adapters.celulares import CelularesAdapter
from saifen_pipeline.adapters.spdados import SpDadosAdapter

__all__ = [
    "detect_adapter",
    "normalize_columns",
    "CelularesAdapter",
    "SpDadosAdapter",
]
