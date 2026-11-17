"""Validate staged artifacts and recover interrupted publications."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any
from uuid import uuid4

from jsonschema import Draft202012Validator

from saifen_pipeline import config
from saifen_pipeline.ingest import sha256_file
from saifen_pipeline.log import log_event

SLICE_NAMES = {
    f"heatmaps/heatmap_points__{kind}{suffix}.json"
    for kind in config.HEATMAP_CRIME_TYPES
    for suffix in ("", *(f"__{period}" for period in config.PERIODS))
}
REQUIRED_FILES = {
    "summary.json",
    "heatmaps/heatmap_points.json",
    "heatmaps/heatmap_grid.geojson",
    "heatmaps/crimes.geojson",
}
ARTIFACTS = REQUIRED_FILES | SLICE_NAMES
CURRENT = "current_run.json"


def _load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _dump(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False) + "\n", "utf-8"
    )


def _paths(root: Path) -> set[str]:
    return {name for name in ARTIFACTS if (root / name).is_file()}


def _matches(root: Path, inventory: Any) -> bool:
    return (
        isinstance(inventory, dict)
        and REQUIRED_FILES <= inventory.keys() <= ARTIFACTS
        and inventory.keys() == _paths(root)
        and all(sha256_file(root / name) == digest for name, digest in inventory.items())
    )


def fingerprint(source_sha256: str, model: str, params: dict[str, Any]) -> str:
    blob = json.dumps(
        {
            "sha": source_sha256,
            "model": model,
            "params": params,
            "version": config.PIPELINE_VERSION,
        },
        sort_keys=True,
        allow_nan=False,
    )
    return hashlib.sha256(blob.encode()).hexdigest()[:16]


def _valid_manifest(data: Any) -> bool:
    schema = _load(config.ROOT_DIR / "shared/schema/current_run.schema.json")
    return Draft202012Validator(schema).is_valid(data)


def current_fingerprint() -> str | None:
    try:
        data = _load(config.CURRENT_RUN_PATH)
        if _valid_manifest(data) and _matches(config.OUTPUT_DIR, data.get("artifacts")):
            return data["fingerprint"]
    except (OSError, ValueError):
        pass
    return None


def new_run_id(fp: str) -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    return f"{ts}_{fp}"


def _validate(root: Path, files: set[str]) -> None:
    schema_dir = config.ROOT_DIR / "shared" / "schema"
    validator = Draft202012Validator(_load(schema_dir / "heatmap_points.schema.json"))
    if not files >= REQUIRED_FILES:
        raise ValueError(f"Artefatos obrigatórios ausentes: {sorted(REQUIRED_FILES - files)}")

    for name in sorted(files):
        payload = _load(root / name)
        if name.endswith(".geojson"):
            if payload.get("type") != "FeatureCollection" or not isinstance(
                payload.get("features"), list
            ):
                raise ValueError(f"GeoJSON inválido: {name}")
            if name.endswith("/heatmap_grid.geojson") and not all(
                0 <= feature.get("properties", {}).get("density", -1) <= 1
                for feature in payload["features"]
            ):
                raise ValueError("Densidade inválida na grade.")
        elif name == "summary.json":
            if (
                not isinstance(payload.get("total_incidents"), int)
                or payload["total_incidents"] <= 0
            ):
                raise ValueError("Resumo sem ocorrências.")
        else:
            error = next(validator.iter_errors(payload), None)
            if error:
                raise ValueError(f"Artefato {name} inválido no schema.")
            kind, period = (Path(name).stem.split("__")[1:] + ["all", "all"])[:2]
            points, meta = payload["points"], payload["meta"]
            if (
                not len(points) == payload["count"]
                or not points
                or meta["crime_type"] != kind
                or meta["period"] != period
                or not all(
                    -90 <= lat <= 90 and -180 <= lng <= 180 and 0 <= w <= 1
                    for lat, lng, w in points
                )
            ):
                raise ValueError(f"Contagem, coordenadas ou fatia inválida: {name}")


def seal_run(stage: Path, metadata: dict[str, Any], metrics: dict[str, Any] | None) -> Path:
    files = _paths(stage)
    _validate(stage, files)
    metadata = {
        **metadata,
        "artifacts": {name: sha256_file(stage / name) for name in sorted(files)},
    }
    _dump(stage / "metadata.json", metadata)
    if metrics is not None:
        _dump(stage / "metrics.json", metrics)
    run = config.RUNS_DIR / metadata["run_id"]
    stage.rename(run)
    return run


def _atomic_copy(source: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(dir=dest.parent, prefix=".heatmap-file-") as directory:
        temp = Path(directory) / dest.name
        shutil.copy2(source, temp)
        os.replace(temp, dest)


def _complete_journal(journal: Path) -> None:
    retired = journal.with_name(f".finished-{uuid4().hex}")
    journal.rename(retired)
    shutil.rmtree(retired, ignore_errors=True)


def _recover(journal: Path) -> None:
    if not journal.exists():
        return
    for name in (*sorted(ARTIFACTS), CURRENT):
        dest = config.OUTPUT_DIR / name
        source = journal / name
        if source.is_file():
            _atomic_copy(source, dest)
        else:
            dest.unlink(missing_ok=True)
    _complete_journal(journal)
    log_event("publish.recovered")


@contextmanager
def publication_lock():
    import fcntl

    config.RUNS_DIR.mkdir(parents=True, exist_ok=True)
    with (config.RUNS_DIR / ".publication.lock").open("a") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
        _recover(config.RUNS_DIR / ".publish-pending")
        yield


def publish(run: Path) -> Path:
    """Publish a sealed run while the caller holds publication_lock."""
    metadata = _load(run / "metadata.json")
    inventory = metadata.get("artifacts")
    if not _matches(run, inventory):
        raise ValueError("Inventário da execução incompleto ou corrompido.")
    current = {
        key: metadata[key]
        for key in (
            "run_id",
            "fingerprint",
            "model",
            "model_version",
            "source_file",
            "source_sha256",
            "generated_at",
            "disclaimer",
            "artifacts",
        )
    }
    current["heatmaps"] = str(config.HEATMAP_DIR.relative_to(config.ROOT_DIR))
    current["run_dir"] = str(run.relative_to(config.ROOT_DIR))
    if not _valid_manifest(current):
        raise ValueError("Manifesto da execução inválido.")

    journal = config.RUNS_DIR / ".publish-pending"
    with TemporaryDirectory(dir=config.RUNS_DIR, prefix=".publish-") as directory:
        stage = Path(directory)
        _dump(stage / CURRENT, current)
        backup = stage / "backup"
        backup.mkdir()
        for name in _paths(config.OUTPUT_DIR) | {CURRENT}:
            source = config.OUTPUT_DIR / name
            if source.is_file():
                dest = backup / name
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, dest)
        backup.rename(journal)
        try:
            for name in sorted(inventory):
                _atomic_copy(run / name, config.OUTPUT_DIR / name)
            for name in _paths(config.OUTPUT_DIR) - inventory.keys():
                (config.OUTPUT_DIR / name).unlink()
            _atomic_copy(stage / CURRENT, config.CURRENT_RUN_PATH)
        except Exception:
            _recover(journal)
            raise
        _complete_journal(journal)

    log_event("publish.ok", run_id=metadata["run_id"], count=len(inventory))
    return config.CURRENT_RUN_PATH
