from __future__ import annotations

from pathlib import Path

from silo.ai.observability_contract import (
    OBSERVABILITY_METRICS,
    OBSERVABILITY_SAFE_LABELS,
    build_alert_rules,
    build_dashboard_contract,
    main,
    write_observability_contract,
)


def test_observability_dashboard_uses_safe_labels_and_known_metrics() -> None:
    dashboard = build_dashboard_contract()

    assert dashboard["safeLabels"] == list(OBSERVABILITY_SAFE_LABELS)
    assert [metric["name"] for metric in dashboard["metrics"]] == list(OBSERVABILITY_METRICS)

    panel_queries = [query for panel in dashboard["panels"] for query in panel["queries"]]
    for forbidden in ("question", "user_id", "thread_id", "dataset_id", "prompt", "reasoning", "toolArgs", "toolResults"):
        assert all(forbidden not in query for query in panel_queries)


def test_observability_alert_rules_cover_expected_failures() -> None:
    alert_rules = build_alert_rules()

    rules = alert_rules["groups"][0]["rules"]
    assert {rule["alert"] for rule in rules} == {
        "SiloAiGraphFallbackDominant",
        "SiloAiGraphRecursionGuardSpike",
        "SiloAiGraphSseDisconnectSpike",
        "SiloAiGraphToolDenialSpike",
        "SiloAiGraphArtifactFailureSpike",
    }

    for rule in rules:
        assert isinstance(rule["expr"], str)
        assert "user_id" not in rule["expr"]
        assert "thread_id" not in rule["expr"]
        assert "dataset_id" not in rule["expr"]
        assert "prompt" not in rule["expr"]
        assert "reasoning" not in rule["expr"]


def test_observability_contract_main_writes_dashboard_and_alerts(tmp_path: Path) -> None:
    assert main(["--output-dir", str(tmp_path)]) == 0

    dashboard_path = tmp_path / "ai-observability-dashboard.json"
    alerts_path = tmp_path / "ai-observability-alerts.json"

    assert dashboard_path.exists()
    assert alerts_path.exists()
    assert "ai_graph_runs_total" in dashboard_path.read_text(encoding="utf-8")
    assert "SiloAiGraphFallbackDominant" in alerts_path.read_text(encoding="utf-8")


def test_write_observability_contract_uses_expected_filenames(tmp_path: Path) -> None:
    paths = write_observability_contract(tmp_path)

    assert paths["dashboard"].name == "ai-observability-dashboard.json"
    assert paths["alerts"].name == "ai-observability-alerts.json"
