#!/usr/bin/env python3
"""Copia JSONL+meta exportados do device para data/behavior/raw/{subject_id}/."""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_SRC = ROOT / "data" / "behavior" / "incoming"
DEFAULT_DST = ROOT / "data" / "behavior" / "raw"


def ingest(src: Path, dst: Path) -> int:
    src = src.resolve()
    dst = dst.resolve()
    if not src.exists():
        print(f"incoming vazio: {src} (crie a pasta e solte os .jsonl + .meta.json)", file=sys.stderr)
        dst.mkdir(parents=True, exist_ok=True)
        return 0
    copied = 0
    for jsonl in sorted(src.rglob("*.jsonl")):
        sid = jsonl.stem
        meta_path = jsonl.with_name(f"{sid}.meta.json")
        if meta_path.exists():
            meta = json.loads(meta_path.read_text())
            subject = meta.get("subject_id", "unknown")
        else:
            subject = "unknown"
            meta = {
                "session_id": sid,
                "subject_id": subject,
                "activity": "imported",
                "label": "unlabeled",
                "n_samples": sum(1 for line in jsonl.open() if line.strip()),
            }
        dest_dir = dst / subject
        dest_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(jsonl, dest_dir / jsonl.name)
        (dest_dir / f"{sid}.meta.json").write_text(json.dumps(meta, indent=2))
        copied += 1
        print(f"copied {sid} → {dest_dir}")
    print(f"{copied} sessão(ões)")
    return 0


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--src", type=Path, default=DEFAULT_SRC)
    p.add_argument("--dst", type=Path, default=DEFAULT_DST)
    args = p.parse_args()
    return ingest(args.src, args.dst)


if __name__ == "__main__":
    raise SystemExit(main())
