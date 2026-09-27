"""CLI saifen-pipeline: ingest, preprocess, train, evaluate, heatmap, publish, update."""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from saifen_pipeline import cleaner, config, exporter, ingest, loader, publish
from saifen_pipeline.evaluate import evaluate_split, temporal_split
from saifen_pipeline.heatmap import generate_artifacts
from saifen_pipeline.log import log_event
from saifen_pipeline.models import get_model
from saifen_pipeline.spatial import aggregate_counts, features_frame


def _parse_bandwidth(value: str):
    if value in {"scott", "silverman"}:
        return value
    try:
        return float(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("bandwidth deve ser scott, silverman ou float") from exc


def _add_common(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--force", action="store_true", help="Ignora cache/idempotência.")
    parser.add_argument("--year", type=int, default=config.SOURCE_YEAR)
    parser.add_argument(
        "--model",
        choices=("kde", "baseline", "kriging"),
        default="kde",
        help="Modelo espacial. default=kde (MVP).",
    )
    parser.add_argument("--bandwidth", type=_parse_bandwidth, default=config.KDE_BANDWIDTH)
    parser.add_argument("--bandwidth-m", type=float, default=None, help="Bandwidth KDE em metros.")
    parser.add_argument("--grid-size", type=int, default=config.KDE_GRID_SIZE)
    parser.add_argument("--sample-max", type=int, default=10_000)


def ingest_cmd(args: argparse.Namespace) -> int:
    ingest.ingest(year=args.year, strict=not getattr(args, "allow_invalid", False))
    return 0


def preprocess_cmd(args: argparse.Namespace) -> int:
    profile = ingest.ingest(year=args.year, strict=True)
    source = Path(profile["path"])
    log_event("preprocess.load", file=source.name)
    df_raw = loader.load_ssp_xlsx(source)
    df_raw["_source_file"] = source.name
    bbox = None if getattr(args, "no_bbox", False) else config.SP_BBOX
    df = cleaner.clean(
        df_raw,
        bbox=bbox,
        drop_duplicate_bo=not getattr(args, "keep_dup_bo", False),
        source_year=args.year,
        heatmap_ready=True,
    )
    log_event(
        "preprocess.clean",
        rows_in=df.attrs.get("rows_in"),
        rows_out=df.attrs.get("rows_out"),
        drop_rate=df.attrs.get("drop_rate"),
        drop_reasons=df.attrs.get("drop_reasons"),
        source=df.attrs.get("source"),
    )
    parquet = exporter.write_processed_parquet(df)
    summary = cleaner.summarize(df)
    summary_path = exporter.write_summary(summary)
    grid = aggregate_counts(df)
    feats = features_frame(grid)
    feat_path = config.FEATURES_DIR / "crime_aggregate.parquet"
    feat_path.parent.mkdir(parents=True, exist_ok=True)
    if len(feats):
        feats.to_parquet(feat_path, index=False)
    log_event(
        "preprocess.ok",
        parquet=str(parquet.relative_to(config.ROOT_DIR)),
        summary=str(summary_path.relative_to(config.ROOT_DIR)),
        n_feature_cells=int(len(feats)),
    )
    return 0


def _load_clean() -> pd.DataFrame:  # noqa: F821
    import pandas as pd

    parquet = config.PROCESSED_DIR / "celulares_clean.parquet"
    if not parquet.exists():
        raise FileNotFoundError(f"{parquet} não existe. Rode: saifen-pipeline preprocess")
    return pd.read_parquet(parquet)


def _build_model(args: argparse.Namespace):
    kwargs = {}
    if args.model == "kde":
        kwargs = {
            "bandwidth": args.bandwidth,
            "bandwidth_m": args.bandwidth_m,
            "sample_max": args.sample_max,
            "grid_size": args.grid_size,
        }
    elif args.model == "baseline":
        kwargs = {}
    return get_model(args.model, **kwargs)


def train_cmd(args: argparse.Namespace) -> int:
    df = _load_clean()
    model = _build_model(args)
    t0 = time.time()
    model.fit(df)
    log_event(
        "train.ok",
        model=model.name,
        n=len(df),
        duration_s=round(time.time() - t0, 2),
        params=model.params(),
    )
    return 0


def evaluate_cmd(args: argparse.Namespace) -> int:
    df = _load_clean()
    split = temporal_split(df, year=args.year)
    model = _build_model(args)
    model.fit(split["train"])
    metrics = evaluate_split(model, split)
    log_event("evaluate.ok", model=model.name, metrics=metrics.get("test"))
    print(json.dumps(metrics, ensure_ascii=False, indent=2, default=str))
    return 0


def heatmap_cmd(args: argparse.Namespace) -> int:
    df = _load_clean()
    model = _build_model(args)
    model.fit(df)
    generate_artifacts(
        df,
        model,
        per_type=not getattr(args, "no_per_type", False),
        per_period=not getattr(args, "no_per_period", False),
        min_density=getattr(args, "min_density", config.KDE_MIN_DENSITY),
        sample_max=args.sample_max,
        write_grid=not getattr(args, "no_grid", False),
        write_crimes=not getattr(args, "no_crimes", False),
    )
    return 0


def publish_cmd(args: argparse.Namespace) -> int:
    if not config.CURRENT_RUN_PATH.exists() and not config.RUNS_DIR.exists():
        log_event("publish.skip", reason="nenhum run gerado — rode update")
        return 1
    # republish último run se existir
    runs = sorted(config.RUNS_DIR.glob("*"))
    if not runs:
        return 1
    latest = runs[-1]
    meta_path = latest / "metadata.json"
    metadata = (
        json.loads(meta_path.read_text(encoding="utf-8"))
        if meta_path.exists()
        else {"run_id": latest.name}
    )
    publish.publish(latest, metadata)
    return 0


def update_cmd(args: argparse.Namespace) -> int:
    t0 = time.time()
    profile = ingest.ingest(year=args.year, strict=True)
    model = _build_model(args)
    fp = publish.fingerprint(profile["sha256"], args.model, model.params())
    if not args.force and publish.current_fingerprint() == fp:
        log_event("update.skip", fingerprint=fp, reason="fonte e params inalterados")
        return 0

    preprocess_cmd(args)
    df = _load_clean()
    split_metrics = None
    try:
        split = temporal_split(df, year=args.year)
        eval_model = _build_model(args)
        eval_model.fit(split["train"])
        split_metrics = evaluate_split(eval_model, split)
        log_event("evaluate.ok", metrics=split_metrics.get("test"))
    except (ValueError, NotImplementedError) as exc:
        log_event("evaluate.skip", reason=str(exc))

    model.fit(df)
    generate_artifacts(
        df,
        model,
        per_type=not getattr(args, "no_per_type", False),
        per_period=not getattr(args, "no_per_period", False),
        min_density=getattr(args, "min_density", config.KDE_MIN_DENSITY),
        sample_max=args.sample_max,
    )

    run_id = publish.new_run_id(fp)
    metadata = {
        "run_id": run_id,
        "fingerprint": fp,
        "model": model.name,
        "model_version": model.version,
        "params": model.params(),
        "source_file": profile["file"],
        "source_sha256": profile["sha256"],
        "product": profile["product"],
        "n_rows_raw": profile["n_rows"],
        "n_rows_clean": len(df),
        "drop_reasons": df.attrs.get("drop_reasons", {}),
        "geo": profile.get("geo"),
        "source_year": args.year,
        "pipeline_version": config.PIPELINE_VERSION,
        "generated_at": __import__("datetime")
        .datetime.now(__import__("datetime").timezone.utc)
        .isoformat(timespec="seconds"),
        "duration_s": round(time.time() - t0, 2),
        "disclaimer": config.DISCLAIMER,
        "source_url": "https://www.ssp.sp.gov.br/estatistica/consultas",
    }
    run_dir = publish.write_run(run_id, metadata, metrics=split_metrics)
    publish.publish(run_dir, metadata)
    log_event(
        "update.ok",
        run_id=run_id,
        duration_s=metadata["duration_s"],
        artifact=str(config.HEATMAP_DIR.relative_to(config.ROOT_DIR)),
    )
    return 0


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="saifen-pipeline",
        description="Pipeline SSP-SP → heatmap (treino local; o app só consome artefatos).",
    )
    sub = parser.add_subparsers(dest="cmd")

    p_ingest = sub.add_parser("ingest", help="Valida XLSX, checksum e manifest.")
    _add_common(p_ingest)
    p_ingest.add_argument("--allow-invalid", action="store_true")

    p_pre = sub.add_parser("preprocess", help="xlsx → parquet + summary + features.")
    _add_common(p_pre)
    p_pre.add_argument("--no-bbox", action="store_true")
    p_pre.add_argument("--keep-dup-bo", action="store_true")

    p_train = sub.add_parser("train", help="Ajusta o modelo espacial.")
    _add_common(p_train)

    p_eval = sub.add_parser("evaluate", help="Split temporal intra-2026 + métricas.")
    _add_common(p_eval)

    p_heat = sub.add_parser("heatmap", help="Gera artefatos em shared/heatmaps.")
    _add_common(p_heat)
    p_heat.add_argument("--no-per-type", action="store_true")
    p_heat.add_argument("--no-per-period", action="store_true")
    p_heat.add_argument("--no-grid", action="store_true")
    p_heat.add_argument("--no-crimes", action="store_true")
    p_heat.add_argument("--min-density", type=float, default=config.KDE_MIN_DENSITY)

    sub.add_parser("publish", help="Republica o último run nos paths estáveis.")

    p_up = sub.add_parser("update", help="Fluxo completo idempotente.")
    _add_common(p_up)
    p_up.add_argument("--no-bbox", action="store_true")
    p_up.add_argument("--keep-dup-bo", action="store_true")
    p_up.add_argument("--no-per-type", action="store_true")
    p_up.add_argument("--no-per-period", action="store_true")
    p_up.add_argument("--min-density", type=float, default=config.KDE_MIN_DENSITY)

    return parser


COMMANDS = {
    "ingest": ingest_cmd,
    "preprocess": preprocess_cmd,
    "train": train_cmd,
    "evaluate": evaluate_cmd,
    "heatmap": heatmap_cmd,
    "publish": publish_cmd,
    "update": update_cmd,
}


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    # Compat: `saifen-pipeline --force` equivale a `update --force`
    if not argv or argv[0].startswith("-"):
        argv = ["update", *argv]
    parser = _build_parser()
    args = parser.parse_args(argv)
    if not args.cmd:
        args = parser.parse_args(["update"])
    try:
        return COMMANDS[args.cmd](args)
    except NotImplementedError as exc:
        log_event("error", cmd=args.cmd, error=str(exc))
        print(exc, file=sys.stderr)
        return 2
    except (FileNotFoundError, ValueError) as exc:
        log_event("error", cmd=args.cmd, error=str(exc))
        print(exc, file=sys.stderr)
        return 1


def ingest_entry() -> None:
    raise SystemExit(main(["ingest", *sys.argv[1:]]))


def preprocess_entry() -> None:
    raise SystemExit(main(["preprocess", *sys.argv[1:]]))


def heatmap_entry() -> None:
    raise SystemExit(main(["heatmap", *sys.argv[1:]]))


def supabase_entry() -> None:
    import runpy

    path = Path(__file__).resolve().parents[1] / "scripts" / "push_to_supabase.py"
    runpy.run_path(str(path), run_name="__main__")
