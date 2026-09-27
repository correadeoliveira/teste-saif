"""
SAIFEN — Urban Risk Analysis Pipeline.

Converte planilhas brutas da SSP-SP em artefatos geoespaciais
consumíveis pelo frontend. Treino é só via CLI; o app não treina.
"""

from saifen_pipeline import cleaner, config, exporter, kde, loader

__all__ = ["config", "loader", "cleaner", "kde", "exporter"]
__version__ = "0.2.0"
