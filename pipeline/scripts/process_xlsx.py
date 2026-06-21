#!/usr/bin/env python3
"""
process_xlsx.py
───────────────
Lê todos os .xlsx em data/raw/, aplica limpeza e salva:
    data/processed/celulares_clean.parquet
    output/summary.json

Etapa idempotente — pode rodar quantas vezes quiser.

Exemplos:
    python scripts/process_xlsx.py
    python scripts/process_xlsx.py --no-bbox       # mantém todo o estado SP
    python scripts/process_xlsx.py --keep-dup-bo
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Permite executar como `python pipeline/scripts/process_xlsx.py` direto.
PIPELINE_DIR = Path(__file__).resolve().parents[1]
if str(PIPELINE_DIR) not in sys.path:
    sys.path.insert(0, str(PIPELINE_DIR))

from saifen_pipeline import cleaner, config, exporter, loader  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--no-bbox",
        action="store_true",
        help="Não restringe à bbox de SP capital (mantém estado inteiro).",
    )
    parser.add_argument(
        "--keep-dup-bo",
        action="store_true",
        help="Mantém linhas duplicadas por NUM_BO (linha-por-objeto subtraído).",
    )
    args = parser.parse_args()

    print(f"[1/3] Lendo arquivos de {config.RAW_DIR.relative_to(config.ROOT_DIR)}...")
    df_raw = loader.load_all_raw()
    print(f"      → {len(df_raw):,} linhas em {len(df_raw.attrs.get('source_files', []))} arquivo(s)")

    print("[2/3] Limpando e padronizando...")
    bbox = None if args.no_bbox else config.SP_BBOX
    df = cleaner.clean(df_raw, bbox=bbox, drop_duplicate_bo=not args.keep_dup_bo)
    print(f"      → {len(df):,} linhas válidas (descarte {df.attrs['drop_rate']:.1%})")

    print("[3/3] Exportando artefatos...")
    parquet = exporter.write_processed_parquet(df)
    summary_path = exporter.write_summary(cleaner.summarize(df))

    print(f"      ✓ {parquet.relative_to(config.ROOT_DIR)}")
    print(f"      ✓ {summary_path.relative_to(config.ROOT_DIR)}")
    print("\nOK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
