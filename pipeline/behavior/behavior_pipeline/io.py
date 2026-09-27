from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from behavior_pipeline.config import RAW_DIR, SAMPLE_COLUMNS


def load_jsonl(path: Path) -> pd.DataFrame:
    rows = []
    with path.open() as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    if not rows:
        return pd.DataFrame(columns=list(SAMPLE_COLUMNS))
    df = pd.DataFrame(rows)
    missing = [c for c in SAMPLE_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"{path} sem colunas {missing}")
    return df[list(SAMPLE_COLUMNS)].astype(float)


def load_meta(path: Path) -> dict:
    return json.loads(path.read_text())


def iter_sessions(raw_dir: Path | None = None) -> list[tuple[pd.DataFrame, dict]]:
    root = raw_dir or RAW_DIR
    out: list[tuple[pd.DataFrame, dict]] = []
    if not root.exists():
        return out
    for meta_path in sorted(root.glob("*/*.meta.json")):
        session_id = meta_path.name.replace(".meta.json", "")
        jsonl = meta_path.with_name(f"{session_id}.jsonl")
        if not jsonl.exists():
            raise FileNotFoundError(jsonl)
        meta = load_meta(meta_path)
        df = load_jsonl(jsonl)
        out.append((df, meta))
    return out
