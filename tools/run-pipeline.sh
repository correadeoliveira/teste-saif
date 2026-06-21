#!/usr/bin/env bash
# ───────────────────────────────────────────────────
# SAIFEN — run-pipeline.sh
#
# Atalho: ativa venv e dispara o pipeline Python ponta-a-ponta.
# Repassa argumentos para `run_pipeline.py` (ex: --force).
# ───────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -d ".venv" ]]; then
    echo "==> criando venv em .venv/"
    python3 -m venv .venv
    .venv/bin/pip install --upgrade pip
    .venv/bin/pip install -r pipeline/requirements.txt
fi

# shellcheck disable=SC1091
source .venv/bin/activate
exec python pipeline/scripts/run_pipeline.py "$@"
