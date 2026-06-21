#!/usr/bin/env python3
"""
run_pipeline.py
───────────────
Pipeline ponta-a-ponta — chamado por GitHub Actions e por humanos em PR review.

Equivale a:
    python scripts/process_xlsx.py
    python scripts/generate_heatmap.py

Pulamos o passo 1 se o parquet já existir e estiver mais novo que todos
os .xlsx em data/raw/ (cache simples baseado em mtime).

Exemplos:
    python scripts/run_pipeline.py
    python scripts/run_pipeline.py --force        # ignora cache
"""
from __future__ import annotations

import argparse
import subprocess
import sys
import time
from pathlib import Path

PIPELINE_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = PIPELINE_DIR / "scripts"
if str(PIPELINE_DIR) not in sys.path:
    sys.path.insert(0, str(PIPELINE_DIR))

from saifen_pipeline import config, loader  # noqa: E402


def _parquet_is_fresh() -> bool:
    parquet = config.PROCESSED_DIR / "celulares_clean.parquet"
    if not parquet.exists():
        return False
    raw_files = loader.list_raw_files()
    if not raw_files:
        return False
    newest_raw = max(f.stat().st_mtime for f in raw_files)
    return parquet.stat().st_mtime >= newest_raw


def _run(cmd: list[str]) -> None:
    print(f"\n$ {' '.join(cmd)}")
    t0 = time.time()
    subprocess.run(cmd, check=True)
    print(f"  ⏱  {time.time() - t0:.1f}s")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="Reprocessa mesmo se o cache estiver fresco.")
    parser.add_argument(
        "--",
        dest="passthrough",
        nargs=argparse.REMAINDER,
        help="Argumentos repassados ao generate_heatmap.py",
    )
    args = parser.parse_args()

    python = sys.executable

    if args.force or not _parquet_is_fresh():
        _run([python, str(SCRIPTS_DIR / "process_xlsx.py")])
    else:
        print("[cache] celulares_clean.parquet está atualizado — pulando process_xlsx.")
        print("        (use --force para forçar reprocessamento)")

    heatmap_cmd = [python, str(SCRIPTS_DIR / "generate_heatmap.py")]
    if args.passthrough:
        heatmap_cmd.extend(args.passthrough)
    _run(heatmap_cmd)

    print("\n✔ Pipeline concluído.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
