#!/usr/bin/env bash
# ───────────────────────────────────────────────────
# SAIFEN — run-pipeline.sh
#
# Atalho: ativa venv e dispara o pipeline Python ponta-a-ponta.
# Repassa argumentos para o subcomando update (ex: --force).
# ───────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -d ".venv" ]]; then
    echo "==> criando venv em .venv/"
    python3 -m venv .venv
fi
if ! .venv/bin/python -c 'import openpyxl, pandas, pyarrow, scipy, jsonschema' 2>/dev/null; then
    .venv/bin/python -m pip install -e pipeline
fi

# shellcheck disable=SC1091
source .venv/bin/activate
export PYTHONPATH="$ROOT/pipeline${PYTHONPATH:+:$PYTHONPATH}"
exec python -m saifen_pipeline update "$@"
