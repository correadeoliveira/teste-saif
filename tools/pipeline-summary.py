"""Render safe aggregate diagnostics to the GitHub Actions job summary."""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read_json(path: Path) -> dict:
    if not path.is_file():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def percent(value) -> str:
    return "—" if value is None else f"{value:.1%}"


def heatmap(log: Path) -> None:
    print("## Heatmap SSP-SP")
    if not log.is_file():
        print("\nA execução terminou antes de iniciar o pipeline.")
        return

    events = [
        json.loads(line)
        for line in log.read_text().splitlines()
        if line.startswith("{")
    ]
    counts = Counter(entry["event"] for entry in events)
    status = "Falhou durante a execução"
    if counts["update.skip"]:
        status = "Inventário conferido, artefatos reutilizados"
    elif counts["update.ok"]:
        status = "Artefatos gerados, validados e publicados no checkout do CI"
    print(f"\n{status}.")
    source = next((entry for entry in events if entry["event"] == "ingest.ok"), None)
    if source:
        print(f"\n- Ocorrências na fonte: {source['n_rows']:,}")
        print(f"- Coordenadas vazias: {source['geo_missing']:,}")
        print(f"- Coordenadas zeradas: {source['geo_zero']:,}")

    pre = next(
        (entry for entry in events if entry["event"] == "preprocess.clean"), None
    )
    if pre:
        print(f"- Ocorrências após limpeza: {pre['rows_out']:,}")
        print(
            f"- Razões de descarte: `{json.dumps(pre['drop_reasons'], sort_keys=True)}`"
        )
        print(f"- Fatias omitidas: {counts['heatmap.slice_skip']}")
        for entry in events:
            if entry["event"] == "heatmap.slice_skip":
                print(
                    f"  - {entry['crime_type']} / {entry['period']}"
                    f" ({entry['count']} pontos)"
                )
    evaluation = next(
        (entry["metrics"] for entry in events if entry["event"] == "evaluate.ok"), None
    )
    if evaluation:
        hit_rate = percent(evaluation["hit_rate_at_10pct"])
        print(f"- Hit Rate@10% no teste temporal: {hit_rate}")
        print(f"- MAE no teste temporal: {evaluation['mae']:.3f}")
    elif counts["evaluate.skip"]:
        print("- Avaliação temporal indisponível para o recorte.")
    print()


def behavior() -> None:
    metrics = read_json(ROOT / "shared/behavior/metrics.json")
    print("## IMU demonstrativo")
    print("\nMétricas por sessão sintética.\n")
    print("| Grupo | Sessões | Acurácia | Falsos aceites | Falsas rejeições |")
    print("|---|---:|---:|---:|---:|")
    for name in ("train", "validation", "test"):
        row = metrics.get(name, {})
        n = row.get("n_sessions", 0)
        print(
            f"| {name} | {n} | {percent(row.get('accuracy'))} | "
            f"{percent(row.get('far'))} | {percent(row.get('frr'))} |"
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("behavior")
    commands.add_parser("heatmap").add_argument("log", type=Path)
    args = parser.parse_args()
    if args.command == "heatmap":
        heatmap(args.log)
    else:
        behavior()
