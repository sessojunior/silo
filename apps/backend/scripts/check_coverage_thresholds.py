from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True, slots=True)
class CoverageArea:
    name: str
    patterns: tuple[str, ...]
    minimum_percent: float


DEFAULT_AREAS: tuple[CoverageArea, ...] = (
    CoverageArea(
        name="auth",
        patterns=("src/silo/auth/", "src/silo/api/routers/auth.py"),
        minimum_percent=95.0,
    ),
    CoverageArea(
        name="permissions",
        patterns=("src/silo/api/dependencies.py",),
        minimum_percent=95.0,
    ),
    CoverageArea(
        name="worker-processor",
        patterns=("src/silo/worker/processor.py",),
        minimum_percent=95.0,
    ),
    CoverageArea(
        name="uploads",
        patterns=(
            "src/silo/storage/uploads.py",
            "src/silo/api/upload_io.py",
            "src/silo/api/routers/upload.py",
        ),
        minimum_percent=95.0,
    ),
)


def _normalize_path(path_value: str) -> str:
    return Path(path_value).as_posix().lower()


def _summary_percent(summary: dict[str, object]) -> float:
    if "percent_covered" in summary:
        try:
            return float(summary["percent_covered"])
        except (TypeError, ValueError):
            pass

    covered_lines = float(summary.get("covered_lines", 0) or 0)
    num_statements = float(summary.get("num_statements", 0) or 0)
    if num_statements == 0:
        return 100.0 if covered_lines == 0 else 0.0
    return (covered_lines / num_statements) * 100.0


def _collect_area_coverage(
    files: dict[str, dict[str, object]],
    area: CoverageArea,
) -> tuple[float, list[str]]:
    covered_lines = 0.0
    total_statements = 0.0
    matched_files: list[str] = []

    for filename, payload in files.items():
        normalized = _normalize_path(filename)
        if not any(pattern in normalized for pattern in area.patterns):
            continue

        summary = payload.get("summary")
        if not isinstance(summary, dict):
            continue

        matched_files.append(filename)
        covered_lines += float(summary.get("covered_lines", 0) or 0)
        total_statements += float(summary.get("num_statements", 0) or 0)

    percent = 100.0 if total_statements == 0 else (covered_lines / total_statements) * 100.0
    return percent, matched_files


def _format_percent(value: float) -> str:
    return f"{value:.2f}%"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Valida thresholds de cobertura do backend.")
    parser.add_argument(
        "coverage_json",
        nargs="?",
        default="coverage.json",
        help="Arquivo JSON gerado pelo pytest-cov.",
    )
    parser.add_argument(
        "--overall-minimum",
        type=float,
        default=90.0,
        help="Cobertura total minima exigida.",
    )
    args = parser.parse_args(sys.argv[1:] if argv is None else argv)

    coverage_path = Path(args.coverage_json)
    if not coverage_path.exists():
        print(f"coverage check: arquivo inexistente: {coverage_path}", file=sys.stderr)
        return 1

    payload = json.loads(coverage_path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        print("coverage check: JSON invalido", file=sys.stderr)
        return 1

    files = payload.get("files")
    if not isinstance(files, dict):
        print("coverage check: chave 'files' ausente no JSON", file=sys.stderr)
        return 1

    totals = payload.get("totals")
    overall_percent = _summary_percent(totals) if isinstance(totals, dict) else 0.0

    failures: list[str] = []
    if overall_percent < args.overall_minimum:
        failures.append(
            f"overall {_format_percent(overall_percent)} < {_format_percent(args.overall_minimum)}"
        )

    for area in DEFAULT_AREAS:
        area_percent, matched_files = _collect_area_coverage(files, area)
        if not matched_files:
            failures.append(f"{area.name}: nenhum arquivo encontrado")
            continue

        if area_percent < area.minimum_percent:
            area_threshold = _format_percent(area.minimum_percent)
            failures.append(
                f"{area.name} {_format_percent(area_percent)} < {area_threshold}"
            )

    if failures:
        print("coverage check: falhou", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        return 1

    print(
        "coverage check: ok "
        f"(overall {_format_percent(overall_percent)}, "
        + ", ".join(
            f"{area.name} {_format_percent(_collect_area_coverage(files, area)[0])}"
            for area in DEFAULT_AREAS
        )
        + ")"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
