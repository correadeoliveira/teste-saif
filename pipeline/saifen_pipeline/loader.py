"""
Leitura de planilhas brutas da SSP-SP.

A SSP publica os dados em .xlsx com três sheets:
    1. METODOLOGIA          (texto)
    2. DICIONARIO DE DADOS  (dicionário de campos)
    3. CELULAR_<ANO>        (dados em si, ~115k linhas / 55 colunas)

Este módulo expõe utilitários para localizar e carregar a sheet
de dados de qualquer arquivo CelularesSubtraidos_*.xlsx.
"""

from __future__ import annotations

from pathlib import Path
from typing import Iterable

import pandas as pd

from saifen_pipeline import config


def list_raw_files(pattern: str = "CelularesSubtraidos_*.xlsx") -> list[Path]:
    """Retorna todos os .xlsx de ocorrências disponíveis em data/raw/."""
    return sorted(config.RAW_DIR.glob(pattern))


def _detect_data_sheet(path: Path) -> str:
    """
    Detecta a sheet de dados (CELULAR_<ANO>) dentro do .xlsx.

    Útil porque arquivos futuros virão com nomes como CELULAR_2027,
    CELULAR_2028 etc — então preferimos detectar pelo prefixo a
    confiar no nome fixo do config.
    """
    sheets = pd.ExcelFile(path).sheet_names
    for s in sheets:
        if s.upper().startswith("CELULAR"):
            return s
    raise ValueError(
        f"Nenhuma sheet 'CELULAR_*' encontrada em {path.name}. "
        f"Sheets disponíveis: {sheets}"
    )


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
    files = list(files) if files is not None else list_raw_files()
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
