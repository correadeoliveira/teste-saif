"""
SAIFEN — Urban Risk Analysis Pipeline.

Pacote de processamento que converte planilhas brutas da SSP-SP
(boletins de ocorrência de subtração de celulares) em artefatos
geoespaciais (heatmap_points.json, heatmap_grid.geojson, summary.json)
consumíveis pelo frontend cyberpunk e, futuramente, persistidos no
Supabase (PostGIS).

Camadas:
    config   — paths e constantes
    loader   — leitura de .xlsx da SSP-SP
    cleaner  — limpeza, normalização e categorização
    kde      — estimação de densidade (Gaussian KDE 2D)
    exporter — serialização JSON / GeoJSON
"""

from saifen_pipeline import config, loader, cleaner, kde, exporter

__all__ = ["config", "loader", "cleaner", "kde", "exporter"]
__version__ = "0.1.0"
