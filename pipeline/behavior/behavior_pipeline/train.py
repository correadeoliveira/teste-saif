from __future__ import annotations

import hashlib
import json
import os
from tempfile import NamedTemporaryFile
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.preprocessing import StandardScaler

from behavior_pipeline import config


def _xy(df: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    y = (df["label"] == config.LABEL_POSITIVE).astype(int).to_numpy()
    x = df[config.FEATURE_NAMES].to_numpy(dtype=float)
    return x, y


def _labeled(windows: pd.DataFrame) -> pd.DataFrame:
    return windows.loc[windows["label"].isin((config.LABEL_POSITIVE, config.LABEL_NEGATIVE))]


def _session_scores(windows: pd.DataFrame, scores: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    sessions = (
        windows.assign(score=scores)
        .groupby(["subject_id", "session_id"])
        .agg(label=("label", "first"), score=("score", "median"))
    )
    return (sessions["label"] == config.LABEL_POSITIVE).astype(int).to_numpy(), sessions[
        "score"
    ].to_numpy()


def _youden_threshold(y_true: np.ndarray, scores: np.ndarray) -> float:
    if len(np.unique(y_true)) < 2 or not np.ptp(scores):
        return 0.5
    boundaries = sorted(set(scores) | {0.0, 1.0})
    intervals = list(zip(boundaries, boundaries[1:]))

    def quality(interval: tuple[float, float]) -> tuple[float, float]:
        low, high = interval
        threshold = (low + high) / 2
        separation = (scores[y_true == 1] >= threshold).mean() - (
            scores[y_true == 0] >= threshold
        ).mean()
        return float(separation), high - low

    low, high = max(intervals, key=quality)
    return float((low + high) / 2)


def _dataset_hash(windows: pd.DataFrame) -> str:
    columns = ["subject_id", "session_id", "label", "fold", "window_index", *config.FEATURE_NAMES]
    ordered = windows[columns].sort_values(["subject_id", "session_id", "window_index"])
    return hashlib.sha256(ordered.to_csv(index=False).encode()).hexdigest()


def train_from_windows(windows: pd.DataFrame) -> dict:
    windows = _labeled(windows)
    train = windows[windows["fold"] == "train"]
    val = windows[windows["fold"] == "validation"]
    x_train, y_train = _xy(train)
    if len(np.unique(y_train)) != 2:
        raise ValueError("O grupo de treino precisa de sessões das duas classes.")
    scaler = StandardScaler()
    x_train_s = scaler.fit_transform(x_train)
    clf = LogisticRegression(max_iter=2000, solver="lbfgs", C=0.5)
    # Some BLAS builds raise spurious floating-point flags on matrix products.
    with np.errstate(divide="ignore", over="ignore", invalid="ignore"):
        clf.fit(x_train_s, y_train)
    if not np.isfinite(clf.coef_).all() or not np.isfinite(clf.intercept_).all():
        raise ValueError("O ajuste IMU produziu coeficientes não finitos.")
    threshold = 0.5
    if not val.empty:
        validation = scaler.transform(_xy(val)[0])
        scores = _sigmoid(np.sum(validation * clf.coef_[0], axis=1) + clf.intercept_[0])
        session_y, session_scores = _session_scores(val, scores)
        threshold = _youden_threshold(session_y, session_scores)
    model = {
        "version": "1.1.0",
        "evaluation_mode": windows.attrs.get("evaluation_mode", "synthetic_demo"),
        "training_data_sha256": _dataset_hash(windows),
        "type": "logistic_regression",
        "feature_names": list(config.FEATURE_NAMES),
        "scaler": {
            "mean": scaler.mean_.astype(float).tolist(),
            "scale": scaler.scale_.astype(float).tolist(),
        },
        "coef": clf.coef_.reshape(-1).astype(float).tolist(),
        "intercept": float(clf.intercept_.reshape(-1)[0]),
        "threshold": threshold,
        "window_ms": config.WINDOW_MS,
        "overlap": config.WINDOW_OVERLAP,
        "sample_rate_hz": config.TARGET_HZ,
        "label_positive": config.LABEL_POSITIVE,
    }
    return model


def session_metrics(windows: pd.DataFrame, model: dict, fold: str) -> dict:
    part = windows[windows["fold"] == fold]
    if part.empty:
        return {"fold": fold, "n_windows": 0, "n_sessions": 0}
    y, scores = _session_scores(part, predict_proba(part, model))
    pred = (scores >= model["threshold"]).astype(int)
    neg, pos = y == 0, y == 1
    accuracy = float(accuracy_score(y, pred))
    return {
        "fold": fold,
        "n_windows": len(part),
        "n_sessions": len(y),
        "n_genuine": int(pos.sum()),
        "n_impostor": int(neg.sum()),
        "accuracy": accuracy,
        "precision": float(precision_score(y, pred, zero_division=0)),
        "recall": float(recall_score(y, pred, zero_division=0)),
        "f1": float(f1_score(y, pred, zero_division=0)),
        "auc": float(roc_auc_score(y, scores)) if neg.any() and pos.any() else None,
        "far": float(pred[neg].mean()) if neg.any() else None,
        "frr": float((1 - pred[pos]).mean()) if pos.any() else None,
        "session_accuracy": accuracy,
    }


def _sigmoid(z: np.ndarray) -> np.ndarray:
    z = np.asarray(z, dtype=float)
    out = np.empty_like(z)
    pos = z >= 0
    out[pos] = 1.0 / (1.0 + np.exp(-z[pos]))
    ez = np.exp(z[~pos])
    out[~pos] = ez / (1.0 + ez)
    return out


def predict_proba(windows: pd.DataFrame, model: dict) -> np.ndarray:
    x = windows[model["feature_names"]].to_numpy(dtype=float)
    mean = np.asarray(model["scaler"]["mean"], dtype=float)
    scale = np.asarray(model["scaler"]["scale"], dtype=float)
    scale = np.where(scale == 0, 1.0, scale)
    xs = (x - mean) / scale
    z = np.sum(xs * np.asarray(model["coef"], dtype=float), axis=1) + float(model["intercept"])
    return _sigmoid(z)


def evaluate(windows: pd.DataFrame, model: dict) -> dict:
    windows = _labeled(windows)
    if model.get("training_data_sha256") not in (None, _dataset_hash(windows)):
        raise ValueError("As sessões ou os grupos mudaram. Treine o modelo antes de avaliar.")
    return {fold: session_metrics(windows, model, fold) for fold in ("train", "validation", "test")}


def validate_model(model: dict) -> None:
    def finite(value):
        return type(value) in (int, float) and np.isfinite(value)

    names = model.get("feature_names")
    scaler = model.get("scaler")
    if not isinstance(names, list) or names != config.FEATURE_NAMES or not isinstance(scaler, dict):
        raise ValueError("Modelo IMU com features ou scaler incompatíveis.")
    for vector in (model.get("coef"), scaler.get("mean"), scaler.get("scale")):
        if (
            not isinstance(vector, list)
            or len(vector) != len(names)
            or not all(map(finite, vector))
        ):
            raise ValueError("Vetor do modelo IMU inválido.")
    if (
        model.get("type") != "logistic_regression"
        or not str(model.get("version")).startswith("1.")
        or model.get("label_positive") != config.LABEL_POSITIVE
        or not all(scale > 0 for scale in scaler["scale"])
        or not finite(model.get("intercept"))
        or not finite(model.get("threshold"))
        or not 0 <= model["threshold"] <= 1
        or type(model.get("window_ms")) is not int
        or not 0 < model["window_ms"] <= 60_000
        or not finite(model.get("sample_rate_hz"))
        or not 0 < model["sample_rate_hz"] <= 1000
        or not finite(model.get("overlap"))
        or not 0 <= model["overlap"] < 1
    ):
        raise ValueError("Parâmetros do modelo IMU inválidos.")


def write_json(path: Path, payload: dict) -> None:
    serialized = json.dumps(payload, indent=2, allow_nan=False) + "\n"
    path.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, delete=False) as tmp:
        name = Path(tmp.name)
    try:
        name.write_text(serialized, encoding="utf-8")
        os.replace(name, path)
    finally:
        name.unlink(missing_ok=True)
