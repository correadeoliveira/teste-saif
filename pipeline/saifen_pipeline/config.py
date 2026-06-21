"""
Caminhos e constantes globais do pipeline SAIFEN.

Centraliza paths para que scripts, notebooks e CI/CD apontem
sempre para o mesmo lugar, sem hard-coding espalhado.
"""

from __future__ import annotations

from pathlib import Path

# ─── Diretórios base ───────────────────────────────────────────────
# Layout monorepo:
#   <ROOT_DIR>/
#     ├── pipeline/saifen_pipeline/config.py  ← este arquivo
#     ├── data/{raw,processed}/
#     └── shared/{heatmaps/, summary.json}
PIPELINE_DIR: Path = Path(__file__).resolve().parents[1]   # …/pipeline/
ROOT_DIR: Path = PIPELINE_DIR.parent                        # …/saifen/
DATA_DIR: Path = ROOT_DIR / "data"
RAW_DIR: Path = DATA_DIR / "raw"
PROCESSED_DIR: Path = DATA_DIR / "processed"

# Artefatos produzidos pelo pipeline e consumidos pelos apps (web, mobile).
# Convenção do monorepo: `shared/` é a interface entre Python e JS/TS.
OUTPUT_DIR: Path = ROOT_DIR / "shared"
HEATMAP_DIR: Path = OUTPUT_DIR / "heatmaps"

for _d in (RAW_DIR, PROCESSED_DIR, OUTPUT_DIR, HEATMAP_DIR):
    _d.mkdir(parents=True, exist_ok=True)

# ─── Bounding box: São Paulo capital (área útil do MVP) ────────────
# (min_lng, min_lat, max_lng, max_lat) — formato GeoJSON
SP_BBOX: tuple[float, float, float, float] = (-46.83, -23.78, -46.36, -23.39)
SP_CENTER: tuple[float, float] = (-23.5505, -46.6333)  # (lat, lng)

# ─── Schema da SSP-SP ──────────────────────────────────────────────
SSP_SHEET_NAME: str = "CELULAR_2026"
SSP_LAT_COL: str = "LATITUDE"
SSP_LNG_COL: str = "LONGITUDE"
SSP_RUBRICA_COL: str = "RUBRICA"
SSP_PERIODO_COL: str = "DESCR_PERIODO"
SSP_DATA_OCORRENCIA_COL: str = "DATA_OCORRENCIA_BO"
SSP_HORA_OCORRENCIA_COL: str = "HORA_OCORRENCIA"
SSP_BAIRRO_COL: str = "BAIRRO"
SSP_CIDADE_COL: str = "CIDADE"
SSP_LOGRADOURO_COL: str = "LOGRADOURO"

# ─── Vocabulário do frontend ───────────────────────────────────────
# Mantém compatibilidade com os IDs já consumidos pelo frontend
# (vide js/data/MockData.js -> crimeTypes / timeSlots).
CRIME_TYPES = {
    "furto": "Furto",
    "roubo": "Roubo",
}

TIME_SLOTS = {
    "manha":     "Manhã (06h–12h)",
    "tarde":     "Tarde (12h–18h)",
    "noite":     "Noite (18h–00h)",
    "madrugada": "Madrugada (00h–06h)",
}

# ─── Parâmetros padrão do KDE ──────────────────────────────────────
KDE_GRID_SIZE: int = 200      # 200x200 células no GeoJSON grid
KDE_BANDWIDTH: str | float = "scott"  # 'scott' | 'silverman' | float
KDE_MIN_DENSITY: float = 0.05  # threshold para descartar células vazias (mantém payload enxuto)
