"""Structured CLI diagnostics with a correlation ID for each execution."""

from __future__ import annotations

import json
import sys
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import datetime, timezone
from time import monotonic
from typing import Any
from uuid import uuid4

_run_id: ContextVar[str | None] = ContextVar("run_id", default=None)


@contextmanager
def execution():
    token = _run_id.set(uuid4().hex)
    try:
        yield
    finally:
        _run_id.reset(token)


def log_event(event: str, **fields: Any) -> None:
    payload = {
        "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "event": event,
        "execution_id": _run_id.get(),
        **fields,
    }
    sys.stdout.write(json.dumps(payload, ensure_ascii=False, allow_nan=False) + "\n")
    sys.stdout.flush()


@contextmanager
def stage(name: str):
    started = monotonic()
    try:
        yield
    except Exception as exc:
        log_event(
            "stage",
            stage=name,
            outcome="error",
            error_type=type(exc).__name__,
            duration_s=round(monotonic() - started, 3),
        )
        raise
    else:
        log_event("stage", stage=name, outcome="ok", duration_s=round(monotonic() - started, 3))
