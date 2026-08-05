from __future__ import annotations

import json
from pathlib import Path

from scripts.check_coverage_thresholds import main


def _write_coverage_json(path: Path, payload: dict[str, object]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def test_coverage_thresholds_accepts_expected_overall_and_area_coverage(tmp_path: Path) -> None:
    coverage_path = tmp_path / "coverage.json"
    _write_coverage_json(
        coverage_path,
        {
            "totals": {"percent_covered": 91.2},
            "files": {
                "apps/backend/src/silo/auth/oauth.py": {
                    "summary": {"covered_lines": 95, "num_statements": 100}
                },
                "apps/backend/src/silo/api/dependencies.py": {
                    "summary": {"covered_lines": 98, "num_statements": 100}
                },
                "apps/backend/src/silo/worker/processor.py": {
                    "summary": {"covered_lines": 96, "num_statements": 100}
                },
                "apps/backend/src/silo/storage/uploads.py": {
                    "summary": {"covered_lines": 99, "num_statements": 100}
                },
            },
        },
    )

    assert main([str(coverage_path)]) == 0


def test_coverage_thresholds_rejects_low_coverage_and_missing_files(tmp_path: Path) -> None:
    coverage_path = tmp_path / "coverage.json"
    _write_coverage_json(
        coverage_path,
        {
            "totals": {"percent_covered": 87.5},
            "files": {
                "apps/backend/src/silo/auth/oauth.py": {
                    "summary": {"covered_lines": 80, "num_statements": 100}
                },
                "apps/backend/src/silo/api/dependencies.py": {
                    "summary": {"covered_lines": 92, "num_statements": 100}
                },
            },
        },
    )

    assert main([str(coverage_path)]) == 1
