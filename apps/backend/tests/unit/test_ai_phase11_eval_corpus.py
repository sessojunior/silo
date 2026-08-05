from __future__ import annotations

import json
from pathlib import Path

from silo.ai import assistant_service


CORPUS_PATH = Path(__file__).resolve().parents[1] / "fixtures" / "ai" / "eval-cases.jsonl"


_PHASE_TO_RESULT_KEY = {
    "list_model_runs": "modelRuns",
    "summarize_model_runs": "modelSummary",
    "compare_model_run_periods": "modelComparison",
    "get_model_run_history": "modelHistory",
    "list_model_interventions": "modelInterventions",
    "get_projects_snapshot": "projectsSnapshot",
    "get_projects_report_data": "projectsReport",
    "list_registered_problems": "problemsList",
    "summarize_problems": "problemSummary",
    "compare_problem_periods": "problemComparison",
    "list_problematic_runs": "problematicRuns",
    "get_executive_report_data": "executiveReport",
    "get_availability_report_data": "availabilityReport",
    "get_problems_report_data": "problemsReport",
    "search_silo_knowledge": "knowledgeSearch",
}


def _read_corpus() -> list[dict[str, object]]:
    return [json.loads(line) for line in CORPUS_PATH.read_text(encoding="utf-8").splitlines() if line.strip()]


def _state_from_case(case: dict[str, object]) -> dict[str, object]:
    expected_plan = [str(item) for item in case["expectedPlan"]]  # type: ignore[index]
    required_results: dict[str, object] = {}
    entities: dict[str, object] = {}

    for phase in expected_plan:
        result_key = _PHASE_TO_RESULT_KEY.get(phase)
        if result_key:
            required_results[result_key] = {"phase": phase}

    if "resolve_models" in expected_plan:
        entities["models"] = {"matches": [{"id": "model-1"}]}
    if "resolve_projects" in expected_plan:
        entities["projects"] = {"matches": [{"id": "project-1"}]}
    if "resolve_problem_categories" in expected_plan:
        entities["problemCategories"] = {"matches": [{"id": "problem-category-1"}]}

    artifact = case["expectedArtifact"]  # type: ignore[index]
    artifact_kind = str(artifact.get("kind") or "none") if isinstance(artifact, dict) else "none"
    artifact_intent = {"kind": artifact_kind}
    if isinstance(artifact, dict) and artifact_kind == "pdf":
        artifact_intent["reportType"] = artifact.get("reportType") or case["scope"]

    state: dict[str, object] = {
        "scope": case["scope"],
        "artifact_intent": artifact_intent,
        "required_results": required_results,
        "supplemental_results": {},
        "entities": entities,
    }
    if case["isInScopeExpected"] is False:
        state["refusal_reason"] = "fora de escopo"
    return state


def test_corpus_expected_plan_matches_canonical_trajectory() -> None:
    cases = _read_corpus()
    assert len(cases) == 210

    for case in cases:
        state = _state_from_case(case)
        trajectory = assistant_service._canonical_trajectory(state)  # noqa: SLF001
        expected_plan = [str(item) for item in case["expectedPlan"]]  # type: ignore[index]
        assert trajectory == expected_plan, f"case={case['id']}"
