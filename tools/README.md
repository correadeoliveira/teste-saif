# `tools/` — Dev scripts

| script | purpose |
|--------|---------|
| **`start.sh`** | **One command:** venv setup → pipeline → HTTP server → open browser |
| `dev-web.sh [port]` | HTTP server only (default `:8000`) |
| `run-pipeline.sh` | Python pipeline (`saifen-pipeline update`; `--force` rebuilds) |

```bash
./tools/start.sh                 # recommended — runs everything
./tools/start.sh --force         # rebuild heatmaps, then serve
./tools/dev-web.sh               # server only
./tools/run-pipeline.sh --force  # pipeline only
npm run train                    # same as run-pipeline.sh
```

All scripts `cd` to the monorepo root automatically.

Agent playbook (verify source → update KDE heatmap → check artifacts): [docs/agents/heatmap-pipeline.md](../docs/agents/heatmap-pipeline.md)
