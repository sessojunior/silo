from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

# Fonte única de semântica para dashboard/relatórios/monitoramento durante a migração.
# Mantém os valores centrais do frontend/engine e explicita o que conta como execução,
# sucesso e incidente.
MODEL_RUN_STATUSES: tuple[str, ...] = (
    "completed",
    "with_problems",
    "run_again",
    "not_run",
    "under_support",
    "suspended",
    "in_progress",
    "pending",
    "off",
)

SUCCESS_STATUSES = frozenset(("completed",))
PROBLEM_STATUSES = frozenset(("with_problems", "run_again", "not_run", "under_support", "suspended"))
EXECUTION_STATUSES = frozenset(("completed", "with_problems", "run_again", "in_progress"))
NON_EXECUTION_STATUSES = frozenset(("pending",))
TERMINAL_STATUSES = frozenset(
    ("completed", "with_problems", "run_again", "not_run", "under_support", "suspended", "off")
)
AVAILABILITY_DENOMINATOR_STATUSES = frozenset(
    ("completed", "with_problems", "run_again", "not_run", "under_support", "suspended")
)
AVAILABLE_STATUSES = frozenset(("completed",))


@dataclass(frozen=True, slots=True)
class ModelRunStatusSemantics:
    status: str
    is_problematic: bool
    is_execution: bool
    is_success: bool
    is_pending: bool
    is_terminal: bool
    is_available: bool
    counts_for_availability_denominator: bool


def normalize_model_run_status(value: object | None) -> str:
    text = value if isinstance(value, str) else None
    if text is None:
        return "pending"
    normalized = text.strip().lower()
    return normalized if normalized in MODEL_RUN_STATUSES else "pending"


def classify_model_run_status(value: object | None) -> ModelRunStatusSemantics:
    status = normalize_model_run_status(value)
    return ModelRunStatusSemantics(
        status=status,
        is_problematic=status in PROBLEM_STATUSES,
        is_execution=status in EXECUTION_STATUSES,
        is_success=status in SUCCESS_STATUSES,
        is_pending=status in NON_EXECUTION_STATUSES,
        is_terminal=status in TERMINAL_STATUSES,
        is_available=status in AVAILABLE_STATUSES,
        counts_for_availability_denominator=status in AVAILABILITY_DENOMINATOR_STATUSES,
    )


def is_problematic_run_status(value: object | None) -> bool:
    return normalize_model_run_status(value) in PROBLEM_STATUSES


def is_execution_status(value: object | None) -> bool:
    return normalize_model_run_status(value) in EXECUTION_STATUSES


def is_success_status(value: object | None) -> bool:
    return normalize_model_run_status(value) in SUCCESS_STATUSES


@lru_cache(maxsize=1)
def validate_model_run_status_semantics_contract() -> None:
    """Fail fast when the canonical semantics file drifts from Python."""

    matrix_path = _find_model_run_status_semantics_path()
    matrix = matrix_path.read_text(encoding="utf-8")
    parsed = _parse_model_run_status_semantics_yaml(matrix)

    expected_statuses = set(MODEL_RUN_STATUSES)
    actual_statuses = set(parsed["statuses"].keys())
    if expected_statuses != actual_statuses:
        raise RuntimeError(
            "Status semantics YAML divergiu do enum Python: "
            f"python={sorted(expected_statuses)} yaml={sorted(actual_statuses)}"
        )

    expected_sets: dict[str, set[str]] = {
        "incidentStatuses": set(PROBLEM_STATUSES),
        "executedStatuses": set(EXECUTION_STATUSES),
        "terminalStatuses": set(TERMINAL_STATUSES),
        "availabilityDenominatorStatuses": set(AVAILABILITY_DENOMINATOR_STATUSES),
        "availabilityNumeratorStatuses": set(AVAILABLE_STATUSES),
    }
    for set_name, expected_values in expected_sets.items():
        actual_values = set(parsed["derived_sets"].get(set_name, []))
        if expected_values != actual_values:
            raise RuntimeError(
                f"Status semantics YAML divergiu de {set_name}: "
                f"python={sorted(expected_values)} yaml={sorted(actual_values)}"
            )

    for status in expected_statuses:
        yaml_flags = parsed["statuses"][status]
        semantics = classify_model_run_status(status)
        expected_flags = {
            "didExecute": semantics.is_execution,
            "isIncident": semantics.is_problematic,
            "isTerminal": semantics.is_terminal,
            "isAvailable": semantics.is_available,
            "countsForAvailabilityDenominator": semantics.counts_for_availability_denominator,
        }
        if yaml_flags != expected_flags:
            raise RuntimeError(
                f"Status semantics YAML divergiu para {status}: "
                f"python={expected_flags} yaml={yaml_flags}"
            )


def _find_model_run_status_semantics_path() -> Path:
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "docs" / "migration" / "ai" / "model-run-status-semantics.yaml"
        if candidate.exists():
            return candidate
    raise FileNotFoundError("Não foi possível localizar docs/migration/ai/model-run-status-semantics.yaml")


def _parse_model_run_status_semantics_yaml(text: str) -> dict[str, Any]:
    statuses: dict[str, dict[str, bool]] = {}
    derived_sets: dict[str, list[str]] = {}
    section: str | None = None
    status_name: str | None = None
    derived_name: str | None = None

    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        indent = len(line) - len(line.lstrip(" "))

        if indent == 0 and stripped.endswith(":"):
            section = stripped[:-1]
            status_name = None
            derived_name = None
            continue

        if section == "statuses":
            if indent == 2 and stripped.endswith(":"):
                status_name = stripped[:-1]
                statuses[status_name] = {}
                continue
            if indent >= 4 and status_name is not None and ":" in stripped:
                key, value = stripped.split(":", maxsplit=1)
                key = key.strip()
                if key in {
                    "didExecute",
                    "isIncident",
                    "isTerminal",
                    "isAvailable",
                    "countsForAvailabilityDenominator",
                }:
                    statuses[status_name][key] = value.strip().lower() == "true"
                continue

        if section == "derivedSets":
            if indent == 2 and stripped.endswith(":"):
                derived_name = stripped[:-1]
                derived_sets[derived_name] = []
                continue
            if indent >= 4 and derived_name is not None and stripped.startswith("- "):
                derived_sets[derived_name].append(stripped[2:].strip().strip('"'))
                continue

    return {"statuses": statuses, "derived_sets": derived_sets}
