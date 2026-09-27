"""Testes de ingestão / schema / checksum."""

from __future__ import annotations

from pathlib import Path

from saifen_pipeline import ingest
from saifen_pipeline.ingest import detect_product, profile_xlsx, sha256_file, validate_profile


def test_sha256_stable(tmp_path: Path):
    p = tmp_path / "a.bin"
    p.write_bytes(b"hello")
    assert sha256_file(p) == sha256_file(p)
    assert len(sha256_file(p)) == 64


def test_detect_product_names():
    assert detect_product(Path("CelularesSubtraidos_2026.xlsx")) == "celulares"
    assert detect_product(Path("SPDadosCriminais_2026.xlsx")) == "spdados"


def test_profile_celulares_fixture(celulares_xlsx: Path):
    profile = profile_xlsx(celulares_xlsx)
    assert profile["product"] == "celulares"
    assert profile["data_sheet"] == "CELULAR_2026"
    assert profile["n_rows"] == 5
    assert "LATITUDE" in profile["columns"]
    assert profile["geo"]["n_missing"] == 1
    assert profile["geo"]["n_zero"] == 1
    assert validate_profile(profile) == []


def test_profile_spdados_fixture(spdados_xlsx: Path):
    profile = profile_xlsx(spdados_xlsx)
    assert profile["product"] == "spdados"
    assert profile["data_sheet"] == "DADOS"
    assert validate_profile(profile, product="spdados") == []


def test_ingest_writes_manifest(celulares_xlsx: Path, tmp_path: Path):
    manifest = tmp_path / "manifest.json"
    profile = ingest.profile_xlsx(celulares_xlsx)
    ingest.write_manifest([profile], path=manifest)
    assert manifest.exists()
    text = manifest.read_text(encoding="utf-8")
    assert profile["sha256"] in text
    assert "consultas" in text.lower()
