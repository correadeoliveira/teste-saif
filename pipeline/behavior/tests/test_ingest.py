from __future__ import annotations

import json
from pathlib import Path
import importlib.util


def load_ingest():
    path = Path(__file__).resolve().parents[1] / "scripts" / "ingest_device_export.py"
    spec = importlib.util.spec_from_file_location("ingest_device_export", path)
    mod = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(mod)
    return mod


def test_ingest_roundtrip(tmp_path: Path):
    src = tmp_path / "incoming"
    dst = tmp_path / "raw"
    sub = src / "drop"
    sub.mkdir(parents=True)
    jsonl = sub / "abc.jsonl"
    jsonl.write_text('{"t":1,"ax":0,"ay":0,"az":9.8,"gx":0,"gy":0,"gz":0}\n')
    (sub / "abc.meta.json").write_text(
        json.dumps({"session_id": "abc", "subject_id": "u1", "label": "genuine"})
    )
    mod = load_ingest()
    assert mod.ingest(src, dst) == 0
    copied = dst / "u1" / "abc.jsonl"
    assert copied.exists()
    line = copied.read_text().strip()
    json.loads(line)
    assert (dst / "u1" / "abc.meta.json").exists()
