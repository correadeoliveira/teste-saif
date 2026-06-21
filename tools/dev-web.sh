#!/usr/bin/env bash
# ───────────────────────────────────────────────────
# SAIFEN — dev-web.sh
#
# Sobe um HTTP server estático na RAIZ do monorepo.
# Servir da raiz é essencial para que /shared/heatmaps/* resolva
# tanto para o web (web/index.html) quanto para o mobile em dev
# (que faz fetch via EXPO_PUBLIC_SHARED_BASE).
# ───────────────────────────────────────────────────
set -euo pipefail

PORT="${1:-8000}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

printf "\n   SAIFEN — serving %s on :%s\n" "$ROOT" "$PORT"
printf "   ────────────────────────────────────────────────\n"
printf "   web app  → http://localhost:%s/web/\n" "$PORT"
printf "   heatmaps → http://localhost:%s/shared/heatmaps/\n" "$PORT"
printf "   summary  → http://localhost:%s/shared/summary.json\n\n" "$PORT"

exec python3 -m http.server "$PORT"
