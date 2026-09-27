"""
Leitura de planilhas brutas da SSP-SP.

Detecta a sheet de dados por prefixo CELULAR_* ou pela presença
de LATITUDE/LONGITUDE (produto SPDadosCriminais).
"""

from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path

import pandas as pd

from saifen_pipeline import config
from saifen_pipeline.ingest import _detect_data_sheet, list_candidate_files, resolve_source


def list_raw_files(pattern: str | None = None) -> list[Path]:
    """Retorna os .xlsx de ocorrências disponíveis em data/raw/."""
    if pattern:
        return sorted(config.RAW_DIR.glob(pattern))
    return list_candidate_files()


def load_ssp_xlsx(path: str | Path) -> pd.DataFrame:
    """
    Carrega a sheet de ocorrências de um arquivo SSP-SP.

    Parameters
    ----------
    path : str | Path
        Caminho para o .xlsx (relativo ou absoluto).

    Returns
    -------
    pd.DataFrame
        DataFrame bruto, sem nenhuma limpeza — preserve para auditoria.
    """
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {path}")

    sheet = _detect_data_sheet(path)
    df = pd.read_excel(path, sheet_name=sheet)
    df.attrs["source_file"] = path.name
    df.attrs["source_sheet"] = sheet
    return df


def load_all_raw(files: Iterable[Path] | None = None) -> pd.DataFrame:
    """
    Carrega e concatena todos os .xlsx brutos disponíveis.

    Adiciona uma coluna `_source_file` para rastreabilidade,
    útil quando vários arquivos anuais são processados juntos.
    """
    files = list(files) if files is not None else [resolve_source()]
    if not files:
        raise FileNotFoundError(
            f"Nenhum .xlsx encontrado em {config.RAW_DIR}. "
            "Coloque os arquivos da SSP-SP em data/raw/."
        )

    frames = []
    for f in files:
        df = load_ssp_xlsx(f)
        df["_source_file"] = f.name
        frames.append(df)

    out = pd.concat(frames, ignore_index=True)
    out.attrs["source_files"] = [f.name for f in files]
    return out
