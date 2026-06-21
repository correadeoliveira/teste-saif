"""Smoke tests para saifen_pipeline.cleaner."""
from __future__ import annotations

import pandas as pd
import pytest

from saifen_pipeline import cleaner, config


def _fake_raw(extra_rows: list[dict] | None = None) -> pd.DataFrame:
    """Replica colunas-chave da sheet CELULAR_<ANO> da SSP-SP."""
    rows = [
        # válido: SP, furto, manhã
        {
            config.SSP_LAT_COL: -23.5505,
            config.SSP_LNG_COL: -46.6333,
            config.SSP_RUBRICA_COL: "Furto (art. 155)",
            config.SSP_HORA_OCORRENCIA_COL: pd.Timestamp("2026-01-01 10:30:00"),
            config.SSP_PERIODO_COL: None,
            config.SSP_DATA_OCORRENCIA_COL: pd.Timestamp("2026-01-01"),
            config.SSP_BAIRRO_COL: "  centro ",
            config.SSP_CIDADE_COL: "S.PAULO",
            "NUM_BO": "BO-1", "VERSAO": 1, "ANO_BO": 2026,
        },
        # válido: SP, roubo, noite
        {
            config.SSP_LAT_COL: -23.560, config.SSP_LNG_COL: -46.660,
            config.SSP_RUBRICA_COL: "Roubo (art. 157)",
            config.SSP_HORA_OCORRENCIA_COL: pd.Timestamp("2026-01-02 22:00:00"),
            config.SSP_PERIODO_COL: None,
            config.SSP_DATA_OCORRENCIA_COL: pd.Timestamp("2026-01-02"),
            config.SSP_BAIRRO_COL: "PAULISTA",
            config.SSP_CIDADE_COL: "S.PAULO",
            "NUM_BO": "BO-2", "VERSAO": 1, "ANO_BO": 2026,
        },
        # inválido: fora da bbox
        {
            config.SSP_LAT_COL: -10.0, config.SSP_LNG_COL: -50.0,
            config.SSP_RUBRICA_COL: "Furto", config.SSP_HORA_OCORRENCIA_COL: None,
            config.SSP_PERIODO_COL: "Manhã", config.SSP_DATA_OCORRENCIA_COL: pd.NaT,
            config.SSP_BAIRRO_COL: "X", config.SSP_CIDADE_COL: "Y",
            "NUM_BO": "BO-3", "VERSAO": 1, "ANO_BO": 2026,
        },
        # inválido: lat/lng nulos
        {
            config.SSP_LAT_COL: None, config.SSP_LNG_COL: None,
            config.SSP_RUBRICA_COL: "Furto", config.SSP_HORA_OCORRENCIA_COL: None,
            config.SSP_PERIODO_COL: None, config.SSP_DATA_OCORRENCIA_COL: pd.NaT,
            config.SSP_BAIRRO_COL: None, config.SSP_CIDADE_COL: None,
            "NUM_BO": "BO-4", "VERSAO": 1, "ANO_BO": 2026,
        },
    ]
    if extra_rows:
        rows.extend(extra_rows)
    return pd.DataFrame(rows)


def test_clean_drops_invalid_rows():
    df = cleaner.clean(_fake_raw(), bbox=config.SP_BBOX)
    assert len(df) == 2
    assert set(df["crime_type"]) == {"furto", "roubo"}


def test_period_mapping_from_hour():
    df = cleaner.clean(_fake_raw(), bbox=config.SP_BBOX)
    periods = dict(zip(df["bo_number"], df["period"]))
    assert periods["BO-1"] == "manha"
    assert periods["BO-2"] == "noite"


def test_neighborhood_normalization():
    df = cleaner.clean(_fake_raw(), bbox=config.SP_BBOX)
    assert "CENTRO" in df["neighborhood"].values   # trimmed + uppercased
    assert "PAULISTA" in df["neighborhood"].values


def test_summarize_shape():
    df = cleaner.clean(_fake_raw(), bbox=config.SP_BBOX)
    s = cleaner.summarize(df)
    assert s["total_incidents"] == 2
    assert s["by_crime_type"]["furto"] == 1
    assert s["by_crime_type"]["roubo"] == 1
    assert "bbox" in s


def test_clean_duplicate_bo():
    extra = [
        # mesma BO-1, duplicada (versão padrão da SSP gera N linhas por boletim)
        {
            config.SSP_LAT_COL: -23.5505, config.SSP_LNG_COL: -46.6333,
            config.SSP_RUBRICA_COL: "Furto (art. 155)",
            config.SSP_HORA_OCORRENCIA_COL: pd.Timestamp("2026-01-01 10:30:00"),
            config.SSP_PERIODO_COL: None,
            config.SSP_DATA_OCORRENCIA_COL: pd.Timestamp("2026-01-01"),
            config.SSP_BAIRRO_COL: "CENTRO", config.SSP_CIDADE_COL: "S.PAULO",
            "NUM_BO": "BO-1", "VERSAO": 1, "ANO_BO": 2026,
        },
    ]
    df_dedup = cleaner.clean(_fake_raw(extra), drop_duplicate_bo=True)
    df_keep  = cleaner.clean(_fake_raw(extra), drop_duplicate_bo=False)
    assert len(df_dedup) == 2
    assert len(df_keep) == 3
