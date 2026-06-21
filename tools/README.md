# `tools/` — Dev scripts

| script | purpose |
|--------|---------|
| **`start.sh`** | **One command:** venv setup → pipeline → HTTP server → open browser |
| `dev-web.sh [port]` | HTTP server only (default `:8000`) |
| `run-pipeline.sh` | Python pipeline only (pass `--force` to rebuild) |

```bash
./tools/start.sh                 # recommended — runs everything
./tools/start.sh --force         # rebuild heatmaps, then serve
./tools/dev-web.sh               # server only
./tools/run-pipeline.sh --force  # pipeline only
```

All scripts `cd` to the monorepo root automatically.
