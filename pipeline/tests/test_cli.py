"""CLI ingest/preprocess em diretório temporário."""

from __future__ import annotations

from pathlib import Path

from saifen_pipeline import config, ingest, publish
from saifen_pipeline.cli import main


def test_cli_ingest_help():
    try:
        main(["ingest", "--help"])
    except SystemExit as exc:
        assert exc.code == 0


def test_fingerprint_changes_with_params():
    a = publish.fingerprint("abc", "kde", {"bandwidth": "scott"})
    b = publish.fingerprint("abc", "kde", {"bandwidth": 0.01})
    c = publish.fingerprint("abc", "kde", {"bandwidth": "scott"})
    assert a != b
    assert a == c


def test_ingest_resolve_prefers_spdados(tmp_path: Path, celulares_xlsx: Path, spdados_xlsx: Path):
    raw = tmp_path / "raw"
    raw.mkdir()
    Path(raw / celulares_xlsx.name).write_bytes(celulares_xlsx.read_bytes())
    Path(raw / spdados_xlsx.name).write_bytes(spdados_xlsx.read_bytes())
    chosen = ingest.resolve_source(raw_dir=raw, year=2026)
    assert chosen.name.startswith("SPDadosCriminais")
