from __future__ import annotations

import json
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
    roc_curve,
)
from sklearn.preprocessing import StandardScaler

from behavior_pipeline import config


def _xy(df: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    y = (df["label"] == config.LABEL_POSITIVE).astype(int).to_numpy()
    x = df[config.FEATURE_NAMES].to_numpy(dtype=float)
    return x, y


def _youden_threshold(y_true: np.ndarray, scores: np.ndarray) -> float:
    if len(np.unique(y_true)) < 2:
        return 0.5
    fpr, tpr, thr = roc_curve(y_true, scores)
    i = int(np.argmax(tpr - fpr))
    return float(thr[i])


def train_from_windows(windows: pd.DataFrame) -> dict:
    labels = set(windows["label"].unique())
    if config.LABEL_POSITIVE not in labels or config.LABEL_NEGATIVE not in labels:
        raise ValueError(
            f"LR binária precisa de labels '{config.LABEL_POSITIVE}' e "
            f"'{config.LABEL_NEGATIVE}'. Encontrado: {sorted(labels)}"
        )
    train = windows[windows["fold"] == "train"]
    val = windows[windows["fold"] == "validation"]
    if train.empty:
        raise ValueError("Fold train vazio.")
    x_train, y_train = _xy(train)
    scaler = StandardScaler()
    x_train_s = scaler.fit_transform(x_train)
    clf = LogisticRegression(max_iter=2000, solver="lbfgs", C=0.5)
    clf.fit(x_train_s, y_train)
    threshold = 0.5
    if not val.empty and len(np.unique(_xy(val)[1])) > 1:
        scores = clf.predict_proba(scaler.transform(_xy(val)[0]))[:, 1]
        threshold = _youden_threshold(_xy(val)[1], scores)
    model = {
        "version": "1.0.0",
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
    scores = predict_proba(part, model)
    y = (part["label"] == config.LABEL_POSITIVE).astype(int).to_numpy()
    pred = (scores >= model["threshold"]).astype(int)
    out = {
        "fold": fold,
        "n_windows": int(len(part)),
        "n_sessions": int(part["session_id"].nunique()),
        "accuracy": float(accuracy_score(y, pred)),
        "precision": float(precision_score(y, pred, zero_division=0)),
        "recall": float(recall_score(y, pred, zero_division=0)),
        "f1": float(f1_score(y, pred, zero_division=0)),
    }
    if len(np.unique(y)) > 1:
        out["auc"] = float(roc_auc_score(y, scores))
        fp = int(((pred == 1) & (y == 0)).sum())
        tn = int(((pred == 0) & (y == 0)).sum())
        fn = int(((pred == 0) & (y == 1)).sum())
        tp = int(((pred == 1) & (y == 1)).sum())
        out["far"] = float(fp / (fp + tn)) if (fp + tn) else 0.0
        out["frr"] = float(fn / (fn + tp)) if (fn + tp) else 0.0
    # session-level: median score per session
    part = part.copy()
    part["score"] = scores
    sess = part.groupby("session_id").agg(
        label=("label", "first"),
        score=("score", "median"),
    )
    sess_y = (sess["label"] == config.LABEL_POSITIVE).astype(int).to_numpy()
    sess_p = (sess["score"] >= model["threshold"]).astype(int).to_numpy()
    out["session_accuracy"] = float(accuracy_score(sess_y, sess_p))
    return out


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
    z = xs @ np.asarray(model["coef"], dtype=float) + float(model["intercept"])
    return _sigmoid(z)


def evaluate(windows: pd.DataFrame, model: dict) -> dict:
    return {
        fold: session_metrics(windows, model, fold)
        for fold in ("train", "validation", "test")
    }


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2))
