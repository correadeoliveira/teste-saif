"""
Cliente Supabase compartilhado pelo pipeline.

Wrapper fino sobre `supabase-py` que:
    1. Lê credenciais de `.env` (na raiz do monorepo)
    2. Falha bonito se as deps opcionais não estiverem instaladas
    3. Expõe operações de alto nível usadas pelos scripts:
        - upsert_crimes(rows)
        - replace_heatmap_grid(features)

Mantenha esse módulo idempotente. Os scripts em `pipeline/scripts/` são a
"camada CLI"; este arquivo é a "camada cliente".
"""

from __future__ import annotations

import os
from typing import Any, Iterable

from saifen_pipeline import config

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - dep mínima
    load_dotenv = None  # type: ignore[assignment]

try:
    from supabase import Client, create_client
except ImportError:  # pragma: no cover - dep opcional
    Client = None  # type: ignore[assignment]
    create_client = None  # type: ignore[assignment]


CHUNK_SIZE = 1000


def _ensure_deps() -> None:
    if create_client is None:
        raise RuntimeError(
            "Dependência 'supabase' ausente. Instale com:\n"
            "    pip install -e pipeline[supabase]\n"
            "ou\n"
            "    pip install supabase python-dotenv"
        )


def load_env() -> tuple[str, str]:
    """Carrega .env (na raiz do monorepo) e retorna (URL, SERVICE_KEY)."""
    if load_dotenv is not None:
        load_dotenv(config.ROOT_DIR / ".env")
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")
    if not (url and key):
        raise RuntimeError(
            "Variáveis SUPABASE_URL e SUPABASE_SERVICE_KEY não definidas. "
            f"Crie um arquivo {config.ROOT_DIR / '.env'} (veja supabase/README.md)."
        )
    return url, key


def get_client():
    """Retorna um Supabase Client autenticado com a service key."""
    _ensure_deps()
    url, key = load_env()
    return create_client(url, key)


def upsert_crimes(client, rows: Iterable[dict[str, Any]], *, chunk: int = CHUNK_SIZE) -> int:
    """Insere/atualiza ocorrências na tabela `crimes`. Retorna total enviado."""
    rows = list(rows)
    total = 0
    for i in range(0, len(rows), chunk):
        batch = rows[i : i + chunk]
        client.table("crimes").upsert(batch, on_conflict="bo_number").execute()
        total += len(batch)
    return total


def replace_heatmap_grid(client, features: Iterable[dict[str, Any]], *, chunk: int = CHUNK_SIZE) -> int:
    """Substitui o conteúdo da tabela `heatmap_grid` pela nova grade KDE."""
    client.table("heatmap_grid").delete().neq("id", 0).execute()
    features = list(features)
    total = 0
    for i in range(0, len(features), chunk):
        batch = features[i : i + chunk]
        client.table("heatmap_grid").insert(batch).execute()
        total += len(batch)
    return total
