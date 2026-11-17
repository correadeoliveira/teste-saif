#!/usr/bin/env bash
# ───────────────────────────────────────────────────
# SAIFEN — start.sh
#
# One command to run the project locally:
#   1. Create / activate Python venv + install deps (if needed)
#   2. Run the data pipeline (skipped when cache is fresh)
#   3. Start the static HTTP server
#   4. Open the web app in your default browser
#
# Usage:
#   ./tools/start.sh              # default port 8000
#   ./tools/start.sh --force      # rebuild heatmaps before serving
#   ./tools/start.sh --port 3000
#   ./tools/start.sh --no-open    # skip browser launch
# ───────────────────────────────────────────────────
set -euo pipefail

PORT="${PORT:-8000}"
FORCE_PIPELINE=0
OPEN_BROWSER=1

while [[ $# -gt 0 ]]; do
    case "$1" in
        --force)     FORCE_PIPELINE=1; shift ;;
        --no-open)   OPEN_BROWSER=0; shift ;;
        --port)      PORT="$2"; shift 2 ;;
        -h|--help)
            sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *) echo "Unknown option: $1 (try --help)" >&2; exit 1 ;;
    esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

APP_URL="http://localhost:${PORT}/web/"

banner() { printf "\n▸ %s\n" "$*"; }

# ── 1. Python environment and pipeline ────────────────────────────
if [[ "$FORCE_PIPELINE" -eq 1 ]]; then
    banner "Rebuilding heatmaps (--force)…"
    "$ROOT/tools/run-pipeline.sh" --force
else
    banner "Validating or rebuilding heatmaps…"
    "$ROOT/tools/run-pipeline.sh"
fi

# ── 3. HTTP server ──────────────────────────────────────────────────

banner "Starting server on :${PORT}"
"$ROOT/tools/dev-web.sh" "$PORT" &
SERVER_PID=$!

cleanup() {
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# wait until the server accepts connections
ready=0
for _ in $(seq 1 20); do
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then wait "$SERVER_PID"; exit 1; fi
    if curl -sf -o /dev/null "http://127.0.0.1:${PORT}/web/"; then
        ready=1
        break
    fi
    sleep 0.25
done

if [[ "$ready" -eq 0 ]]; then echo "Servidor indisponível na porta $PORT" >&2; exit 1; fi

# ── 4. Open browser ─────────────────────────────────────────────────
printf "\n"
printf "   SAIFEN is running\n"
printf "   ─────────────────────────────────────────\n"
printf "   web app  → %s\n" "$APP_URL"
printf "   heatmaps → http://localhost:%s/shared/heatmaps/\n" "$PORT"
printf "   summary  → http://localhost:%s/shared/summary.json\n" "$PORT"
printf "   ─────────────────────────────────────────\n"
printf "   Press Ctrl+C to stop\n\n"

if [[ "$OPEN_BROWSER" -eq 1 ]]; then
    if command -v open >/dev/null 2>&1; then
        open "$APP_URL"
    elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$APP_URL"
    else
        echo "   (could not auto-open browser — visit the URL above)"
    fi
fi

wait "$SERVER_PID"
