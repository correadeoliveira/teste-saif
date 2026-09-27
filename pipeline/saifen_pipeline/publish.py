"""Versionamento de runs e publicação dos artefatos em shared/."""

from __future__ import annotations

import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from saifen_pipeline import config
from saifen_pipeline.log import log_event

RUN_HEATMAP_FILES = (
    "heatmap_points.json",
    "heatmap_grid.geojson",
)


def fingerprint(source_sha256: str, model: str, params: dict[str, Any]) -> str:
    blob = json.dumps(
        {"sha": source_sha256, "model": model, "params": params},
        sort_keys=True,
        default=str,
    )
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:16]


def current_fingerprint() -> str | None:
    path = config.CURRENT_RUN_PATH
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None
    return data.get("fingerprint")


def new_run_id(fp: str) -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return f"{ts}_{fp}"


def write_run(
    run_id: str,
    metadata: dict[str, Any],
    metrics: dict[str, Any] | None = None,
    heatmap_dir: Path | None = None,
) -> Path:
    run_dir = config.RUNS_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )
    if metrics is not None:
        (run_dir / "metrics.json").write_text(
            json.dumps(metrics, ensure_ascii=False, indent=2, default=str),
            encoding="utf-8",
        )
    src = heatmap_dir or config.HEATMAP_DIR
    for name in RUN_HEATMAP_FILES:
        src_file = src / name
        if src_file.exists():
            shutil.copy2(src_file, run_dir / name)
    # fatias por tipo/período
    for path in src.glob("heatmap_points__*.json"):
        shutil.copy2(path, run_dir / path.name)
    return run_dir


def publish(run_dir: Path, metadata: dict[str, Any]) -> Path:
    """Copia o run para os paths estáveis lidos pela UI."""
    config.HEATMAP_DIR.mkdir(parents=True, exist_ok=True)
    for path in run_dir.glob("heatmap_points*.json"):
        shutil.copy2(path, config.HEATMAP_DIR / path.name)
    grid = run_dir / "heatmap_grid.geojson"
    if grid.exists():
        shutil.copy2(grid, config.HEATMAP_DIR / "heatmap_grid.geojson")
    current = {
        "run_id": metadata.get("run_id"),
        "fingerprint": metadata.get("fingerprint"),
        "model": metadata.get("model"),
        "model_version": metadata.get("model_version"),
        "source_file": metadata.get("source_file"),
        "source_sha256": metadata.get("source_sha256"),
        "generated_at": metadata.get("generated_at"),
        "disclaimer": config.DISCLAIMER,
        "heatmaps": str(config.HEATMAP_DIR.relative_to(config.ROOT_DIR)),
        "run_dir": str(run_dir.relative_to(config.ROOT_DIR)),
    }
    config.CURRENT_RUN_PATH.write_text(
        json.dumps(current, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    log_event("publish.ok", run_id=metadata.get("run_id"), path=str(config.CURRENT_RUN_PATH))
    return config.CURRENT_RUN_PATH
