from __future__ import annotations

import argparse
import json
import re
from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import Path
from threading import Lock
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
    "ai_graph_abstention_total",
    "ai_graph_model_duration_seconds",
    "ai_graph_retrieval_duration_seconds",
)

OBSERVABILITY_SAFE_LABELS: tuple[str, ...] = (
    "mode",
    "scope",
    "status",
    "source_kind",
    "reason",
    "result_kind",
)

_SAFE_LABEL_VALUE = re.compile(r"^[a-zA-Z0-9_.:-]{1,64}$")
_HISTOGRAM_BUCKETS = (0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60)
DEFAULT_MAX_METRIC_SERIES = 128
_CARDINALITY_OVERFLOW_LABELS = (("reason", "cardinality_limit"),)


@dataclass(slots=True)
class _HistogramState:
    count: int = 0
    total: float = 0.0
    last: float = 0.0
    buckets: dict[float, int] = field(
        default_factory=lambda: {bound: 0 for bound in _HISTOGRAM_BUCKETS}
    )


class RuntimeMetricStore:
    """Small process-local metric store for installations without Prometheus client libs.

    Labels are deliberately allow-listed and sanitized before storage so requests, IDs and
    model/tool payloads cannot become high-cardinality or sensitive metric dimensions.
    """

    def __init__(self, *, max_series_per_metric: int = DEFAULT_MAX_METRIC_SERIES) -> None:
        if max_series_per_metric < 1:
            raise ValueError("max_series_per_metric deve ser maior que zero")
        self._lock = Lock()
        self._max_series_per_metric = max_series_per_metric
        self._counters: dict[tuple[str, tuple[tuple[str, str], ...]], float] = {}
        self._observations: dict[
            tuple[str, tuple[tuple[str, str], ...]], _HistogramState
        ] = {}

    def increment(
        self, name: str, labels: Mapping[str, object] | None = None, value: float = 1
    ) -> None:
        with self._lock:
            key = self._key_for_write(name, labels)
            self._counters[key] = self._counters.get(key, 0.0) + max(0.0, float(value))

    def observe(
        self, name: str, labels: Mapping[str, object] | None = None, value: float = 0
    ) -> None:
        normalized_value = max(0.0, float(value))
        with self._lock:
            key = self._key_for_write(name, labels)
            state = self._observations.setdefault(key, _HistogramState())
            state.count += 1
            state.total += normalized_value
            state.last = normalized_value
            for bound in _HISTOGRAM_BUCKETS:
                if normalized_value <= bound:
                    state.buckets[bound] += 1

    def _key_for_write(
        self, name: str, labels: Mapping[str, object] | None
    ) -> tuple[str, tuple[tuple[str, str], ...]]:
        requested_key = (name, _normalized_labels(labels))
        if requested_key in self._counters or requested_key in self._observations:
            return requested_key

        existing_series = {
            series
            for metric_name, series in (*self._counters.keys(), *self._observations.keys())
            if metric_name == name and series != _CARDINALITY_OVERFLOW_LABELS
        }
        if len(existing_series) >= self._max_series_per_metric:
            return (name, _CARDINALITY_OVERFLOW_LABELS)
        return requested_key

    def snapshot(self) -> dict[str, list[dict[str, Any]]]:
        with self._lock:
            counters = [
                {"name": name, "labels": dict(labels), "value": value}
                for (name, labels), value in sorted(self._counters.items())
            ]
            observations = [
                {
                    "name": name,
                    "labels": dict(labels),
                    "count": state.count,
                    "sum": state.total,
                    "last": state.last,
                    "buckets": {
                        str(bound): state.buckets[bound] for bound in _HISTOGRAM_BUCKETS
                    }
                    | {"+Inf": state.count},
                }
                for (name, labels), state in sorted(self._observations.items())
            ]
        return {"counters": counters, "observations": observations}

    def prometheus_text(self) -> str:
        snapshot = self.snapshot()
        lines: list[str] = []
        for metric in snapshot["counters"]:
            lines.append(_prometheus_sample(metric["name"], metric["labels"], metric["value"]))
        for metric in snapshot["observations"]:
            labels = dict(metric["labels"])
            for bound, count in metric["buckets"].items():
                lines.append(
                    _prometheus_sample(
                        f"{metric['name']}_bucket",
                        {**labels, "le": bound},
                        count,
                    )
                )
            lines.append(_prometheus_sample(f"{metric['name']}_count", labels, metric["count"]))
            lines.append(_prometheus_sample(f"{metric['name']}_sum", labels, metric["sum"]))
        return "\n".join(lines) + ("\n" if lines else "")

    def reset(self) -> None:
        with self._lock:
            self._counters.clear()
            self._observations.clear()


RUNTIME_METRICS = RuntimeMetricStore()


def record_runtime_metric(
    name: str, labels: Mapping[str, object] | None = None, value: float = 1
) -> None:
    RUNTIME_METRICS.increment(name, labels, value)


def observe_runtime_metric(
    name: str, labels: Mapping[str, object] | None = None, value: float = 0
) -> None:
    RUNTIME_METRICS.observe(name, labels, value)


def _normalized_labels(labels: Mapping[str, object] | None) -> tuple[tuple[str, str], ...]:
    if not labels:
        return ()
    normalized = {
        label: _safe_label_value(labels.get(label))
        for label in OBSERVABILITY_SAFE_LABELS
        if label in labels
    }
    return tuple(sorted(normalized.items()))


def _safe_label_value(value: object) -> str:
    candidate = str(value or "").strip()
    return candidate if _SAFE_LABEL_VALUE.fullmatch(candidate) else "unknown"


def _prometheus_sample(name: str, labels: Mapping[str, object], value: float) -> str:
    label_text = ""
    if labels:
        rendered_labels = ",".join(
            f'{key}="{value}"' for key, value in sorted(labels.items())
        )
        label_text = "{" + rendered_labels + "}"
    return f"{name}{label_text} {float(value):g}"

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
            "description": "Verifique vLLM, prompts e regressões do planner.",
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
        "expr": 'sum(rate(ai_graph_artifact_status_total{status=~"error|failed"}[5m])) > 0',
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
                    (
                        "histogram_quantile(0.95, sum(rate(ai_graph_duration_seconds_bucket[5m])) "
                        "by (le, mode, scope))"
                    ),
                    "sum(rate(ai_graph_cache_hit_total[5m])) by (mode, scope)",
                    (
                        "histogram_quantile(0.95, sum(rate(ai_graph_model_duration_seconds_"
                        "bucket[5m])) "
                        "by (le, mode, scope))"
                    ),
                ],
            },
            {
                "title": "Tools e proteções",
                "queries": [
                    "sum(rate(ai_graph_tool_calls_total[5m])) by (scope, source_kind, result_kind)",
                    "sum(rate(ai_graph_tool_denials_total[5m])) by (reason, scope)",
                    "sum(rate(ai_graph_tool_timeouts_total[5m])) by (scope, reason)",
                    (
                        "histogram_quantile(0.95, sum(rate(ai_graph_retrieval_duration_seconds_"
                        "bucket[5m])) "
                        "by (le, scope, status))"
                    ),
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
        "ai_graph_abstention_total": "Respostas abstidas por falta de evidÃªncia ou budget.",
        "ai_graph_model_duration_seconds": "LatÃªncia das chamadas ao modelo em segundos.",
        "ai_graph_retrieval_duration_seconds": (
            "LatÃªncia das recuperaÃ§Ãµes Agentic RAG em segundos."
        ),
    }
    return descriptions.get(metric, "Métrica do agente de IA.")


if __name__ == "__main__":
    raise SystemExit(main())
