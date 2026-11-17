"""Publish the real CLI output from a small workbook in an isolated workspace."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest

from saifen_pipeline import config, publish
from saifen_pipeline.cli import main
from tests.conftest import write_celulares_xlsx


@pytest.fixture
def workspace(tmp_path, monkeypatch):
    raw = tmp_path / "data/raw"
    shared = tmp_path / "shared"
    shutil.copytree(config.ROOT_DIR / "shared/schema", shared / "schema")
    paths = {
        "ROOT_DIR": tmp_path,
        "RAW_DIR": raw,
        "PROCESSED_DIR": tmp_path / "data/processed",
        "FEATURES_DIR": tmp_path / "data/features",
        "OUTPUT_DIR": shared,
        "HEATMAP_DIR": shared / "heatmaps",
        "RUNS_DIR": shared / "runs",
        "MANIFEST_PATH": raw / "manifest.json",
        "CURRENT_RUN_PATH": shared / "current_run.json",
    }
    for key, value in paths.items():
        monkeypatch.setattr(config, key, value)
    rows = [
        {
            "LATITUDE": -23.60 + i * 0.003,
            "LONGITUDE": -46.63 + (i % 3) * 0.006,
            "DATA_OCORRENCIA_BO": f"2026-{month:02d}-10",
            "CIDADE": "S.PAULO",
            "DESCR_PERIODO": "Tarde",
            "RUBRICA": "Furto",
            "NUM_BO": f"{month}-{i}",
            "VERSAO": 1,
            "ANO_BO": 2026,
        }
        for month in range(1, 5)
        for i in range(10)
    ]
    write_celulares_xlsx(raw / "CelularesSubtraidos_2026.xlsx", rows=rows)
    return shared


def update(*args: str):
    return main(["update", "--grid-size", "12", "--sample-max", "20", *args])


def manifest():
    return json.loads(config.CURRENT_RUN_PATH.read_text())


def test_update_skip_repairs_missing_file_and_removes_stale_slices(workspace):
    assert update() == 0
    first = manifest()
    points = workspace / "heatmaps/heatmap_points.json"
    slice_path = workspace / "heatmaps/heatmap_points__furto__tarde.json"
    assert points.is_file() and slice_path.is_file()
    assert update() == 0
    assert manifest() == first

    points.unlink()
    assert update() == 0
    repaired = manifest()
    assert repaired["run_id"] != first["run_id"]
    assert repaired["fingerprint"] == first["fingerprint"]
    assert points.is_file()

    assert update("--no-per-period") == 0
    assert not slice_path.exists()
    assert manifest()["fingerprint"] != repaired["fingerprint"]
    assert publish.current_fingerprint() == manifest()["fingerprint"]


def test_failed_publication_restores_previous_files(workspace, monkeypatch):
    assert update() == 0
    before = manifest()
    inventory = {name: (workspace / name).read_bytes() for name in before["artifacts"]}
    real_copy = publish._atomic_copy

    def fail_when_setting_pointer(source: Path, dest: Path):
        if dest == config.CURRENT_RUN_PATH and source.parent.name != ".publish-pending":
            raise OSError("simulated write error")
        real_copy(source, dest)

    monkeypatch.setattr(publish, "_atomic_copy", fail_when_setting_pointer)
    assert update("--no-per-type") == 1
    assert manifest() == before
    assert inventory == {name: (workspace / name).read_bytes() for name in inventory}
    assert publish.current_fingerprint() == before["fingerprint"]
    assert not (config.RUNS_DIR / ".publish-pending").exists()


def test_update_repairs_malformed_manifest_with_intact_artifacts(workspace):
    assert update() == 0
    before = manifest()
    incomplete = {key: value for key, value in before.items() if key != "run_id"}
    config.CURRENT_RUN_PATH.write_text(json.dumps(incomplete), encoding="utf-8")

    assert update() == 0
    repaired = manifest()
    assert repaired["run_id"] != before["run_id"]
    assert repaired["fingerprint"] == before["fingerprint"]


def test_restart_recovers_an_interrupted_publication(workspace, monkeypatch):
    assert update() == 0
    before = manifest()
    real_copy = publish._atomic_copy

    def interrupt_commit(source, dest):
        if dest == config.CURRENT_RUN_PATH:
            raise KeyboardInterrupt
        real_copy(source, dest)

    with monkeypatch.context() as patch:
        patch.setattr(publish, "_atomic_copy", interrupt_commit)
        with pytest.raises(KeyboardInterrupt):
            update("--no-per-type")
    assert (config.RUNS_DIR / ".publish-pending").is_dir()
    assert update() == 0
    assert manifest() == before
    assert publish.current_fingerprint() == before["fingerprint"]
