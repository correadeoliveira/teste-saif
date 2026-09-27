#!/usr/bin/env python3
"""Wrapper: generate_heatmap → saifen-pipeline heatmap."""
from __future__ import annotations

import sys
from pathlib import Path

PIPELINE_DIR = Path(__file__).resolve().parents[1]
if str(PIPELINE_DIR) not in sys.path:
    sys.path.insert(0, str(PIPELINE_DIR))

from saifen_pipeline.cli import main  # noqa: E402

if __name__ == "__main__":
    raise SystemExit(main(["heatmap", *sys.argv[1:]]))
