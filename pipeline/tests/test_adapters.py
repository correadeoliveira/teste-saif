"""Adapters celulares / spdados → schema canônico."""

from __future__ import annotations

import pandas as pd

from saifen_pipeline.adapters import detect_adapter
from saifen_pipeline.cleaner import clean
from saifen_pipeline.loader import load_ssp_xlsx


def test_celulares_adapter_and_geo_quality(celulares_xlsx):
    raw = load_ssp_xlsx(celulares_xlsx)
    adapter = detect_adapter(raw)
    assert adapter.name == "celulares"
    full = clean(raw, heatmap_ready=False, source_year=2026, drop_duplicate_bo=False)
    assert set(full["geo_quality"]) >= {"valid", "missing", "zero"}
    ready = clean(raw, heatmap_ready=True, source_year=2026)
    assert (ready["geo_quality"] == "valid").all()
    assert set(ready["crime_type"]) <= {"furto", "roubo", "outros"}
    assert "event_id" in ready.columns


def test_spdados_adapter(spdados_xlsx):
    raw = load_ssp_xlsx(spdados_xlsx)
    adapter = detect_adapter(raw)
    assert adapter.name == "spdados"
    df = clean(raw, heatmap_ready=True, source_year=2026)
    assert len(df) == 1
    assert df.iloc[0]["crime_type"] == "furto"
    assert df.iloc[0]["source"] == "spdados"


def test_year_filter_drops_old_dates(celulares_xlsx):
    raw = load_ssp_xlsx(celulares_xlsx)
    raw = pd.concat(
        [
            raw,
            pd.DataFrame(
                [
                    {
                        "LATITUDE": -23.55,
                        "LONGITUDE": -46.63,
                        "RUBRICA": "Furto",
                        "DATA_OCORRENCIA_BO": pd.Timestamp("2006-12-21"),
                        "HORA_OCORRENCIA": None,
                        "DESCR_PERIODO": None,
                        "BAIRRO": "X",
                        "CIDADE": "S.PAULO",
                        "LOGRADOURO": None,
                        "NOME_DELEGACIA": "01",
                        "MARCA_OBJETO": None,
                        "NUM_BO": "OLD",
                        "VERSAO": 1,
                        "ANO_BO": 2006,
                    }
                ]
            ),
        ],
        ignore_index=True,
    )
    df = clean(raw, heatmap_ready=True, source_year=2026)
    assert (df["occurred_at"].dt.year == 2026).all()
