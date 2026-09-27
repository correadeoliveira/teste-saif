from __future__ import annotations

import argparse
import json
import shutil
import sys

import pandas as pd

from behavior_pipeline import config
from behavior_pipeline.generate import first_window_samples, generate_demo, window_feature_vector
from behavior_pipeline.preprocess import build_windows, preprocess
from behavior_pipeline.train import evaluate, predict_proba, train_from_windows, write_json


def cmd_generate_demo(_args: argparse.Namespace) -> int:
    dest = generate_demo()
    print(f"demo sessions → {dest}")
    return 0


def cmd_preprocess(_args: argparse.Namespace) -> int:
    path = preprocess()
    print(f"features → {path}")
    return 0


def cmd_train(_args: argparse.Namespace) -> int:
    windows = build_windows()
    model = train_from_windows(windows)
    write_json(config.MODEL_PATH, model)
    print(f"model → {config.MODEL_PATH}")
    return 0


def cmd_evaluate(_args: argparse.Namespace) -> int:
    windows = build_windows()
    model = json.loads(config.MODEL_PATH.read_text())
    metrics = evaluate(windows, model)
    write_json(config.METRICS_PATH, metrics)
    print(json.dumps(metrics, indent=2))
    return 0


def cmd_export_model(_args: argparse.Namespace) -> int:
    if not config.MODEL_PATH.exists():
        windows = build_windows()
        model = train_from_windows(windows)
        write_json(config.MODEL_PATH, model)
    else:
        model = json.loads(config.MODEL_PATH.read_text())
    config.MOBILE_MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(config.MODEL_PATH, config.MOBILE_MODEL_PATH)
    records = first_window_samples()
    features = window_feature_vector(records)
    dummy = pd.DataFrame([dict(zip(model["feature_names"], features))])
    dummy["label"] = config.LABEL_POSITIVE
    score = float(predict_proba(dummy, model)[0])
    write_json(
        config.PARITY_PATH,
        {
            "samples": records,
            "feature_names": model["feature_names"],
            "features": features,
            "score": score,
            "model": model,
        },
    )
    print(f"copied → {config.MOBILE_MODEL_PATH}")
    print(f"parity → {config.PARITY_PATH}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="behavior_pipeline")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("generate-demo").set_defaults(func=cmd_generate_demo)
    sub.add_parser("preprocess").set_defaults(func=cmd_preprocess)
    sub.add_parser("train").set_defaults(func=cmd_train)
    sub.add_parser("evaluate").set_defaults(func=cmd_evaluate)
    sub.add_parser("export-model").set_defaults(func=cmd_export_model)
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    sys.exit(main())
