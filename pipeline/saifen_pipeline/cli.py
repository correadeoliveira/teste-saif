"""CLI saifen-pipeline: ingest, preprocess, train, evaluate, heatmap, publish, update."""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import TYPE_CHECKING

from saifen_pipeline import cleaner, config, exporter, ingest, loader, publish
from saifen_pipeline.evaluate import compare_models, evaluate_split, temporal_split
from saifen_pipeline.heatmap import generate_artifacts
from saifen_pipeline.log import execution, log_event, stage
from saifen_pipeline.models import get_model
from saifen_pipeline.spatial import aggregate_counts, features_frame

if TYPE_CHECKING:
    import pandas as pd


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


def _preprocess(args: argparse.Namespace, profile: dict, summary_path: Path) -> pd.DataFrame:
    source = Path(profile["path"])
    log_event("preprocess.load", file=source.name)
    df_raw = loader.load_ssp_xlsx(source)
    if ingest.sha256_file(source) != profile["sha256"]:
        raise ValueError("A planilha mudou durante o processamento. Reexecute com a fonte estável.")
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
    exporter.write_summary(summary, summary_path)
    grid = aggregate_counts(df)
    feats = features_frame(grid)
    feat_path = config.FEATURES_DIR / "crime_aggregate.parquet"
    feat_path.parent.mkdir(parents=True, exist_ok=True)
    feats.to_parquet(feat_path, index=False)
    log_event(
        "preprocess.ok",
        parquet=str(parquet.relative_to(config.ROOT_DIR)),
        summary=summary_path.name,
        n_feature_cells=int(len(feats)),
    )
    return df


def preprocess_cmd(args: argparse.Namespace) -> int:
    with stage("ingest"):
        profile = ingest.ingest(year=args.year, strict=True)
    with stage("preprocess"):
        _preprocess(args, profile, config.PROCESSED_DIR / "summary.json")
    return 0


def _load_clean() -> pd.DataFrame:
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
    with stage("evaluate"):
        split = temporal_split(_load_clean(), year=args.year)
        if args.compare:
            metrics = compare_models(split, args.sample_max)
            log_event(
                "evaluate.compare", selected=metrics["selected_kde"], omitted=metrics["omitted"]
            )
        else:
            model = _build_model(args)
            model.fit(split["train"])
            metrics = evaluate_split(model, split)
            log_event("evaluate.ok", model=model.name, metrics=metrics["test"])
    print(json.dumps(metrics, ensure_ascii=False, indent=2, allow_nan=False))
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
        output_dir=config.PROCESSED_DIR / "heatmaps",
    )
    return 0


def publish_cmd(args: argparse.Namespace) -> int:
    with publish.publication_lock(), stage("publish"):
        runs = sorted(
            path
            for path in config.RUNS_DIR.iterdir()
            if not path.name.startswith(".") and (path / "metadata.json").is_file()
        )
        if not runs:
            raise FileNotFoundError("Nenhum run preparado. Rode update.")
        publish.publish(runs[-1])
    return 0


def update_cmd(args: argparse.Namespace) -> int:
    started = time.monotonic()
    with publish.publication_lock():
        return _update_locked(args, started)


def _update_locked(args: argparse.Namespace, started: float) -> int:
    with stage("ingest"):
        profile = ingest.ingest(year=args.year, strict=True)
    model = _build_model(args)
    params = {
        "model": model.params(),
        "source_file": profile["file"],
        "source_year": args.year,
        "source_product": profile["product"],
        "bbox": None if args.no_bbox else config.SP_BBOX,
        "keep_dup_bo": args.keep_dup_bo,
        "per_type": not args.no_per_type,
        "per_period": not args.no_per_period,
        "min_density": args.min_density,
        "sample_max": args.sample_max,
    }
    if not 0 <= args.min_density <= 1 or args.sample_max < 1:
        raise ValueError("min_density deve estar em [0, 1] e sample_max deve ser positivo.")
    fp = publish.fingerprint(profile["sha256"], args.model, params)
    if not args.force and publish.current_fingerprint() == fp:
        log_event("update.skip", fingerprint=fp, reason="current_inventory_matches")
        return 0

    run_id = publish.new_run_id(fp)
    log_event("update.start", run_id=run_id, fingerprint=fp, model=model.name)
    with TemporaryDirectory(dir=config.RUNS_DIR, prefix=".stage-") as directory:
        output = Path(directory)
        with stage("preprocess"):
            df = _preprocess(args, profile, output / "summary.json")
        with stage("evaluate"):
            split_metrics = None
            try:
                split = temporal_split(df, year=args.year)
                eval_model = _build_model(args)
                eval_model.fit(split["train"])
                split_metrics = evaluate_split(eval_model, split)
                log_event("evaluate.ok", run_id=run_id, metrics=split_metrics["test"])
            except ValueError:
                log_event("evaluate.skip", run_id=run_id, reason="insufficient_evaluation_data")

        with stage("fit"):
            model.fit(df)
        with stage("export"):
            generate_artifacts(
                df,
                model,
                per_type=params["per_type"],
                per_period=params["per_period"],
                min_density=args.min_density,
                sample_max=args.sample_max,
                output_dir=output / "heatmaps",
            )

        metadata = {
            "run_id": run_id,
            "fingerprint": fp,
            "model": model.name,
            "model_version": model.version,
            "params": params,
            "source_file": profile["file"],
            "source_sha256": profile["sha256"],
            "product": profile["product"],
            "n_rows_raw": profile["n_rows"],
            "n_rows_clean": len(df),
            "drop_reasons": df.attrs.get("drop_reasons", {}),
            "geo": profile.get("geo"),
            "source_year": args.year,
            "pipeline_version": config.PIPELINE_VERSION,
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "duration_s": round(time.monotonic() - started, 2),
            "disclaimer": config.DISCLAIMER,
            "source_url": "https://www.ssp.sp.gov.br/estatistica/consultas",
        }
        with stage("validate"):
            run = publish.seal_run(output, metadata, split_metrics)
        with stage("publish"):
            publish.publish(run)

    log_event("update.ok", run_id=run_id, duration_s=round(time.monotonic() - started, 2))
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
    p_eval.add_argument(
        "--compare", action="store_true", help="Compara KDE e contagem em grade fixa."
    )

    p_heat = sub.add_parser(
        "heatmap", help="Gera artefatos de diagnóstico em data/processed/heatmaps."
    )
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
        with execution():
            return COMMANDS[args.cmd](args)
    except NotImplementedError as exc:
        log_event("error", cmd=args.cmd, error_type=type(exc).__name__)
        print(exc, file=sys.stderr)
        return 2
    except (OSError, ValueError) as exc:
        log_event("error", cmd=args.cmd, error_type=type(exc).__name__)
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
