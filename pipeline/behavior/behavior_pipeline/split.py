from __future__ import annotations

from collections.abc import Sequence

import numpy as np
import pandas as pd


def session_level_split(
    session_ids: Sequence[str],
    labels: Sequence[str],
    *,
    seed: int = 42,
    test_ratio: float = 0.2,
    val_ratio: float = 0.2,
) -> dict[str, set[str]]:
    """Atribui cada session_id a um único fold. Stratifica por label."""
    rng = np.random.default_rng(seed)
    by_label: dict[str, list[str]] = {}
    for sid, lab in zip(session_ids, labels):
        by_label.setdefault(lab, []).append(sid)

    train: set[str] = set()
    val: set[str] = set()
    test: set[str] = set()
    for lab, ids in by_label.items():
        uniq = list(dict.fromkeys(ids))
        rng.shuffle(uniq)
        n = len(uniq)
        n_test = max(1, int(round(n * test_ratio))) if n >= 5 else (1 if n >= 3 else 0)
        n_val = max(1, int(round(n * val_ratio))) if n >= 5 else (1 if n >= 3 else 0)
        if n_test + n_val >= n:
            n_test = min(1, n - 2) if n >= 3 else 0
            n_val = min(1, n - n_test - 1) if n >= 3 else 0
        test.update(uniq[:n_test])
        val.update(uniq[n_test : n_test + n_val])
        train.update(uniq[n_test + n_val :])
        if not train and uniq:
            moved = uniq[-1]
            test.discard(moved)
            val.discard(moved)
            train.add(moved)

    overlap = (train & val) | (train & test) | (val & test)
    if overlap:
        raise RuntimeError(f"Leakage de session_id no split: {sorted(overlap)}")
    return {"train": train, "validation": val, "test": test}


def assert_no_session_leakage(windows: pd.DataFrame, folds: dict[str, set[str]]) -> None:
    for a, b in (("train", "validation"), ("train", "test"), ("validation", "test")):
        left = set(windows.loc[windows["fold"] == a, "session_id"])
        right = set(windows.loc[windows["fold"] == b, "session_id"])
        leak = left & right
        if leak:
            raise AssertionError(f"Leakage {a}/{b}: {sorted(leak)}")


def subject_level_split(windows: pd.DataFrame, seed: int = 42) -> dict[str, set[str]]:
    """Keep each subject intact and require both classes in every fold."""
    by_subject = windows.groupby("subject_id")["label"].agg(set)
    subjects = sorted(by_subject.index)
    labels = set(windows["label"])
    if len(subjects) < 3 or len(labels) != 2:
        raise ValueError("A avaliação por participante requer três ou mais pessoas e dois rótulos.")
    rng = np.random.default_rng(seed)
    shuffled = rng.permutation(subjects).tolist()
    mixed = [subject for subject in shuffled if by_subject[subject] == labels]
    positive = [subject for subject in shuffled if by_subject[subject] == {"genuine"}]
    negative = [subject for subject in shuffled if by_subject[subject] == {"impostor"}]
    folds: dict[str, set[str]] = {}
    for name in ("test", "validation", "train"):
        if mixed:
            folds[name] = {mixed.pop()}
        elif positive and negative:
            folds[name] = {positive.pop(), negative.pop()}
        else:
            raise ValueError("Sem participantes suficientes com ambas as classes em cada grupo.")

    remaining = [
        subject for subject in shuffled if all(subject not in fold for fold in folds.values())
    ]
    target = max(round(len(subjects) * 0.2), 1)
    for name in ("test", "validation"):
        size = max(0, target - len(folds[name]))
        folds[name].update(remaining[:size])
        remaining = remaining[size:]
    folds["train"].update(remaining)
    return folds
