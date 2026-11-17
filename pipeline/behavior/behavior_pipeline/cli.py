from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from time import monotonic
from uuid import uuid4

import pandas as pd

from behavior_pipeline import config
from behavior_pipeline.generate import first_window_samples, generate_demo, window_feature_vector
from behavior_pipeline.preprocess import build_windows, preprocess
from behavior_pipeline.train import (
    evaluate,
    predict_proba,
    train_from_windows,
    validate_model,
    write_json,
)


def cmd_generate_demo(_args: argparse.Namespace) -> dict:
    generate_demo()
    return {"mode": "synthetic_demo", "count": 16}


def cmd_preprocess(args: argparse.Namespace) -> dict:
    path = preprocess(by_subject=args.by_subject)
    return {"count": len(pd.read_parquet(path))}


def cmd_train(args: argparse.Namespace) -> dict:
    windows = build_windows(by_subject=args.by_subject)
    model = train_from_windows(windows)
    validate_model(model)
    path = config.PROCESSED_DIR / "real_model.json" if args.by_subject else config.MODEL_PATH
    write_json(path, model)
    return {"count": len(windows), "version": model["version"]}


def cmd_evaluate(args: argparse.Namespace) -> dict:
    windows = build_windows(by_subject=args.by_subject)
    path = config.PROCESSED_DIR / "real_model.json" if args.by_subject else config.MODEL_PATH
    model = json.loads(path.read_text())
    validate_model(model)
    metrics = evaluate(windows, model)
    result = {"mode": windows.attrs["evaluation_mode"], **metrics}
    path = config.PROCESSED_DIR / "real_metrics.json" if args.by_subject else config.METRICS_PATH
    write_json(path, result)
    return {"metrics": result}


def cmd_export_model(_args: argparse.Namespace) -> dict:
    if config.MODEL_PATH.exists():
        model = json.loads(config.MODEL_PATH.read_text())
    else:
        model = train_from_windows(build_windows())
    validate_model(model)
    if model.get("evaluation_mode", "synthetic_demo") != "synthetic_demo":
        raise ValueError("O pacote Expo desta rodada usa o modelo demonstrativo.")
    records = first_window_samples()
    features = window_feature_vector(records)
    dummy = pd.DataFrame([dict(zip(model["feature_names"], features))])
    dummy["label"] = config.LABEL_POSITIVE
    score = float(predict_proba(dummy, model)[0])
    if not 0 <= score <= 1:
        raise ValueError("Score de paridade IMU inválido.")
    write_json(
        config.PARITY_PATH,
        {
            "source": "synthetic",
            "samples": records,
            "feature_names": model["feature_names"],
            "features": features,
            "score": score,
            "model": model,
        },
    )
    write_json(config.MODEL_PATH, model)
    write_json(config.MOBILE_MODEL_PATH, model)
    return {"mode": "synthetic_demo", "version": model["version"], "count": len(records)}


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="behavior_pipeline")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("generate-demo").set_defaults(func=cmd_generate_demo)
    sub.add_parser("export-model").set_defaults(func=cmd_export_model)
    for name, func in (
        ("preprocess", cmd_preprocess),
        ("train", cmd_train),
        ("evaluate", cmd_evaluate),
    ):
        command = sub.add_parser(name)
        command.set_defaults(func=func)
        command.add_argument(
            "--by-subject", action="store_true", help="Avalia sessões reais por participante."
        )
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    event = {"event": "behavior.stage", "execution_id": uuid4().hex, "stage": args.cmd}
    started = monotonic()
    code = 0
    try:
        event.update(outcome="ok", **args.func(args))
    except (OSError, ValueError) as exc:
        event.update(outcome="error", error_type=type(exc).__name__)
        if isinstance(exc, FileNotFoundError):
            print("Confira a fonte e os artefatos do comando IMU.", file=sys.stderr)
        else:
            print("Falha na validação ou gravação dos artefatos IMU.", file=sys.stderr)
        code = 1
    event.update(
        ts=datetime.now(timezone.utc).isoformat(), duration_s=round(monotonic() - started, 3)
    )
    print(json.dumps(event, ensure_ascii=False, allow_nan=False))
    return code


if __name__ == "__main__":
    sys.exit(main())
