from __future__ import annotations

import argparse
import asyncio
import dataclasses
import hashlib
import json
import math
import os
import platform
import shutil
import statistics
import subprocess
import sys
import tempfile
import time
import uuid
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, Literal

from sqlalchemy import create_engine, insert, select
from sqlalchemy.engine import Connection, Engine

from silo.ai import assistant_service
from silo.ai.assistant_contracts import AiAssistantMessageRequestDto
from silo.ai.assistant_registry import AgentRuntimeContext
from silo.ai.assistant_runtime import (
    VLLMEmbeddingRuntime,
    VLLMModelRuntime,
    create_embedding_runtime,
    create_model_runtime,
    probe_ai_runtime,
)
from silo.ai.assistant_service import create_assistant_thread, delete_assistant_thread, get_assistant_graph
from silo.api.dependencies import CurrentUser
from silo.config import AiAgentMode, Settings, load_settings
from silo.db.models import legacy_tables
from silo.db.url import sqlalchemy_database_url

EXPECTED_CHAT_MODEL = "qwen2.5:1.5b-instruct-q4_K_M"
EXPECTED_CHAT_DIGEST = "65ec06548149b04c096a120e4a6da9d4017ea809c91734ea5631e89f96ddc57b"
EXPECTED_EMBEDDING_MODEL = "nomic-embed-text:v1.5"
EXPECTED_EMBEDDING_DIGEST = "0a109f422b47e3a30ba2b10eca18548e944e8a23073ee3f3e947efcf3c45e59f"

DEFAULT_DATABASE_URL = "postgresql://silo:silo@127.0.0.1:5432/silo"
DEFAULT_vllm_url = "http://127.0.0.1:11434"
DEFAULT_CORPUS_PATH = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "ai" / "eval-cases.jsonl"
DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parents[5] / "docs" / "migration" / "evidence" / "phase-11" / "11-agentic-eval"


def _coerce_str_tuple(value: object) -> tuple[str, ...]:
    if not isinstance(value, Iterable) or isinstance(value, (str, bytes)):
        return ()
    return tuple(str(item) for item in value)


def _coerce_mapping(value: object) -> dict[str, Any] | None:
    return dict(value) if isinstance(value, Mapping) else None


def _hash_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _json_default(value: object) -> object:
    if dataclasses.is_dataclass(value):
        return dataclasses.asdict(value)
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, datetime):
        return value.astimezone().isoformat().replace("+00:00", "Z")
    if isinstance(value, set):
        return sorted(value)
    raise TypeError(f"Object is not JSON serializable: {type(value)!r}")


def _write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True, default=_json_default),
        encoding="utf-8",
    )


def _write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def _p95(values: Sequence[int | float]) -> int | None:
    cleaned = sorted(int(value) for value in values if value is not None)
    if not cleaned:
        return None
    index = max(0, min(len(cleaned) - 1, math.ceil(0.95 * len(cleaned)) - 1))
    return cleaned[index]


def _ratio(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return round(numerator / denominator, 6)


def _load_jsonl(path: Path) -> list[dict[str, Any]]:
    lines = path.read_text(encoding="utf-8").splitlines()
    return [json.loads(line) for line in lines if line.strip()]


def _build_eval_environ(
    *,
    database_url: str,
    uploads_dir: Path,
    vllm_url: str,
    mode: Literal["deterministic", "hybrid"],
) -> dict[str, str]:
    environ = dict(os.environ)
    environ.setdefault("SILO_ENV", "development")
    environ["DATABASE_URL"] = database_url
    environ["UPLOADS_DIR"] = str(uploads_dir)
    environ["vllm_url"] = vllm_url
    environ["AI_AGENT_MODE"] = mode
    environ.setdefault("APP_URL_DEV", "http://localhost:3000")
    environ.setdefault("APP_URL_PROD", "http://localhost:3000")
    environ.setdefault("SESSION_SECRET", "phase11-eval-session-secret")
    environ.setdefault("BETTER_AUTH_SECRET", "phase11-eval-session-secret")
    environ.setdefault("SMTP_HOST", "")
    environ.setdefault("SMTP_USERNAME", "")
    environ.setdefault("SMTP_PASSWORD", "")
    environ.setdefault("GOOGLE_CLIENT_ID", "")
    environ.setdefault("GOOGLE_CLIENT_SECRET", "")
    environ.setdefault("PRODUCT_FLOW_API_KEY", "")
    environ.setdefault("KAFKA_REST_PROXY_URL", "")
    environ.setdefault("KAFKA_REST_PROXY_AUTH", "")
    environ.setdefault("KAFKA_TOPICS", "")
    environ.setdefault("KAFKA_TOPIC", "")
    environ.setdefault("KAFKA_DLQ_PREFIX", "dlq.")
    environ.setdefault("VLLM_MODEL", EXPECTED_CHAT_MODEL)
    environ.setdefault("OLLAMA_EMBEDDING_MODEL", EXPECTED_EMBEDDING_MODEL)
    environ.setdefault("OLLAMA_TIMEOUT_MS", "30000")
    environ.setdefault("OLLAMA_MAX_CONCURRENT_REQUESTS", "1")
    return environ


@dataclass(frozen=True, slots=True)
class Phase11CorpusCase:
    id: str
    primary_category: str
    scope: str
    prompt: str
    conversation_context: dict[str, Any] | None
    is_in_scope_expected: bool
    expected_plan: tuple[str, ...]
    required_tools: tuple[str, ...]
    allowed_tools: tuple[str, ...]
    forbidden_tools: tuple[str, ...]
    source_kind: str
    sources: tuple[str, ...]
    verifiable_numbers: tuple[dict[str, Any], ...]
    expected_dataset: dict[str, Any]
    expected_artifact: dict[str, Any]
    pdf_allowed: bool
    risk_tags: tuple[str, ...]

    @classmethod
    def from_mapping(cls, payload: Mapping[str, Any]) -> Phase11CorpusCase:
        return cls(
            id=str(payload["id"]),
            primary_category=str(payload["primaryCategory"]),
            scope=str(payload["scope"]),
            prompt=str(payload["prompt"]),
            conversation_context=_coerce_mapping(payload.get("conversationContext")),
            is_in_scope_expected=bool(payload["isInScopeExpected"]),
            expected_plan=_coerce_str_tuple(payload.get("expectedPlan")),
            required_tools=_coerce_str_tuple(payload.get("requiredTools")),
            allowed_tools=_coerce_str_tuple(payload.get("allowedTools")),
            forbidden_tools=_coerce_str_tuple(payload.get("forbiddenTools")),
            source_kind=str(payload["sourceKind"]),
            sources=_coerce_str_tuple(payload.get("sources")),
            verifiable_numbers=tuple(dict(item) for item in payload.get("verifiableNumbers", []) if isinstance(item, Mapping)),
            expected_dataset=dict(payload.get("expectedDataset") or {}),
            expected_artifact=dict(payload.get("expectedArtifact") or {}),
            pdf_allowed=bool(payload["pdfAllowed"]),
            risk_tags=_coerce_str_tuple(payload.get("riskTags")),
        )

    @property
    def prompt_hash(self) -> str:
        return _hash_text(self.prompt)

    @property
    def conversation_context_hash(self) -> str | None:
        if self.conversation_context is None:
            return None
        return _hash_text(json.dumps(self.conversation_context, ensure_ascii=False, sort_keys=True, default=str))


@dataclass(frozen=True, slots=True)
class Phase11AttemptResult:
    mode: Literal["deterministic", "hybrid"]
    case_id: str
    attempt: int
    request_id: str
    run_id: str
    thread_id: str
    prompt_hash: str
    conversation_context_hash: str | None
    expected_scope: str
    actual_scope: str | None
    is_in_scope_expected: bool
    is_in_scope_actual: bool | None
    scope_match: bool
    expected_trajectory: tuple[str, ...]
    actual_trajectory: tuple[str, ...]
    trajectory_match: bool
    required_tools_expected_count: int
    required_tools_ok: bool
    required_tools_missing: tuple[str, ...]
    forbidden_tool_violations: tuple[str, ...]
    expected_source_kind: str
    actual_source_kind: str | None
    source_kind_match: bool
    expected_artifact_kind: str
    actual_artifact_kind: str
    artifact_match: bool
    expected_dataset_schema_id: str
    actual_dataset_schema_ids: tuple[str, ...]
    dataset_source_kinds: tuple[str, ...]
    dataset_manifest_ok: bool
    citations_count: int
    citations_valid: bool
    conclusion_ok: bool
    generation_status: str
    generation_error_message: str | None
    latency_ms: int
    first_emission_ms: int
    prompt_eval_count: int | None
    output_token_count: int | None
    model: str
    model_digest: str | None
    embedding_model: str
    embedding_digest: str | None
    hardware: dict[str, Any]
    notes: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class Phase11ModeSummary:
    mode: Literal["deterministic", "hybrid"]
    cases_total: int
    attempts_total: int
    case_pass_count: int
    attempt_pass_count: int
    required_tool_recall: float
    forbidden_tool_violation_count: int
    scope_accuracy: float
    source_kind_accuracy: float
    artifact_accuracy: float
    citation_validity_rate: float
    conclusion_success_rate: float
    number_consistency_rate: float
    first_emission_p95_ms: int | None
    final_p95_ms: int | None
    baseline_first_emission_p95_ms: int | None
    baseline_final_p95_ms: int | None
    deterministic_final_p95_ms: int | None
    final_vs_baseline_ratio: float | None
    final_vs_deterministic_ratio: float | None
    gate_status: str
    gate_notes: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class Phase11EvaluationReport:
    generated_at: str
    corpus_path: str
    output_dir: str
    hardware: dict[str, Any]
    ollama: dict[str, Any]
    modes: dict[str, Phase11ModeSummary]
    attempts: tuple[Phase11AttemptResult, ...]


def load_phase11_cases(path: Path = DEFAULT_CORPUS_PATH) -> list[Phase11CorpusCase]:
    raw_cases = _load_jsonl(path)
    return [Phase11CorpusCase.from_mapping(case) for case in raw_cases]


def capture_hardware_snapshot() -> dict[str, Any]:
    snapshot: dict[str, Any] = {
        "platform": platform.platform(),
        "system": platform.system(),
        "release": platform.release(),
        "version": platform.version(),
        "machine": platform.machine(),
        "processor": platform.processor() or None,
        "logicalCpuCount": os.cpu_count(),
        "pythonImplementation": platform.python_implementation(),
        "pythonVersion": platform.python_version(),
        "node": platform.node(),
    }

    try:
        import psutil  # type: ignore

        vm = psutil.virtual_memory()
        snapshot["memoryTotalBytes"] = int(vm.total)
        snapshot["memoryAvailableBytes"] = int(vm.available)
    except Exception:
        snapshot["memoryTotalBytes"] = None
        snapshot["memoryAvailableBytes"] = None

    gpu_snapshot = _capture_gpu_snapshot()
    if gpu_snapshot:
        snapshot["gpu"] = gpu_snapshot

    cpu_name = _capture_cpu_name()
    if cpu_name:
        snapshot["cpuName"] = cpu_name

    return snapshot


def _capture_gpu_snapshot() -> dict[str, Any] | None:
    commands: list[list[str]] = [
        [
            "nvidia-smi",
            "--query-gpu=name,memory.total",
            "--format=csv,noheader,nounits",
        ],
        [
            "powershell",
            "-NoProfile",
            "-Command",
            "Get-CimInstance Win32_VideoController | Select-Object -First 2 Name,AdapterRAM | ConvertTo-Json -Compress",
        ],
    ]
    for command in commands:
        try:
            completed = subprocess.run(
                command,
                capture_output=True,
                text=True,
                check=False,
                timeout=5,
            )
        except Exception:
            continue
        if completed.returncode != 0:
            continue
        payload = completed.stdout.strip()
        if not payload:
            continue
        if command[0] == "nvidia-smi":
            lines = [line.strip() for line in payload.splitlines() if line.strip()]
            if lines:
                return {"source": "nvidia-smi", "lines": lines}
            continue
        try:
            data = json.loads(payload)
        except Exception:
            return {"source": "powershell", "raw": payload}
        return {"source": "powershell", "value": data}
    return None


def _capture_cpu_name() -> str | None:
    commands: list[list[str]] = [
        [
            "powershell",
            "-NoProfile",
            "-Command",
            "(Get-CimInstance Win32_Processor | Select-Object -First 1 -ExpandProperty Name).Trim()",
        ],
        ["wmic", "cpu", "get", "name"],
    ]
    for command in commands:
        try:
            completed = subprocess.run(
                command,
                capture_output=True,
                text=True,
                check=False,
                timeout=5,
            )
        except Exception:
            continue
        if completed.returncode != 0:
            continue
        text = completed.stdout.strip()
        if not text:
            continue
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        if not lines:
            continue
        if len(lines) >= 2 and lines[0].lower() == "name":
            return lines[1]
        return lines[0]
    return None


def _load_latency_baseline(path: Path | None) -> dict[str, int] | None:
    if path is None:
        return None
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, Mapping):
        raise ValueError("Baseline JSON deve ser um objeto.")
    first = payload.get("firstEmissionP95Ms", payload.get("first_emission_p95_ms"))
    final = payload.get("finalP95Ms", payload.get("final_p95_ms"))
    if first is None and final is None:
        raise ValueError("Baseline JSON não contém métricas reconhecíveis.")
    result: dict[str, int] = {}
    if first is not None:
        result["firstEmissionP95Ms"] = int(first)
    if final is not None:
        result["finalP95Ms"] = int(final)
    return result


def _settings_database_url(settings: Settings) -> str:
    database_url = settings.database_url
    if hasattr(database_url, "get_secret_value"):
        return str(database_url.get_secret_value())
    return str(database_url)


def _resolve_eval_user(connection: Connection, *, seed_database_if_missing: bool, settings: Settings) -> CurrentUser:
    user_table = legacy_tables["user"]
    row = connection.execute(
        select(user_table.c.id, user_table.c.email, user_table.c.name, user_table.c.is_active)
        .where(user_table.c.is_active.is_(True))
        .order_by(user_table.c.id.asc())
        .limit(1)
    ).mappings().first()
    if row is None:
        row = connection.execute(
            select(user_table.c.id, user_table.c.email, user_table.c.name, user_table.c.is_active)
            .order_by(user_table.c.id.asc())
            .limit(1)
        ).mappings().first()
    if row is None and seed_database_if_missing:
        from silo.db.seed import seed_database

        seed_database(_settings_database_url(settings))
        row = connection.execute(
            select(user_table.c.id, user_table.c.email, user_table.c.name, user_table.c.is_active)
            .order_by(user_table.c.id.asc())
            .limit(1)
        ).mappings().first()
    if row is None:
        raise RuntimeError("Nenhum usuário disponível no banco de avaliação.")
    return CurrentUser(
        id=str(row["id"]),
        email=str(row.get("email") or ""),
        name=str(row.get("name") or ""),
        is_active=bool(row.get("is_active", True)),
    )


def _seed_followup_context(
    connection: Connection,
    *,
    thread_id: str,
    current_user: CurrentUser,
    context: Mapping[str, Any],
    settings: Settings,
) -> None:
    prior_scope = str(context.get("priorScope") or "general")
    prior_question = str(context.get("priorQuestion") or "")
    prior_answer_summary = str(context.get("priorAnswerSummary") or "")
    if not prior_question and not prior_answer_summary:
        return

    now = datetime.now(UTC).astimezone().replace(tzinfo=None)
    user_created_at = now - timedelta(minutes=2)
    assistant_created_at = now - timedelta(minutes=1)
    message_table = legacy_tables["ai_assistant_message"]
    connection.execute(
        insert(message_table).values(
            {
                "id": str(uuid.uuid4()),
                "thread_id": thread_id,
                "sender_type": "user",
                "sender_user_id": current_user.id,
                "sender_name": current_user.name or current_user.email or "Usuário",
                "provider": None,
                "model": None,
                "generation_status": None,
                "latency_ms": None,
                "error_message": None,
                "content": prior_question,
                "metadata": {"scope": prior_scope, "role": "user"},
                "embedding": None,
                "created_at": user_created_at,
                "updated_at": user_created_at,
            }
        )
    )
    connection.execute(
        insert(message_table).values(
            {
                "id": str(uuid.uuid4()),
                "thread_id": thread_id,
                "sender_type": "assistant",
                "sender_user_id": None,
                "sender_name": "Assistente de IA",
                "provider": "ollama",
                "model": settings.vllm.model,
                "generation_status": "success",
                "latency_ms": 0,
                "error_message": None,
                "content": prior_answer_summary,
                "metadata": {
                    "scope": prior_scope,
                    "answer": prior_answer_summary,
                    "role": "assistant",
                    "summaryOnly": True,
                },
                "embedding": None,
                "created_at": assistant_created_at,
                "updated_at": assistant_created_at,
            }
        )
    )
    connection.commit()


def _create_runtime_context(
    *,
    connection: Connection,
    current_user: CurrentUser,
    settings: Settings,
    mode: Literal["deterministic", "hybrid"],
    model_runtime: VLLMModelRuntime,
    embedding_runtime: VLLMEmbeddingRuntime,
) -> AgentRuntimeContext:
    runtime_context = assistant_service._build_runtime_context(  # noqa: SLF001
        connection,
        current_user,
        request_id=str(uuid.uuid4()),
        settings=settings,
        model_runtime=model_runtime,
        embedding_provider=embedding_runtime,
    )
    runtime_context.mode = mode
    runtime_context.connection_factory = connection.engine.connect if connection.engine is not None else None
    runtime_context.has_reports_permission = True
    return runtime_context


def _build_state_for_case(
    case: Phase11CorpusCase,
    *,
    runtime_context: AgentRuntimeContext,
    thread_id: str,
) -> dict[str, Any]:
    request = AiAssistantMessageRequestDto(thread_id=thread_id, content=case.prompt)
    return assistant_service._initial_state(request, runtime_context)  # noqa: SLF001


def _actual_artifact_kind(state: Mapping[str, Any]) -> str:
    response = state.get("final_response") or {}
    if isinstance(response, Mapping):
        artifacts = response.get("artifacts") or []
        if isinstance(artifacts, Sequence) and artifacts:
            first_artifact = artifacts[0]
            if isinstance(first_artifact, Mapping):
                kind = first_artifact.get("kind")
                if isinstance(kind, str) and kind.strip():
                    return kind
        visualization = response.get("visualization") or state.get("visualization") or {}
        if isinstance(visualization, Mapping):
            kind = visualization.get("kind")
            if isinstance(kind, str) and kind.strip():
                return kind
    artifact_result = state.get("artifact_result") or {}
    if isinstance(artifact_result, Mapping):
        artifact = artifact_result.get("artifact")
        if isinstance(artifact, Mapping):
            kind = artifact.get("kind")
            if isinstance(kind, str) and kind.strip():
                return kind
    return "none"


def _actual_dataset_summary(state: Mapping[str, Any]) -> tuple[tuple[str, ...], tuple[str, ...]]:
    manifests = state.get("dataset_manifests") or []
    schema_ids: list[str] = []
    source_kinds: list[str] = []
    if isinstance(manifests, Sequence):
        for item in manifests:
            if not isinstance(item, Mapping):
                continue
            schema_id = item.get("schema_id") or item.get("schemaId")
            source_kind = item.get("source_kind") or item.get("sourceKind")
            if isinstance(schema_id, str) and schema_id.strip():
                schema_ids.append(schema_id)
            if isinstance(source_kind, str) and source_kind.strip():
                source_kinds.append(source_kind)
    return tuple(schema_ids), tuple(source_kinds)


def _trajectory_from_state(state: Mapping[str, Any]) -> tuple[str, ...]:
    trajectory = assistant_service._canonical_trajectory(dict(state))  # noqa: SLF001
    return tuple(trajectory)


def _tool_call_names(state: Mapping[str, Any]) -> tuple[str, ...]:
    observability = state.get("observability") or {}
    names: list[str] = []
    if isinstance(observability, Mapping):
        tool_calls = observability.get("toolCalls") or []
        if isinstance(tool_calls, Sequence):
            for event in tool_calls:
                if isinstance(event, Mapping):
                    name = event.get("name")
                    if isinstance(name, str) and name.strip():
                        names.append(name)
    return tuple(names)


def _lineage_for_case(case: Phase11CorpusCase, state: Mapping[str, Any]) -> dict[str, Any]:
    final_response = state.get("final_response") or {}
    if not isinstance(final_response, Mapping):
        final_response = {}
    citations = final_response.get("citations") or state.get("citations") or []
    if not isinstance(citations, Sequence):
        citations = []
    generation = final_response.get("generation") or state.get("generation") or {}
    if not isinstance(generation, Mapping):
        generation = {}
    visualization = final_response.get("visualization") or state.get("visualization") or {}
    if not isinstance(visualization, Mapping):
        visualization = {}
    artifacts = final_response.get("artifacts") or []
    if not isinstance(artifacts, Sequence):
        artifacts = []
    actual_scope = final_response.get("scope") or state.get("scope")
    actual_is_in_scope = final_response.get("is_in_scope")
    if actual_is_in_scope is None:
        actual_is_in_scope = final_response.get("isInScope")
    if actual_is_in_scope is None:
        actual_is_in_scope = state.get("is_in_scope")
    actual_artifact_kind = _actual_artifact_kind(state)
    schema_ids, source_kinds = _actual_dataset_summary(state)
    actual_trajectory = _trajectory_from_state(state)
    actual_tool_calls = _tool_call_names(state)
    required_tools_missing = tuple(
        tool for tool in case.required_tools if tool not in actual_trajectory and tool not in actual_tool_calls
    )
    forbidden_tool_violations = tuple(
        tool
        for tool in case.forbidden_tools
        if tool in actual_trajectory or tool in actual_tool_calls
    )
    expected_artifact_kind = str(case.expected_artifact.get("kind") or "none")
    expected_dataset_schema_id = str(case.expected_dataset.get("schemaId") or "")
    expected_source_kind = case.source_kind
    actual_source_kind = source_kinds[0] if source_kinds else None
    scope_match = bool(actual_scope) and str(actual_scope) == case.scope and bool(actual_is_in_scope) == case.is_in_scope_expected
    if not case.is_in_scope_expected:
        scope_match = bool(actual_is_in_scope) is False
    dataset_manifest_ok = False
    if expected_dataset_schema_id:
        dataset_manifest_ok = expected_dataset_schema_id in schema_ids and expected_source_kind in source_kinds
    else:
        dataset_manifest_ok = bool(schema_ids)
    citations_valid = False
    if citations:
        citations_valid = all(
            isinstance(item, Mapping)
            and isinstance(item.get("label"), str)
            and str(item.get("label")).strip()
            and (item.get("detail") is None or isinstance(item.get("detail"), str))
            for item in citations
        )
    generation_status = str(generation.get("status") or "error")
    generation_error_message = generation.get("errorMessage")
    conclusion_ok = bool(final_response) and not bool(state.get("errors"))
    if not case.is_in_scope_expected:
        conclusion_ok = bool(final_response) and bool(actual_is_in_scope) is False and not bool(state.get("errors"))
    return {
        "actual_scope": str(actual_scope) if actual_scope is not None else None,
        "actual_is_in_scope": bool(actual_is_in_scope) if actual_is_in_scope is not None else None,
        "scope_match": scope_match,
        "actual_trajectory": actual_trajectory,
        "required_tools_missing": required_tools_missing,
        "forbidden_tool_violations": forbidden_tool_violations,
        "actual_source_kind": actual_source_kind,
        "source_kind_match": bool(actual_source_kind) and actual_source_kind == expected_source_kind,
        "expected_artifact_kind": expected_artifact_kind,
        "actual_artifact_kind": actual_artifact_kind,
        "artifact_match": actual_artifact_kind == expected_artifact_kind,
        "actual_dataset_schema_ids": schema_ids,
        "dataset_source_kinds": source_kinds,
        "dataset_manifest_ok": dataset_manifest_ok,
        "citations_count": len(citations),
        "citations_valid": citations_valid,
        "conclusion_ok": conclusion_ok,
        "generation_status": generation_status,
        "generation_error_message": str(generation_error_message) if generation_error_message is not None else None,
        "prompt_eval_count": state.get("prompt_eval_count"),
        "output_token_count": generation.get("generatedTokens"),
        "latency_ms": int(generation.get("latencyMs") or 0),
        "actual_tool_calls": actual_tool_calls,
        "required_tools_expected_count": len(case.required_tools),
    }


async def _run_case_attempt(
    *,
    case: Phase11CorpusCase,
    attempt: int,
    mode: Literal["deterministic", "hybrid"],
    settings: Settings,
    engine: Engine,
    current_user: CurrentUser,
    model_runtime: VLLMModelRuntime,
    embedding_runtime: VLLMEmbeddingRuntime,
    hardware: dict[str, Any],
    model_digest: str | None,
    embedding_digest: str | None,
) -> tuple[Phase11AttemptResult, str]:
    assistant_service._SEMANTIC_CACHE.clear()  # noqa: SLF001
    request_id = str(uuid.uuid4())
    run_id = str(uuid.uuid4())
    thread_title = f"Phase 11 {case.id} {mode} {attempt}"
    thread_id = ""
    connection = engine.connect()
    runtime_context = _create_runtime_context(
        connection=connection,
        current_user=current_user,
        settings=settings,
        mode=mode,
        model_runtime=model_runtime,
        embedding_runtime=embedding_runtime,
    )
    runtime_context.request_id = request_id
    runtime_context.run_id = run_id
    runtime_context.mode = mode
    runtime_context.has_reports_permission = True
    notes: list[str] = []
    started_at = time.perf_counter()
    try:
        thread_response = create_assistant_thread(connection, current_user.id, title=thread_title)
        thread_id = str(thread_response.thread.id)
        if case.conversation_context is not None:
            _seed_followup_context(
                connection,
                thread_id=thread_id,
                current_user=current_user,
                context=case.conversation_context,
                settings=settings,
            )
        state = _build_state_for_case(case, runtime_context=runtime_context, thread_id=thread_id)
        result_state = await get_assistant_graph().ainvoke(state, context=runtime_context)
        latency_ms = int((time.perf_counter() - started_at) * 1000)
        lineage = _lineage_for_case(case, result_state)
        attempt_result = Phase11AttemptResult(
            mode=mode,
            case_id=case.id,
            attempt=attempt,
            request_id=request_id,
            run_id=run_id,
            thread_id=thread_id,
            prompt_hash=case.prompt_hash,
            conversation_context_hash=case.conversation_context_hash,
            expected_scope=case.scope,
            actual_scope=lineage["actual_scope"],
            is_in_scope_expected=case.is_in_scope_expected,
            is_in_scope_actual=lineage["actual_is_in_scope"],
            scope_match=bool(lineage["scope_match"]),
            expected_trajectory=case.expected_plan,
            actual_trajectory=lineage["actual_trajectory"],
            trajectory_match=tuple(lineage["actual_trajectory"]) == case.expected_plan,
            required_tools_expected_count=int(lineage["required_tools_expected_count"]),
            required_tools_ok=not lineage["required_tools_missing"],
            required_tools_missing=tuple(lineage["required_tools_missing"]),
            forbidden_tool_violations=tuple(lineage["forbidden_tool_violations"]),
            expected_source_kind=case.source_kind,
            actual_source_kind=lineage["actual_source_kind"],
            source_kind_match=bool(lineage["source_kind_match"]),
            expected_artifact_kind=lineage["expected_artifact_kind"],
            actual_artifact_kind=lineage["actual_artifact_kind"],
            artifact_match=bool(lineage["artifact_match"]),
            expected_dataset_schema_id=str(case.expected_dataset.get("schemaId") or ""),
            actual_dataset_schema_ids=tuple(lineage["actual_dataset_schema_ids"]),
            dataset_source_kinds=tuple(lineage["dataset_source_kinds"]),
            dataset_manifest_ok=bool(lineage["dataset_manifest_ok"]),
            citations_count=int(lineage["citations_count"]),
            citations_valid=bool(lineage["citations_valid"]),
            conclusion_ok=bool(lineage["conclusion_ok"]),
            generation_status=str(lineage["generation_status"]),
            generation_error_message=lineage["generation_error_message"],
            latency_ms=latency_ms,
            first_emission_ms=0,
            prompt_eval_count=lineage["prompt_eval_count"],
            output_token_count=lineage["output_token_count"],
            model=settings.vllm.model,
            model_digest=model_digest,
            embedding_model=settings.vllm.embedding_model,
            embedding_digest=embedding_digest,
            hardware=hardware,
            notes=tuple(notes),
        )
        return attempt_result, thread_id
    except Exception as exc:
        latency_ms = int((time.perf_counter() - started_at) * 1000)
        notes.append(str(exc))
        attempt_result = Phase11AttemptResult(
            mode=mode,
            case_id=case.id,
            attempt=attempt,
            request_id=request_id,
            run_id=run_id,
            thread_id=thread_id or "",
            prompt_hash=case.prompt_hash,
            conversation_context_hash=case.conversation_context_hash,
            expected_scope=case.scope,
            actual_scope=None,
            is_in_scope_expected=case.is_in_scope_expected,
            is_in_scope_actual=None,
            scope_match=False,
            expected_trajectory=case.expected_plan,
            actual_trajectory=(),
            trajectory_match=False,
            required_tools_expected_count=len(case.required_tools),
            required_tools_ok=False,
            required_tools_missing=case.required_tools,
            forbidden_tool_violations=(),
            expected_source_kind=case.source_kind,
            actual_source_kind=None,
            source_kind_match=False,
            expected_artifact_kind=str(case.expected_artifact.get("kind") or "none"),
            actual_artifact_kind="none",
            artifact_match=case.expected_artifact.get("kind") in (None, "none"),
            expected_dataset_schema_id=str(case.expected_dataset.get("schemaId") or ""),
            actual_dataset_schema_ids=(),
            dataset_source_kinds=(),
            dataset_manifest_ok=False,
            citations_count=0,
            citations_valid=False,
            conclusion_ok=False,
            generation_status="error",
            generation_error_message=str(exc),
            latency_ms=latency_ms,
            first_emission_ms=0,
            prompt_eval_count=None,
            output_token_count=None,
            model=settings.vllm.model,
            model_digest=model_digest,
            embedding_model=settings.vllm.embedding_model,
            embedding_digest=embedding_digest,
            hardware=hardware,
            notes=tuple(notes),
        )
        return attempt_result, thread_id
    finally:
        try:
            if thread_id:
                delete_assistant_thread(connection, current_user.id, thread_id)
        except Exception as cleanup_error:
            notes.append(f"cleanup:{cleanup_error}")
        finally:
            try:
                runtime_context.dataset_registry.clear()
            except Exception:
                pass
            connection.close()
            assistant_service._SEMANTIC_CACHE.clear()  # noqa: SLF001


def _summarize_mode(
    *,
    mode: Literal["deterministic", "hybrid"],
    attempts: Sequence[Phase11AttemptResult],
    baseline_first_emission_p95_ms: int | None,
    baseline_final_p95_ms: int | None,
    deterministic_final_p95_ms: int | None,
) -> Phase11ModeSummary:
    case_groups: dict[str, list[Phase11AttemptResult]] = {}
    for attempt in attempts:
        case_groups.setdefault(attempt.case_id, []).append(attempt)

    case_pass_count = 0
    attempt_pass_count = 0
    required_tools_expected = 0
    required_tools_found = 0
    forbidden_tool_violations = 0
    scope_matches = 0
    source_kind_matches = 0
    artifact_matches = 0
    citations_valid = 0
    conclusion_ok = 0
    number_consistency = 0
    first_emissions = []
    finals = []

    for attempt in attempts:
        attempt_ok = (
            attempt.scope_match
            and attempt.trajectory_match
            and attempt.required_tools_ok
            and not attempt.forbidden_tool_violations
            and attempt.source_kind_match
            and attempt.dataset_manifest_ok
            and attempt.artifact_match
            and attempt.citations_valid
            and attempt.conclusion_ok
        )
        if attempt_ok:
            attempt_pass_count += 1
        if attempt.scope_match:
            scope_matches += 1
        if attempt.source_kind_match:
            source_kind_matches += 1
        if attempt.artifact_match:
            artifact_matches += 1
        if attempt.citations_valid:
            citations_valid += 1
        if attempt.conclusion_ok:
            conclusion_ok += 1
        if attempt.generation_status == "success":
            number_consistency += 1
        forbidden_tool_violations += len(attempt.forbidden_tool_violations)
        required_tools_expected += attempt.required_tools_expected_count
        required_tools_found += attempt.required_tools_expected_count - len(attempt.required_tools_missing)
        first_emissions.append(attempt.first_emission_ms)
        finals.append(attempt.latency_ms)

    for case_id, case_attempts in case_groups.items():
        if case_attempts and all(
            (
                attempt.scope_match
                and attempt.trajectory_match
                and attempt.required_tools_ok
                and not attempt.forbidden_tool_violations
                and attempt.source_kind_match
                and attempt.dataset_manifest_ok
                and attempt.artifact_match
                and attempt.citations_valid
                and attempt.conclusion_ok
            )
            for attempt in case_attempts
        ):
            case_pass_count += 1

    required_tool_recall = _ratio(required_tools_found, required_tools_expected)
    scope_accuracy = _ratio(scope_matches, len(attempts))
    source_kind_accuracy = _ratio(source_kind_matches, len(attempts))
    artifact_accuracy = _ratio(artifact_matches, len(attempts))
    citation_validity_rate = _ratio(citations_valid, len(attempts))
    conclusion_success_rate = _ratio(conclusion_ok, len(attempts))
    number_consistency_rate = _ratio(number_consistency, len(attempts))
    first_emission_p95_ms = _p95(first_emissions)
    final_p95_ms = _p95(finals)
    final_vs_baseline_ratio = None
    if baseline_final_p95_ms and final_p95_ms is not None and baseline_final_p95_ms > 0:
        final_vs_baseline_ratio = round(final_p95_ms / baseline_final_p95_ms, 6)
    final_vs_deterministic_ratio = None
    if deterministic_final_p95_ms and final_p95_ms is not None and deterministic_final_p95_ms > 0:
        final_vs_deterministic_ratio = round(final_p95_ms / deterministic_final_p95_ms, 6)

    gate_notes: list[str] = []
    gate_status = "pending"
    if mode == "deterministic":
        if baseline_first_emission_p95_ms is None or baseline_final_p95_ms is None:
            gate_status = "pending_baseline"
            gate_notes.append("Baseline Node ausente; compare com um JSON de baseline para aprovar 11.59.")
        elif (
            required_tool_recall >= 1.0
            and scope_accuracy >= 1.0
            and source_kind_accuracy >= 1.0
            and artifact_accuracy >= 1.0
            and citation_validity_rate >= 1.0
            and conclusion_success_rate >= 0.97
            and first_emission_p95_ms is not None
            and final_p95_ms is not None
            and (
                (baseline_final_p95_ms > 0 and final_p95_ms <= math.ceil(baseline_final_p95_ms * 1.2))
                or (baseline_final_p95_ms > 0 and final_p95_ms <= baseline_final_p95_ms + math.ceil(baseline_final_p95_ms * 0.2))
            )
        ):
            gate_status = "approved"
        else:
            gate_status = "failed"
    else:
        if deterministic_final_p95_ms is None:
            gate_status = "pending_deterministic"
            gate_notes.append("Executar primeiro a Fase 11 em modo deterministic para estabelecer baseline.")
        elif (
            forbidden_tool_violations == 0
            and required_tool_recall >= 0.98
            and scope_accuracy >= 1.0
            and artifact_accuracy >= 1.0
            and citation_validity_rate >= 0.95
            and conclusion_success_rate >= 0.95
            and number_consistency_rate >= 0.95
            and final_p95_ms is not None
            and deterministic_final_p95_ms > 0
            and final_p95_ms <= math.ceil(deterministic_final_p95_ms * 1.3)
        ):
            gate_status = "approved"
        else:
            gate_status = "failed"

    if mode == "deterministic" and gate_status == "approved":
        gate_notes.append("Modo deterministic aprovado com os thresholds configurados.")
    if mode == "hybrid" and gate_status == "approved":
        gate_notes.append("Modo hybrid aprovado e elegível para habilitação controlada em staging.")
    if mode == "hybrid" and gate_status == "failed":
        gate_notes.append("Modo hybrid não atingiu o Gate 11.60; manter AI_AGENT_MODE=deterministic.")

    return Phase11ModeSummary(
        mode=mode,
        cases_total=len(case_groups),
        attempts_total=len(attempts),
        case_pass_count=case_pass_count,
        attempt_pass_count=attempt_pass_count,
        required_tool_recall=required_tool_recall,
        forbidden_tool_violation_count=forbidden_tool_violations,
        scope_accuracy=scope_accuracy,
        source_kind_accuracy=source_kind_accuracy,
        artifact_accuracy=artifact_accuracy,
        citation_validity_rate=citation_validity_rate,
        conclusion_success_rate=conclusion_success_rate,
        number_consistency_rate=number_consistency_rate,
        first_emission_p95_ms=first_emission_p95_ms,
        final_p95_ms=final_p95_ms,
        baseline_first_emission_p95_ms=baseline_first_emission_p95_ms,
        baseline_final_p95_ms=baseline_final_p95_ms,
        deterministic_final_p95_ms=deterministic_final_p95_ms,
        final_vs_baseline_ratio=final_vs_baseline_ratio,
        final_vs_deterministic_ratio=final_vs_deterministic_ratio,
        gate_status=gate_status,
        gate_notes=tuple(gate_notes),
    )


def _render_summary_markdown(report: Phase11EvaluationReport) -> str:
    lines = [
        "# Fase 11 — avaliação real do assistente LangGraph/Ollama",
        "",
        f"Data da captura: `{report.generated_at}`",
        "",
        "## Ambiente",
        "",
        f"- Corpus: `{report.corpus_path}`",
        f"- Saída sanitizada: `{report.output_dir}`",
        f"- Ollama: `{report.ollama['provider']} / {report.ollama['model']}`",
        f"- Digest chat: `{report.ollama['chatDigest']}`",
        f"- Digest embedding: `{report.ollama['embeddingDigest']}`",
        f"- Hardware: `{report.hardware.get('platform')}`",
        "",
        "## Resumo por modo",
        "",
        "| Modo | Casos | Execuções | Casos aprovados | Execuções aprovadas | Recall tools | Sem violação | Scope | SourceKind | Artefato | Citações | Conclusão | p95 final | Gate |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|",
    ]
    for mode_summary in report.modes.values():
        lines.append(
            "| "
            + " | ".join(
                [
                    mode_summary.mode,
                    str(mode_summary.cases_total),
                    str(mode_summary.attempts_total),
                    str(mode_summary.case_pass_count),
                    str(mode_summary.attempt_pass_count),
                    f"{mode_summary.required_tool_recall:.3f}",
                    str(mode_summary.forbidden_tool_violation_count),
                    f"{mode_summary.scope_accuracy:.3f}",
                    f"{mode_summary.source_kind_accuracy:.3f}",
                    f"{mode_summary.artifact_accuracy:.3f}",
                    f"{mode_summary.citation_validity_rate:.3f}",
                    f"{mode_summary.conclusion_success_rate:.3f}",
                    str(mode_summary.final_p95_ms or 0),
                    mode_summary.gate_status,
                ]
            )
            + " |"
        )
    lines.extend(
        [
            "",
            "## Notas",
            "",
        ]
    )
    for mode_summary in report.modes.values():
        lines.append(f"- `{mode_summary.mode}`: " + "; ".join(mode_summary.gate_notes or ("sem notas adicionais",)))
    return "\n".join(lines) + "\n"


def _sanitize_report(report: Phase11EvaluationReport) -> dict[str, Any]:
    payload = asdict(report)
    payload["attempts"] = [asdict(attempt) for attempt in report.attempts]
    payload["modes"] = {mode: asdict(summary) for mode, summary in report.modes.items()}
    return payload


async def run_phase11_evaluation(
    *,
    corpus_path: Path = DEFAULT_CORPUS_PATH,
    output_dir: Path = DEFAULT_OUTPUT_DIR,
    database_url: str = DEFAULT_DATABASE_URL,
    uploads_dir: Path | None = None,
    vllm_url: str = DEFAULT_vllm_url,
    modes: Sequence[Literal["deterministic", "hybrid"]] = ("deterministic",),
    attempts_per_case: int = 3,
    seed_database_if_missing: bool = False,
    baseline_json_path: Path | None = None,
) -> Phase11EvaluationReport:
    if attempts_per_case <= 0:
        raise ValueError("attempts_per_case deve ser > 0.")
    cases = load_phase11_cases(corpus_path)
    if len(cases) != 210:
        raise ValueError(f"Corpus inesperado: {len(cases)} casos; esperado 210.")

    hardware = capture_hardware_snapshot()
    working_uploads_dir = uploads_dir or Path(tempfile.mkdtemp(prefix="silo-phase11-uploads-"))
    working_uploads_dir.mkdir(parents=True, exist_ok=True)

    combined_attempts: list[Phase11AttemptResult] = []
    mode_summaries: dict[str, Phase11ModeSummary] = {}
    baseline = _load_latency_baseline(baseline_json_path)
    settings_cache: dict[str, Settings] = {}
    engine = None

    try:
        for mode in modes:
            environ = _build_eval_environ(
                database_url=database_url,
                uploads_dir=working_uploads_dir,
                vllm_url=vllm_url,
                mode=mode,
            )
            settings = load_settings(environ)
            settings_cache[mode] = settings

            if engine is None:
                engine = create_engine(sqlalchemy_database_url(_settings_database_url(settings)), future=True, pool_pre_ping=True)

            probe = await probe_ai_runtime(settings)
            if probe.fallback_reason is not None:
                raise RuntimeError(probe.fallback_reason)
            if probe.model != EXPECTED_CHAT_MODEL:
                raise RuntimeError(f"Modelo de chat inesperado: {probe.model!r}.")

            model_runtime = create_model_runtime(settings)
            embedding_runtime = create_embedding_runtime(settings)

            with engine.connect() as connection:
                current_user = _resolve_eval_user(
                    connection,
                    seed_database_if_missing=seed_database_if_missing,
                    settings=settings,
                )

            mode_attempts: list[Phase11AttemptResult] = []
            for case in cases:
                for attempt in range(1, attempts_per_case + 1):
                    attempt_result, thread_id = await _run_case_attempt(
                        case=case,
                        attempt=attempt,
                        mode=mode,
                        settings=settings,
                        engine=engine,
                        current_user=current_user,
                        model_runtime=model_runtime,
                        embedding_runtime=embedding_runtime,
                        hardware=hardware,
                        model_digest=probe.chat_digest,
                        embedding_digest=probe.embedding_digest,
                    )
                    mode_attempts.append(attempt_result)
                    combined_attempts.append(attempt_result)
                    print(
                        json.dumps(
                            {
                                "mode": mode,
                                "caseId": case.id,
                                "attempt": attempt,
                                "ok": attempt_result.conclusion_ok
                                and attempt_result.scope_match
                                and attempt_result.trajectory_match
                                and attempt_result.required_tools_ok
                                and not attempt_result.forbidden_tool_violations
                                and attempt_result.source_kind_match
                                and attempt_result.dataset_manifest_ok
                                and attempt_result.artifact_match
                                and attempt_result.citations_valid,
                                "latencyMs": attempt_result.latency_ms,
                                "threadId": thread_id,
                            },
                            ensure_ascii=False,
                            sort_keys=True,
                        ),
                        flush=True,
                    )

            deterministic_final_p95_ms = None
            if mode == "hybrid":
                deterministic_summary = mode_summaries.get("deterministic")
                deterministic_final_p95_ms = deterministic_summary.final_p95_ms if deterministic_summary else None
            summary = _summarize_mode(
                mode=mode,
                attempts=mode_attempts,
                baseline_first_emission_p95_ms=baseline.get("firstEmissionP95Ms") if baseline else None,
                baseline_final_p95_ms=baseline.get("finalP95Ms") if baseline else None,
                deterministic_final_p95_ms=deterministic_final_p95_ms,
            )
            mode_summaries[mode] = summary

        generated_at = datetime.now(UTC).astimezone().isoformat().replace("+00:00", "Z")
        report = Phase11EvaluationReport(
            generated_at=generated_at,
            corpus_path=str(corpus_path),
            output_dir=str(output_dir),
            hardware=hardware,
            ollama={
                "provider": "ollama",
                "model": EXPECTED_CHAT_MODEL,
                "embeddingModel": EXPECTED_EMBEDDING_MODEL,
                "chatDigest": EXPECTED_CHAT_DIGEST,
                "embeddingDigest": EXPECTED_EMBEDDING_DIGEST,
                "baselineNode": baseline,
            },
            modes=mode_summaries,
            attempts=tuple(combined_attempts),
        )
        output_dir.mkdir(parents=True, exist_ok=True)
        _write_json(output_dir / "phase11-evaluation.sanitized.json", _sanitize_report(report))
        _write_text(output_dir / "phase11-evaluation.md", _render_summary_markdown(report))
        return report
    finally:
        if engine is not None:
            engine.dispose()
        try:
            if working_uploads_dir.exists():
                shutil.rmtree(working_uploads_dir, ignore_errors=True)
        except Exception:
            pass


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Executa a avaliação da Fase 11 com Ollama real.")
    parser.add_argument("--corpus-path", type=Path, default=DEFAULT_CORPUS_PATH)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--database-url", type=str, default=DEFAULT_DATABASE_URL)
    parser.add_argument("--uploads-dir", type=Path, default=None)
    parser.add_argument("--vllm-url", type=str, default=DEFAULT_vllm_url)
    parser.add_argument("--attempts-per-case", type=int, default=3)
    parser.add_argument("--mode", choices=("deterministic", "hybrid", "both"), default="deterministic")
    parser.add_argument("--baseline-json", type=Path, default=None)
    parser.add_argument("--seed-database-if-missing", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(sys.argv[1:] if argv is None else argv)
    if args.mode == "both":
        modes: tuple[Literal["deterministic", "hybrid"], ...] = ("deterministic", "hybrid")
    else:
        modes = (args.mode,)
    report = asyncio.run(
        run_phase11_evaluation(
            corpus_path=args.corpus_path,
            output_dir=args.output_dir,
            database_url=args.database_url,
            uploads_dir=args.uploads_dir,
            vllm_url=args.vllm_url,
            modes=modes,
            attempts_per_case=args.attempts_per_case,
            seed_database_if_missing=args.seed_database_if_missing,
            baseline_json_path=args.baseline_json,
        )
    )
    print(json.dumps(_sanitize_report(report), ensure_ascii=False, indent=2, sort_keys=True, default=_json_default))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
