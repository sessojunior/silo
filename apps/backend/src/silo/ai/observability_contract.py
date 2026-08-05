from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

OBSERVABILITY_METRICS: tuple[str, ...] = (
    "ai_graph_runs_total",
    "ai_graph_duration_seconds",
    "ai_graph_mode_total",
    "ai_graph_fallback_total",
    "ai_graph_error_total",
    "ai_graph_cache_hit_total",
    "ai_graph_tool_calls_total",
    "ai_graph_tool_denials_total",
    "ai_graph_tool_timeouts_total",
    "ai_graph_recursion_guard_total",
    "ai_graph_sse_disconnect_total",
    "ai_graph_dataset_status_total",
    "ai_graph_artifact_status_total",
    "ai_graph_model_calls_total",
)

OBSERVABILITY_SAFE_LABELS: tuple[str, ...] = (
    "mode",
    "scope",
    "status",
    "source_kind",
    "reason",
    "result_kind",
)

OBSERVABILITY_ALERT_RULES: tuple[dict[str, Any], ...] = (
    {
        "alert": "SiloAiGraphFallbackDominant",
        "expr": (
            "sum(rate(ai_graph_fallback_total[5m])) "
            "/ clamp_min(sum(rate(ai_graph_runs_total[5m])), 1) > 0.5"
        ),
        "for": "10m",
        "labels": {"severity": "warning", "service": "silo-api"},
        "annotations": {
            "summary": "Fallback do agente passou a dominar o fluxo.",
            "description": "Verifique Ollama, prompts e regressões do planner.",
        },
    },
    {
        "alert": "SiloAiGraphRecursionGuardSpike",
        "expr": "sum(rate(ai_graph_recursion_guard_total[5m])) > 0",
        "for": "10m",
        "labels": {"severity": "warning", "service": "silo-api"},
        "annotations": {
            "summary": "O graph passou a bater no limite de recursão.",
            "description": "Analise loops, tool confusion e respostas sem saída.",
        },
    },
    {
        "alert": "SiloAiGraphSseDisconnectSpike",
        "expr": "sum(rate(ai_graph_sse_disconnect_total[5m])) > 0",
        "for": "10m",
        "labels": {"severity": "warning", "service": "silo-api"},
        "annotations": {
            "summary": "Disconnects SSE acima do esperado.",
            "description": "Verifique streaming, timeouts e quedas de rede.",
        },
    },
    {
        "alert": "SiloAiGraphToolDenialSpike",
        "expr": "sum(rate(ai_graph_tool_denials_total[5m])) > 0",
        "for": "10m",
        "labels": {"severity": "warning", "service": "silo-api"},
        "annotations": {
            "summary": "Planner tentando usar tools proibidas.",
            "description": "Revise prompt injection, tool confusion e permissões.",
        },
    },
    {
        "alert": "SiloAiGraphArtifactFailureSpike",
        "expr": "sum(rate(ai_graph_artifact_status_total{status=~\"error|failed\"}[5m])) > 0",
        "for": "10m",
        "labels": {"severity": "critical", "service": "silo-api"},
        "annotations": {
            "summary": "Falhas recorrentes na geração de artefatos.",
            "description": "Cheque PDF, Mermaid, imagens e inconsistências persistidas.",
        },
    },
)


def build_dashboard_contract() -> dict[str, Any]:
    return {
        "title": "SILO AI Agent Observability",
        "description": "Painel local para acompanhar runs, fallback, erros e artefatos do agente.",
        "safeLabels": list(OBSERVABILITY_SAFE_LABELS),
        "redactionPolicy": {
            "forbidden": [
                "question",
                "user_id",
                "thread_id",
                "dataset_id",
                "prompt",
                "reasoning",
                "toolArgs",
                "toolResults",
            ]
        },
        "metrics": [
            {
                "name": metric,
                "description": _metric_description(metric),
            }
            for metric in OBSERVABILITY_METRICS
        ],
        "panels": [
            {
                "title": "Execução e fallback",
                "queries": [
                    "sum(rate(ai_graph_runs_total[5m])) by (mode, scope)",
                    "sum(rate(ai_graph_fallback_total[5m])) by (mode, scope)",
                    "sum(rate(ai_graph_error_total[5m])) by (scope, status)",
                ],
            },
            {
                "title": "Latência e cache",
                "queries": [
                    "histogram_quantile(0.95, sum(rate(ai_graph_duration_seconds_bucket[5m])) by (le, mode, scope))",
                    "sum(rate(ai_graph_cache_hit_total[5m])) by (mode, scope)",
                ],
            },
            {
                "title": "Tools e proteções",
                "queries": [
                    "sum(rate(ai_graph_tool_calls_total[5m])) by (scope, source_kind, result_kind)",
                    "sum(rate(ai_graph_tool_denials_total[5m])) by (reason, scope)",
                    "sum(rate(ai_graph_tool_timeouts_total[5m])) by (scope, reason)",
                    "sum(rate(ai_graph_recursion_guard_total[5m])) by (scope, reason)",
                    "sum(rate(ai_graph_sse_disconnect_total[5m])) by (scope, reason)",
                ],
            },
            {
                "title": "Artefatos e modelos",
                "queries": [
                    "sum(rate(ai_graph_dataset_status_total[5m])) by (status, source_kind)",
                    "sum(rate(ai_graph_artifact_status_total[5m])) by (status, result_kind)",
                    "sum(rate(ai_graph_model_calls_total[5m])) by (mode, scope, status)",
                ],
            },
        ],
    }


def build_alert_rules() -> dict[str, Any]:
    return {
        "groups": [
            {
                "name": "silo-ai-agent",
                "rules": [dict(rule) for rule in OBSERVABILITY_ALERT_RULES],
            }
        ]
    }


def write_observability_contract(output_dir: Path) -> dict[str, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    dashboard_path = output_dir / "ai-observability-dashboard.json"
    alerts_path = output_dir / "ai-observability-alerts.json"

    dashboard_path.write_text(
        json.dumps(build_dashboard_contract(), ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    alerts_path.write_text(
        json.dumps(build_alert_rules(), ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )

    return {"dashboard": dashboard_path, "alerts": alerts_path}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Gera o contrato local de observabilidade da IA.")
    parser.add_argument(
        "--output-dir",
        default=str(Path.cwd() / "artifacts" / "observability"),
        help="Diretório de destino para os artefatos gerados.",
    )
    args = parser.parse_args(argv)

    output_dir = Path(args.output_dir)
    paths = write_observability_contract(output_dir)
    print(paths["dashboard"].as_posix())
    print(paths["alerts"].as_posix())
    return 0


def _metric_description(metric: str) -> str:
    descriptions = {
        "ai_graph_runs_total": "Total de execuções do graph de IA.",
        "ai_graph_duration_seconds": "Duração das execuções do graph em segundos.",
        "ai_graph_mode_total": "Execuções por modo determinístico ou hybrid.",
        "ai_graph_fallback_total": "Quantas execuções caíram para fallback.",
        "ai_graph_error_total": "Erros observados durante a execução do graph.",
        "ai_graph_cache_hit_total": "Hits do cache semântico ou de artefato.",
        "ai_graph_tool_calls_total": "Chamadas de tools executadas pelo planner.",
        "ai_graph_tool_denials_total": "Chamadas negadas por política ou segurança.",
        "ai_graph_tool_timeouts_total": "Chamadas de tools que expiraram.",
        "ai_graph_recursion_guard_total": "Acionamentos do guard de recursão.",
        "ai_graph_sse_disconnect_total": "Desconexões no stream SSE.",
        "ai_graph_dataset_status_total": "Status dos datasets observados.",
        "ai_graph_artifact_status_total": "Status dos artefatos produzidos.",
        "ai_graph_model_calls_total": "Chamadas de modelo por modo e escopo.",
    }
    return descriptions.get(metric, "Métrica do agente de IA.")


if __name__ == "__main__":
    raise SystemExit(main())
