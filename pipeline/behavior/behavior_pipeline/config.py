"""Paths e constantes do pipeline de comportamento (IMU). Isolado do KDE."""

from __future__ import annotations

from pathlib import Path

BEHAVIOR_DIR: Path = Path(__file__).resolve().parents[1]
ROOT_DIR: Path = BEHAVIOR_DIR.parents[1]
DATA_DIR: Path = ROOT_DIR / "data" / "behavior"
RAW_DIR: Path = DATA_DIR / "raw"
INCOMING_DIR: Path = DATA_DIR / "incoming"
PROCESSED_DIR: Path = DATA_DIR / "processed"
FEATURES_PATH: Path = PROCESSED_DIR / "features.parquet"
WINDOWS_PATH: Path = PROCESSED_DIR / "windows.parquet"
MODEL_PATH: Path = ROOT_DIR / "shared" / "behavior" / "model.json"
METRICS_PATH: Path = ROOT_DIR / "shared" / "behavior" / "metrics.json"
PARITY_PATH: Path = ROOT_DIR / "shared" / "behavior" / "parity_fixture.json"
MOBILE_MODEL_PATH: Path = ROOT_DIR / "mobile" / "assets" / "behavior" / "model.json"

TARGET_HZ = 50
WINDOW_MS = 2000
WINDOW_OVERLAP = 0.5
LABEL_POSITIVE = "genuine"
LABEL_NEGATIVE = "impostor"

AXES = ("ax", "ay", "az", "gx", "gy", "gz", "mag_a")
STATS = ("mean", "std", "min", "max", "rms", "energy")
FEATURE_NAMES: list[str] = [f"{axis}_{stat}" for axis in AXES for stat in STATS] + ["sma_accel"]

SAMPLE_COLUMNS = ("t", "ax", "ay", "az", "gx", "gy", "gz")
