"""Valida artefatos versionados em shared/ contra JSON Schema (sem re-treinar)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

jsonschema = pytest.importorskip("jsonschema")

ROOT = Path(__file__).resolve().parents[2]
SCHEMA_DIR = ROOT / "shared" / "schema"


def _load(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def _validator(schema_name: str):
    schema = _load(SCHEMA_DIR / schema_name)
    return jsonschema.Draft202012Validator(schema)


def test_current_run_matches_schema():
    payload = _load(ROOT / "shared" / "current_run.json")
    _validator("current_run.schema.json").validate(payload)
    assert payload["model"] == "kde"


def test_heatmap_points_matches_schema():
    payload = _load(ROOT / "shared" / "heatmaps" / "heatmap_points.json")
    _validator("heatmap_points.schema.json").validate(payload)
    assert payload["count"] == len(payload["points"])
    assert payload["meta"]["crime_type"] == "all"


def test_heatmap_type_slices_match_schema():
    validator = _validator("heatmap_points.schema.json")
    for crime_type in ("furto", "roubo", "outros"):
        path = ROOT / "shared" / "heatmaps" / f"heatmap_points__{crime_type}.json"
        payload = _load(path)
        validator.validate(payload)
        assert payload["meta"]["crime_type"] == crime_type


def test_behavior_model_matches_schema():
    payload = _load(ROOT / "shared" / "behavior" / "model.json")
    _validator("behavior_model.schema.json").validate(payload)
    n = len(payload["feature_names"])
    assert len(payload["coef"]) == n
    assert len(payload["scaler"]["mean"]) == n
    assert len(payload["scaler"]["scale"]) == n
