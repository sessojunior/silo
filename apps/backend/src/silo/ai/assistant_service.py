from __future__ import annotations

import asyncio
import hashlib
import json
import re
import time
import uuid
from copy import deepcopy
from collections import OrderedDict
from collections.abc import AsyncIterator, Mapping
from dataclasses import asdict, dataclass
from datetime import UTC, timedelta
from typing import Any, Callable, Literal, cast

from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage
from langgraph.graph import END, START, StateGraph
from langgraph.runtime import Runtime
from sqlalchemy import delete, insert, select, update
from sqlalchemy.engine import Connection

from silo.ai.assistant_contracts import (
    AI_ASSISTANT_SCOPES,
    AiAssistantArtifactDto,
    AiAssistantCitationDto,
    AiAssistantCreateThreadResponseDto,
    AiAssistantExamplesResponseDto,
    AiAssistantExampleDto,
    AiAssistantGenerationDto,
    AiAssistantMessageRequestDto,
    AiAssistantMessageResponseDto,
    AiAssistantRuntimeStatusDto,
    AiAssistantThreadDetailResponseDto,
    AiAssistantThreadMessageDto,
    AiAssistantThreadSummaryDto,
    AiAssistantThreadsResponseDto,
    AiAssistantVisualizationChartDto,
    AiAssistantVisualizationDto,
    AiAssistantVisualizationImageDto,
    AiAssistantVisualizationMermaidDto,
)
from silo.ai.assistant_registry import AgentRuntimeContext, AgentState
from silo.ai.assistant_tool_catalog import execute_hybrid_tool, get_hybrid_tool_schemas
from silo.ai.assistant_runtime import (
    VLLMEmbeddingRuntime,
    VLLMModelRuntime,
    create_embedding_runtime,
    create_model_runtime,
    probe_ai_runtime,
)
from silo.ai.assistant_tools import (
    AI_METRIC_VERSION,
    AI_TOOL_CATALOG_VERSION,
    build_chart_spec,
    build_mermaid_diagram,
    compare_model_run_periods,
    compare_problem_periods,
    fuzzy_score,
    generate_report_pdf,
    get_availability_report_data,
    get_executive_report_data,
    get_model_run_history,
    get_projects_report_data,
    get_projects_snapshot,
    get_problems_report_data,
    list_model_interventions,
    list_model_runs,
    list_problematic_runs,
    list_registered_problems,
    normalize_text,
    render_summary_image,
    resolve_models,
    resolve_problem_categories,
    resolve_projects,
    search_silo_knowledge,
    summarize_model_runs,
    summarize_problems,
    token_overlap_score,
)
from silo.ai.embeddings import cosine_similarity
from silo.api.dependencies import CurrentUser
from silo.ai.ports import ChatMessage
from silo.clock import SYSTEM_CLOCK
from silo.config import Settings, load_settings
from silo.db.models import legacy_tables
from silo.db.serialization import serialize_legacy_row
from silo.services.ai_artifacts import (
    AI_ARTIFACT_PENDING,
    AI_ARTIFACT_READY,
    AiArtifactRepository,
)
from silo.services.pdf_artifacts import PdfArtifact
from silo.storage.uploads import get_upload_file_path, delete_upload_file

ASSISTANT_GRAPH_VERSION = "2026-07-23"
ASSISTANT_PROMPT_VERSION = "2026-07-23"
ASSISTANT_TOOL_VERSION = AI_TOOL_CATALOG_VERSION
ASSISTANT_METRIC_VERSION = AI_METRIC_VERSION
ASSISTANT_GRAPH_DEADLINE_SECONDS = 90
ASSISTANT_GUIDANCE = (
    "Pergunte sobre modelos, pendências, relatórios, problemas, soluções, projetos, "
    "gráficos, imagens, PDFs e análises operacionais do SILO."
)
ASSISTANT_SCOPE_POLICY = (
    "Responda de forma grounded, usando apenas dados autorizados do SILO e artefatos "
    "determinísticos quando necessário."
)

DEFAULT_ASSISTANT_EXAMPLES = (
    AiAssistantExampleDto(
        id="models",
        title="Modelos e rodadas",
        prompt="Quais modelos estão com menor disponibilidade nos últimos 30 dias?",
        description="Cruza disponibilidade, intervenções e histórico de execução.",
        scope="models",
    ),
    AiAssistantExampleDto(
        id="pending",
        title="Pendências",
        prompt="Quais pendências estão mais críticas agora?",
        description="Mostra projetos, tarefas e gargalos operacionais.",
        scope="pending",
    ),
    AiAssistantExampleDto(
        id="reports",
        title="Relatórios",
        prompt="O que eu preciso olhar primeiro para entender o cenário atual?",
        description="Resume os relatórios e os pontos de atenção do período.",
        scope="reports",
    ),
    AiAssistantExampleDto(
        id="problems",
        title="Problemas",
        prompt="Quais categorias de problema mais cresceram na última semana?",
        description="Cruza incidências, tendências e recorrência.",
        scope="problems",
    ),
    AiAssistantExampleDto(
        id="solutions",
        title="Soluções",
        prompt="Quais soluções parecem mais recorrentes para essas falhas?",
        description="Aponta padrões de correção e recorrência.",
        scope="solutions",
    ),
    AiAssistantExampleDto(
        id="projects",
        title="Projetos",
        prompt="Quais projetos estão mais atrasados e com mais tarefas abertas?",
        description="Foca em progresso, pendências e impacto operacional.",
        scope="projects",
    ),
)

_SCOPE_KEYWORDS: dict[str, tuple[str, ...]] = {
    "models": (
        "modelo",
        "modelos",
        "rodada",
        "rodadas",
        "turno",
        "turnos",
        "disponibilidade",
        "intervencao",
        "intervencoes",
        "execucao",
        "execucoes",
    ),
    "pending": (
        "pendencia",
        "pendencias",
        "pendente",
        "pendentes",
        "atraso",
        "atrasados",
        "tarefa",
        "tarefas",
        "bloqueio",
        "bloqueios",
    ),
    "reports": (
        "relatorio",
        "relatorios",
        "dashboard",
        "executivo",
        "visao geral",
        "sumario",
        "sumario executivo",
    ),
    "problems": (
        "problema",
        "problemas",
        "falha",
        "falhas",
        "incidente",
        "incidentes",
        "erro",
        "erros",
        "categoria",
        "categorias",
    ),
    "solutions": (
        "solucao",
        "solucoes",
        "resolver",
        "correcao",
        "correcoes",
        "recorrente",
        "recorrentes",
    ),
    "projects": (
        "projeto",
        "projetos",
        "atividade",
        "atividades",
        "cronograma",
        "prioridade",
        "prioridades",
        "andamento",
    ),
    "general": (),
    "generate_pdf": (
        "pdf",
        "exportar pdf",
        "gerar pdf",
        "baixar pdf",
        "imprimir pdf",
    ),
}

_PRESENTATION_KEYWORDS: dict[str, tuple[str, ...]] = {
    "chart": ("grafico", "gráfico", "chart", "plot", "visualizacao", "visualização", "tabela"),
    "image": ("imagem", "figura", "ilustracao", "ilustração", "visual", "resumo visual"),
    "mermaid": ("mermaid", "diagrama", "fluxo", "fluxograma", "mapa", "grafo"),
    "pdf": ("pdf", "relatorio pdf", "relatório pdf", "exportar", "baixar", "download"),
}

_REPORT_TYPE_HINTS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("availability", ("disponibilidade", "modelo", "rodada", "turno", "intervenção", "intervencao")),
    ("problems", ("problema", "falha", "erro", "incidente", "solução", "solucao")),
    ("projects", ("projeto", "atividade", "task", "cronograma", "pendência", "pendencia")),
    ("executive", ("executivo", "geral", "resumo", "sumário", "sumario")),
)

MAX_THREAD_MESSAGES = 25
_SEMANTIC_CACHE_MAX_SIZE = 64
_SEMANTIC_CACHE_TTL_SECONDS = 6 * 60 * 60
_SEMANTIC_CACHE: OrderedDict[str, dict[str, Any]] = OrderedDict()


class AssistantThreadNotFoundError(RuntimeError):
    pass


class AssistantMessageConflictError(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class AssistantStreamEvent:
    event: str
    data: dict[str, Any]


@dataclass(frozen=True, slots=True)
class AssistantPlan:
    scope: str
    confidence: float
    presentation_intent: Literal["chart", "image", "mermaid", "pdf", "text"]
    date_range: dict[str, str]
    report_type: str | None
    required_sources: tuple[str, ...]
    include_comparison: bool
    include_knowledge_search: bool
    resolved_entities: dict[str, Any]
    cache_eligible: bool


_CANONICAL_TRAJECTORY_MAP: dict[str, tuple[str, ...]] = {
    "guard_and_normalize": ("normalize_question",),
    "classify_and_plan": ("classify_scope", "build_and_validate_plan"),
    "claim_pdf_idempotency_if_needed": ("claim_pdf_idempotency_if_needed",),
    "load_persisted_result": ("load_persisted_result",),
    "semantic_cache_if_text_only": ("semantic_cache_if_text_only",),
    "resolve_entities": ("resolve_entities",),
    "build_refusal": ("refuse_out_of_scope",),
    "build_clarification": ("build_clarification",),
    "execute_required_data_tools": ("execute_required_data_tools",),
    "agent_decide": ("agent_decide",),
    "analyze_and_register_datasets": ("build_grounded_response",),
    "presentation_router": ("presentation_router",),
    "synthesize_once": ("synthesize_answer",),
    "validate_output_citations_and_artifacts": ("verify_response",),
    "persist_transaction": ("persist_transaction",),
    "emit_result": ("emit_result",),
}


def get_assistant_examples() -> AiAssistantExamplesResponseDto:
    return AiAssistantExamplesResponseDto(
        guidance=ASSISTANT_GUIDANCE,
        scope_policy=ASSISTANT_SCOPE_POLICY,
        examples=list(DEFAULT_ASSISTANT_EXAMPLES),
    )


async def get_assistant_runtime_status(*, clock=SYSTEM_CLOCK) -> AiAssistantRuntimeStatusDto:
    try:
        settings = load_settings()
    except Exception as exc:
        checked_at = clock.now().astimezone(UTC).isoformat().replace("+00:00", "Z")
        return AiAssistantRuntimeStatusDto(
            provider="vllm",
            model="unknown",
            mode="fallback",
            latency_ms=0,
            checked_at=checked_at,
            fallback_reason=str(exc),
        )

    probe = await probe_ai_runtime(settings, clock=clock)
    return AiAssistantRuntimeStatusDto(
        provider=probe.provider,
        model=probe.model,
        mode=probe.mode.value if probe.mode != "fallback" else "fallback",
        latency_ms=probe.latency_ms,
        checked_at=probe.checked_at,
        fallback_reason=probe.fallback_reason,
    )


def list_assistant_threads(connection: Connection, user_id: str) -> AiAssistantThreadsResponseDto:
    thread_table = legacy_tables["ai_assistant_thread"]
    rows = connection.execute(
        select(thread_table).where(thread_table.c.user_id == user_id).order_by(
            thread_table.c.updated_at.desc(),
            thread_table.c.last_message_at.desc(),
            thread_table.c.created_at.desc(),
        )
    ).mappings().all()
    return AiAssistantThreadsResponseDto(
        threads=[_thread_summary_from_row(row) for row in rows],
    )


def create_assistant_thread(
    connection: Connection,
    user_id: str,
    *,
    title: str | None = None,
) -> AiAssistantCreateThreadResponseDto:
    thread_table = legacy_tables["ai_assistant_thread"]
    now = SYSTEM_CLOCK.now().astimezone().replace(tzinfo=None)
    thread_id = str(uuid.uuid4())
    row = {
        "id": thread_id,
        "user_id": user_id,
        "title": (title or "Nova conversa").strip()[:120] or "Nova conversa",
        "last_message_preview": "",
        "message_count": 0,
        "last_message_at": now,
        "created_at": now,
        "updated_at": now,
    }
    connection.execute(insert(thread_table).values(row))
    connection.commit()
    return AiAssistantCreateThreadResponseDto(thread=_thread_summary_from_row(row))


def get_assistant_thread_details(
    connection: Connection,
    user_id: str,
    thread_id: str,
) -> AiAssistantThreadDetailResponseDto | None:
    thread_row = _load_thread_row(connection, user_id, thread_id)
    if thread_row is None:
        return None

    message_table = legacy_tables["ai_assistant_message"]
    rows = connection.execute(
        select(message_table)
        .where(message_table.c.thread_id == thread_row["id"])
        .order_by(
            message_table.c.created_at.desc(),
            message_table.c.id.desc(),
        )
        .limit(MAX_THREAD_MESSAGES)
    ).mappings().all()
    rows = list(reversed(rows))
    return AiAssistantThreadDetailResponseDto(
        thread=_thread_summary_from_row(thread_row),
        messages=[_thread_message_from_row(row) for row in rows],
    )


def delete_assistant_message(
    connection: Connection,
    user_id: str,
    thread_id: str,
    message_id: str,
) -> None:
    thread_row = _load_thread_row(connection, user_id, thread_id)
    if thread_row is None:
        raise AssistantThreadNotFoundError("Conversa não encontrada.")

    message_table = legacy_tables["ai_assistant_message"]
    artifact_table = legacy_tables["ai_assistant_artifact"]
    message_row = connection.execute(
        select(message_table).where(
            message_table.c.id == message_id,
            message_table.c.thread_id == thread_id,
        ).limit(1)
    ).mappings().first()
    if message_row is None:
        raise AssistantThreadNotFoundError("Mensagem não encontrada.")

    artifact_rows = connection.execute(
        select(artifact_table).where(artifact_table.c.message_id == message_id)
    ).mappings().all()
    for artifact_row in artifact_rows:
        _delete_artifact_file_if_present(artifact_row)

    connection.execute(delete(artifact_table).where(artifact_table.c.message_id == message_id))
    connection.execute(delete(message_table).where(message_table.c.id == message_id))
    _recalculate_thread_state(connection, thread_id)
    connection.commit()


def delete_assistant_thread(
    connection: Connection,
    user_id: str,
    thread_id: str,
) -> None:
    thread_row = _load_thread_row(connection, user_id, thread_id)
    if thread_row is None:
        raise AssistantThreadNotFoundError("Conversa não encontrada.")

    message_table = legacy_tables["ai_assistant_message"]
    artifact_table = legacy_tables["ai_assistant_artifact"]
    message_rows = connection.execute(
        select(message_table.c.id).where(message_table.c.thread_id == thread_id)
    ).all()
    for message_row in message_rows:
        message_id = str(message_row[0])
        artifact_rows = connection.execute(
            select(artifact_table).where(artifact_table.c.message_id == message_id)
        ).mappings().all()
        for artifact_row in artifact_rows:
            _delete_artifact_file_if_present(artifact_row)
    connection.execute(delete(artifact_table).where(artifact_table.c.thread_id == thread_id))
    connection.execute(delete(message_table).where(message_table.c.thread_id == thread_id))
    connection.execute(delete(legacy_tables["ai_assistant_thread"]).where(legacy_tables["ai_assistant_thread"].c.id == thread_id))
    connection.commit()


async def send_assistant_message(
    connection: Connection,
    current_user: CurrentUser,
    request: AiAssistantMessageRequestDto,
    *,
    request_id: str | None = None,
    settings: Settings | None = None,
    model_runtime: VLLMModelRuntime | None = None,
    embedding_provider: VLLMEmbeddingRuntime | None = None,
) -> AiAssistantMessageResponseDto:
    runtime_context = _build_runtime_context(
        connection,
        current_user,
        request_id=request_id or str(uuid.uuid4()),
        settings=settings,
        model_runtime=model_runtime,
        embedding_provider=embedding_provider,
    )
    try:
        result = await get_assistant_graph().ainvoke(
            _initial_state(request, runtime_context),
            context=runtime_context,
        )
        return AiAssistantMessageResponseDto.model_validate(result["final_response"])
    finally:
        runtime_context.dataset_registry.clear()


async def stream_assistant_message(
    connection: Connection,
    current_user: CurrentUser,
    request: AiAssistantMessageRequestDto,
    *,
    request_id: str | None = None,
    settings: Settings | None = None,
    model_runtime: VLLMModelRuntime | None = None,
    embedding_provider: VLLMEmbeddingRuntime | None = None,
) -> AsyncIterator[AssistantStreamEvent]:
    yield AssistantStreamEvent(event="thinking", data={"content": "Processando solicitação com as tools autorizadas."})
    response = await send_assistant_message(
        connection,
        current_user,
        request,
        request_id=request_id,
        settings=settings,
        model_runtime=model_runtime,
        embedding_provider=embedding_provider,
    )
    yield AssistantStreamEvent(
        event="scope",
        data={"scope": response.scope, "isInScope": response.is_in_scope},
    )
    yield AssistantStreamEvent(event="result", data=response.model_dump(mode="json"))


def get_assistant_graph():
    return _COMPILED_GRAPH


def _build_runtime_context(
    connection: Connection,
    current_user: CurrentUser,
    *,
    request_id: str,
    settings: Settings | None,
    model_runtime: VLLMModelRuntime | None,
    embedding_provider: VLLMEmbeddingRuntime | None,
) -> AgentRuntimeContext:
    effective_settings = settings or load_settings()
    runtime = AgentRuntimeContext(
        connection=connection,
        current_user=current_user,
        request_id=request_id,
        run_id=str(uuid.uuid4()),
        settings=effective_settings,
        model_runtime=model_runtime or create_model_runtime(effective_settings),
        embedding_provider=embedding_provider or create_embedding_runtime(effective_settings),
        connection_factory=(lambda: connection.engine.connect()),
        mode=cast(Literal["deterministic", "hybrid"], effective_settings.ai_agent_mode.value),
        group_permissions=("reports:view",),
        has_reports_permission=True,
    )
    return runtime


def _initial_state(
    request: AiAssistantMessageRequestDto,
    runtime_context: AgentRuntimeContext,
) -> AgentState:
    thread_id = request.thread_id or str(uuid.uuid4())
    started_at_epoch_ms = _current_epoch_ms()
    return {
        "request_id": runtime_context.request_id,
        "run_id": runtime_context.run_id,
        "thread_id": thread_id,
        "started_at_epoch_ms": started_at_epoch_ms,
        "deadline_epoch_ms": started_at_epoch_ms + (ASSISTANT_GRAPH_DEADLINE_SECONDS * 1000),
        "question": request.content,
        "history_messages": [],
        "conversation_memory": "",
        "last_known_scope": "general",
        "dataset_manifests": [],
        "required_results": {},
        "supplemental_results": {},
        "artifact_intent": {},
        "artifact_result": {},
        "cache_hit": False,
        "cache_key": "",
        "response_base": "",
        "answer": "",
        "synthesis_context_summary": "",
        "final_response": {},
        "citations": [],
        "suggested_questions": [],
        "visualization": {},
        "generation": {},
        "prompt_eval_count": 0,
        "observability": _initial_observability(runtime_context),
        "progress": [],
        "errors": [],
        "remaining_steps": 24,
        "mode": runtime_context.mode,
    }


def _build_runtime_context_from_state(state: AgentState, runtime: Runtime[AgentRuntimeContext]) -> AgentRuntimeContext:
    return runtime.context


def _thread_summary_from_row(row: dict[str, Any]) -> AiAssistantThreadSummaryDto:
    row_data = serialize_legacy_row(row)
    return AiAssistantThreadSummaryDto(
        id=str(row_data["id"]),
        title=str(row_data["title"]),
        last_message_preview=str(row_data.get("lastMessagePreview") or ""),
        message_count=int(row_data.get("messageCount") or 0),
        last_message_at=str(row_data.get("lastMessageAt") or ""),
        created_at=str(row_data.get("createdAt") or ""),
        updated_at=str(row_data.get("updatedAt") or ""),
    )


def _thread_message_from_row(row: dict[str, Any]) -> AiAssistantThreadMessageDto:
    payload = serialize_legacy_row(row)
    metadata = payload.get("metadata")
    generation = _safe_model_validate_generation(metadata)
    visualization = _safe_model_validate_visualization(metadata)
    artifacts = _safe_model_validate_artifacts(metadata)
    thinking = _optional_text(_safe_nested_value(metadata, "thinking"))
    return AiAssistantThreadMessageDto(
        id=str(payload["id"]),
        thread_id=str(payload["threadId"]),
        sender_type=str(payload["senderType"]),
        sender_user_id=_optional_text(payload.get("senderUserId")),
        sender_name=str(payload["senderName"]),
        content=str(payload["content"]),
        thinking=thinking,
        generation=generation,
        visualization=visualization,
        artifacts=artifacts,
        created_at=str(payload["createdAt"]),
    )


def _safe_model_validate_generation(metadata: object) -> AiAssistantGenerationDto | None:
    if not isinstance(metadata, dict):
        return None
    generation = metadata.get("generation")
    if isinstance(generation, dict):
        try:
            return AiAssistantGenerationDto.model_validate(generation)
        except Exception:
            return None
    return None


def _safe_model_validate_visualization(metadata: object) -> AiAssistantVisualizationDto | None:
    if not isinstance(metadata, dict):
        return None
    visualization = metadata.get("visualization")
    if isinstance(visualization, dict):
        try:
            return _validate_visualization_payload(visualization)
        except Exception:
            return None
    return None


def _safe_model_validate_artifacts(metadata: object) -> list[AiAssistantArtifactDto] | None:
    if not isinstance(metadata, dict):
        return None

    artifacts = metadata.get("artifacts")
    if not isinstance(artifacts, list) or not artifacts:
        return None

    validated_artifacts: list[AiAssistantArtifactDto] = []
    for artifact in artifacts:
        if not isinstance(artifact, dict):
            continue
        try:
            validated_artifacts.append(AiAssistantArtifactDto.model_validate(artifact))
        except Exception:
            continue

    return validated_artifacts or None


def _safe_nested_value(metadata: object, key: str) -> object | None:
    if isinstance(metadata, dict):
        return metadata.get(key)
    return None


def _validate_visualization_payload(value: dict[str, Any]) -> AiAssistantVisualizationDto:
    kind = value.get("kind")
    if kind == "chart":
        return AiAssistantVisualizationChartDto.model_validate(value)
    if kind == "image":
        return AiAssistantVisualizationImageDto.model_validate(value)
    if kind == "mermaid":
        return AiAssistantVisualizationMermaidDto.model_validate(value)
    raise ValueError("Visualization inválida.")


def _optional_text(value: object | None) -> str | None:
    if isinstance(value, str):
        text = value.strip()
        return text or None
    return None


def _get_thread_or_create(connection: Connection, current_user: CurrentUser, thread_id: str | None) -> dict[str, Any]:
    if thread_id:
        thread_row = _load_thread_row(connection, current_user.id, thread_id)
        if thread_row is None:
            raise AssistantThreadNotFoundError("Conversa não encontrada.")
        return thread_row

    thread_table = legacy_tables["ai_assistant_thread"]
    now = SYSTEM_CLOCK.now().astimezone().replace(tzinfo=None)
    new_thread = {
        "id": str(uuid.uuid4()),
        "user_id": current_user.id,
        "title": "Nova conversa",
        "last_message_preview": "",
        "message_count": 0,
        "last_message_at": now,
        "created_at": now,
        "updated_at": now,
    }
    connection.execute(insert(thread_table).values(new_thread))
    connection.commit()
    return new_thread


def _load_thread_row(connection: Connection, user_id: str, thread_id: str) -> dict[str, Any] | None:
    thread_table = legacy_tables["ai_assistant_thread"]
    row = connection.execute(
        select(thread_table).where(thread_table.c.id == thread_id, thread_table.c.user_id == user_id).limit(1)
    ).mappings().first()
    return dict(row) if row is not None else None


def _load_thread_row_by_id(connection: Connection, thread_id: str) -> dict[str, Any] | None:
    thread_table = legacy_tables["ai_assistant_thread"]
    row = connection.execute(select(thread_table).where(thread_table.c.id == thread_id).limit(1)).mappings().first()
    return dict(row) if row is not None else None


def _recalculate_thread_state(connection: Connection, thread_id: str) -> None:
    thread_table = legacy_tables["ai_assistant_thread"]
    message_table = legacy_tables["ai_assistant_message"]
    rows = connection.execute(
        select(message_table.c.content, message_table.c.created_at)
        .where(message_table.c.thread_id == thread_id)
        .order_by(message_table.c.created_at.desc(), message_table.c.id.desc())
        .limit(1)
    ).mappings().first()
    message_count = connection.execute(
        select(message_table.c.id).where(message_table.c.thread_id == thread_id)
    ).all()
    last_message_preview = ""
    last_message_at = SYSTEM_CLOCK.now().astimezone().replace(tzinfo=None)
    if rows is not None:
        last_message_preview = str(rows["content"])[:140]
        last_message_at = rows["created_at"]  # type: ignore[assignment]
    connection.execute(
        update(thread_table)
        .where(thread_table.c.id == thread_id)
        .values(
            message_count=len(message_count),
            last_message_preview=last_message_preview,
            last_message_at=last_message_at,
            updated_at=SYSTEM_CLOCK.now().astimezone().replace(tzinfo=None),
        )
    )


def _prune_thread_messages(connection: Connection, thread_id: str) -> None:
    message_table = legacy_tables["ai_assistant_message"]
    artifact_table = legacy_tables["ai_assistant_artifact"]
    rows = connection.execute(
        select(message_table.c.id)
        .where(message_table.c.thread_id == thread_id)
        .order_by(message_table.c.created_at.asc(), message_table.c.id.asc())
    ).all()
    excess = len(rows) - MAX_THREAD_MESSAGES
    if excess <= 0:
        return

    for row in rows[:excess]:
        message_id = str(row[0])
        artifact_rows = connection.execute(
            select(artifact_table).where(artifact_table.c.message_id == message_id)
        ).mappings().all()
        for artifact_row in artifact_rows:
            _delete_artifact_file_if_present(artifact_row)
        connection.execute(delete(artifact_table).where(artifact_table.c.message_id == message_id))
        connection.execute(delete(message_table).where(message_table.c.id == message_id))


def _delete_artifact_file_if_present(artifact_row: dict[str, Any]) -> None:
    filename = _optional_text(artifact_row.get("filename"))
    if not filename:
        return
    if artifact_row.get("kind") == "pdf":
        delete_upload_file("reports", filename)


def _hash_json(payload: object) -> str:
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _scope_candidates(question: str) -> list[tuple[str, float]]:
    normalized = normalize_text(question)
    scores: list[tuple[str, float]] = []
    for scope in AI_ASSISTANT_SCOPES:
        keywords = _SCOPE_KEYWORDS.get(scope, ())
        score = 0.0
        for keyword in keywords:
            if keyword in normalized:
                score += 2.0
            else:
                score += max(fuzzy_score(normalized, keyword), token_overlap_score(normalized, keyword))
        if scope == "general":
            score += 0.1
        scores.append((scope, score))
    scores.sort(key=lambda item: (-item[1], item[0]))
    return scores


async def _detect_scope(question: str, runtime_context: AgentRuntimeContext) -> tuple[str, float]:
    keyword_scores = _scope_candidates(question)
    top_scope, top_score = keyword_scores[0]
    runner_up_score = keyword_scores[1][1] if len(keyword_scores) > 1 else 0.0
    if top_score >= 2.0 and (top_score - runner_up_score) >= 0.75:
        return top_scope, min(1.0, 0.6 + (top_score / 8.0))

    embedding_scope = await _detect_scope_by_embedding(question, runtime_context)
    if embedding_scope is not None:
        return embedding_scope, 0.7

    if top_score >= 0.25 or runner_up_score >= 0.2:
        model_scope = await _detect_scope_by_model(question, runtime_context, keyword_scores)
        if model_scope is not None:
            return model_scope, 0.65

    return "general", 0.4


async def _detect_scope_by_embedding(question: str, runtime_context: AgentRuntimeContext) -> str | None:
    scope_profiles = {
        "models": "disponibilidade de modelos, rodadas, intervenções e execução operacional",
        "pending": "pendências, tarefas, gargalos, bloqueios e atrasos",
        "reports": "relatórios executivos, disponibilidade, problemas e projetos",
        "problems": "problemas, falhas, incidentes e categorias recorrentes",
        "solutions": "soluções, correções e recorrência de falhas",
        "projects": "projetos, atividades, progresso e prazos",
    }

    try:
        query_embedding = await runtime_context.embedding_provider.embed(question)
    except Exception:
        query_embedding = None

    if query_embedding is None:
        return None

    best_scope = None
    best_score = 0.0
    for scope, description in scope_profiles.items():
        try:
            profile_embedding = await runtime_context.embedding_provider.embed(description)
        except Exception:
            continue
        score = cosine_similarity(list(query_embedding), list(profile_embedding))
        if score > best_score:
            best_score = score
            best_scope = scope

    if best_scope is not None and best_score >= 0.35:
        return best_scope
    return None


async def _detect_scope_by_model(
    question: str,
    runtime_context: AgentRuntimeContext,
    keyword_scores: list[tuple[str, float]],
) -> str | None:
    if not hasattr(runtime_context.model_runtime, "complete"):
        return None

    allowed_scopes = [scope for scope in AI_ASSISTANT_SCOPES if scope != "generate_pdf"]
    payload = {
        "question": question,
        "allowedScopes": allowed_scopes,
        "keywordRankings": keyword_scores[:4],
        "instruction": "Retorne apenas JSON válido com scope e confidence.",
    }
    try:
        response = await runtime_context.model_runtime.complete(
            [
                ChatMessage(
                    role="system",
                    content="Classifique a pergunta em um scope do SILO. Não use ferramentas e não responda o usuário.",
                ),
                ChatMessage(role="user", content=json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)),
            ]
        )
    except Exception:
        return None

    data = _parse_model_scope_response(response.content)
    if data is None:
        return None
    scope = str(data.get("scope") or "").strip()
    if scope not in allowed_scopes:
        return None
    return scope


def _detect_presentation_intent(question: str) -> Literal["chart", "image", "mermaid", "pdf", "text"]:
    normalized = normalize_text(question)
    for kind, keywords in _PRESENTATION_KEYWORDS.items():
        if any(keyword in normalized for keyword in keywords):
            return kind  # type: ignore[return-value]
    return "text"


def _detect_date_range(question: str) -> dict[str, str]:
    normalized = normalize_text(question)
    end_date = SYSTEM_CLOCK.now().astimezone(UTC).date()
    if "anteontem" in normalized:
        start = end = end_date - timedelta(days=2)
    elif "ontem" in normalized or "24h" in normalized or "24 horas" in normalized:
        start = end = end_date - timedelta(days=1)
    elif "hoje" in normalized:
        start = end = end_date
    elif any(token in normalized for token in ("7 dias", "ultimos 7 dias", "ultimas 7 dias", "semana passada")):
        start = end_date - timedelta(days=6)
        end = end_date
    elif any(token in normalized for token in ("15 dias", "quinzena")):
        start = end_date - timedelta(days=14)
        end = end_date
    elif any(token in normalized for token in ("90 dias", "3 meses", "trimestre")):
        start = end_date - timedelta(days=89)
        end = end_date
    else:
        start = end_date - timedelta(days=29)
        end = end_date
    return {"start": start.isoformat(), "end": end.isoformat()}


def _select_report_type(question: str, scope: str) -> str:
    if scope == "generate_pdf":
        normalized = normalize_text(question)
        for report_type, keywords in _REPORT_TYPE_HINTS:
            if any(keyword in normalized for keyword in keywords):
                return report_type
        return "executive"
    if scope == "models":
        return "availability"
    if scope == "projects":
        return "projects"
    if scope == "problems":
        return "problems"
    return "executive"


async def _plan_from_question(question: str, runtime_context: AgentRuntimeContext, state: AgentState) -> AssistantPlan:
    scope, confidence = await _detect_scope(question, runtime_context)
    presentation_intent = _detect_presentation_intent(question)
    date_range = _detect_date_range(question)
    report_type = _select_report_type(question, scope)
    include_comparison = any(token in normalize_text(question) for token in ("compar", "antes", "depois", "delta", "variação", "variacao"))
    include_knowledge_search = scope in {"problems", "solutions", "general"}
    cache_eligible = presentation_intent == "text"
    entities = _resolve_entities(question, scope, runtime_context.connection)
    return AssistantPlan(
        scope=scope,
        confidence=confidence,
        presentation_intent=presentation_intent,
        date_range=date_range,
        report_type=report_type,
        required_sources=_required_sources_for_scope(scope),
        include_comparison=include_comparison,
        include_knowledge_search=include_knowledge_search,
        resolved_entities=entities,
        cache_eligible=cache_eligible,
    )


def _required_sources_for_scope(scope: str) -> tuple[str, ...]:
    mapping = {
        "models": ("model_runs", "availability_report"),
        "pending": ("projects_snapshot", "projects_report"),
        "reports": ("executive_report", "availability_report", "problems_report", "projects_report"),
        "problems": ("problems_report", "problems_detail", "knowledge_search"),
        "solutions": ("problems_report", "problems_detail", "knowledge_search"),
        "projects": ("projects_snapshot", "projects_report"),
        "general": ("executive_report", "availability_report", "problems_report", "projects_report"),
        "generate_pdf": ("report_pdf",),
    }
    return mapping.get(scope, ("executive_report",))


def _resolve_entities(question: str, scope: str, connection: Connection) -> dict[str, Any]:
    if scope == "models":
        result = resolve_models(connection, question)
        return {"models": result}
    if scope == "projects":
        result = resolve_projects(connection, question)
        return {"projects": result}
    if scope in {"problems", "solutions", "generate_pdf", "reports"}:
        result = resolve_problem_categories(connection, question)
        return {"problemCategories": result}
    return {}


async def _node_guard_and_normalize(state: AgentState, runtime: Runtime[AgentRuntimeContext]) -> AgentState:
    question = _optional_text(state.get("question")) or ""
    normalized_question = question.strip()
    progress = list(state.get("progress", []))
    progress.append("guard_and_normalize")
    if not normalized_question:
        state["refusal_reason"] = "A pergunta está vazia."
        state["answer"] = "Não consegui processar uma pergunta vazia."
        state["final_response"] = _build_response_from_state(state, runtime.context, refusal=True)
        state["progress"] = progress
        return state
    if len(normalized_question) > 4000:
        state["refusal_reason"] = "A pergunta excede o limite permitido."
        state["answer"] = "A pergunta excede o limite permitido."
        state["final_response"] = _build_response_from_state(state, runtime.context, refusal=True)
        state["progress"] = progress
        return state

    thread_row = _get_thread_or_create(runtime.context.connection, runtime.context.current_user, state.get("thread_id"))
    state["thread_id"] = str(thread_row["id"])
    state["history_messages"] = _load_recent_history(runtime.context.connection, state["thread_id"])
    state["conversation_memory"] = _build_conversation_memory(state["history_messages"])
    state["last_known_scope"] = _infer_last_scope(state["history_messages"]) or "general"
    state["question"] = normalized_question
    state["normalized_question"] = normalized_question
    state["progress"] = progress
    return state


async def _node_classify_and_plan(state: AgentState, runtime: Runtime[AgentRuntimeContext]) -> AgentState:
    progress = list(state.get("progress", []))
    progress.append("classify_and_plan")
    if state.get("final_response"):
        state["progress"] = progress
        return state

    plan = await _plan_from_question(state["question"], runtime.context, state)
    state["scope"] = plan.scope
    state["confidence"] = plan.confidence
    state["is_in_scope"] = True
    state["execution_plan"] = asdict(plan)
    state["entities"] = plan.resolved_entities
    state["ranges"] = plan.date_range
    state["source_kinds"] = list(plan.required_sources)
    state["artifact_intent"] = {
        "kind": plan.presentation_intent,
        "reportType": plan.report_type,
    }
    state["cache_key"] = _semantic_cache_key(state, runtime.context, plan)
    state.setdefault("observability", {})["scope"] = plan.scope
    state["observability"]["cacheHit"] = False
    state["progress"] = progress
    return state


async def _node_claim_pdf_idempotency_if_needed(
    state: AgentState,
    runtime: Runtime[AgentRuntimeContext],
) -> AgentState:
    progress = list(state.get("progress", []))
    progress.append("claim_pdf_idempotency_if_needed")
    state["progress"] = progress
    if state.get("final_response"):
        return state
    if state.get("artifact_intent", {}).get("kind") != "pdf":
        state["artifact_result"] = {"status": "not_requested"}
        return state

    report_type = str(state.get("artifact_intent", {}).get("reportType") or "executive")
    request_fingerprint = _hash_json(
        {
            "userId": runtime.context.current_user.id,
            "scope": state.get("scope"),
            "reportType": report_type,
            "question": state.get("question"),
            "range": state.get("ranges"),
            "entities": state.get("entities"),
            "graphVersion": ASSISTANT_GRAPH_VERSION,
            "promptVersion": ASSISTANT_PROMPT_VERSION,
            "toolVersion": ASSISTANT_TOOL_VERSION,
        }
    )
    idempotency_hash = _hash_json(
        {
            "userId": runtime.context.current_user.id,
            "threadId": state.get("thread_id"),
            "reportType": report_type,
            "question": state.get("question"),
            "range": state.get("ranges"),
        }
    )
    repository = AiArtifactRepository(runtime.context.connection)
    claim = repository.claim(
        idempotency_hash=idempotency_hash,
        user_id=runtime.context.current_user.id,
        thread_id=state.get("thread_id"),
        report_type=report_type,
        request_fingerprint=request_fingerprint,
        metric_version=ASSISTANT_METRIC_VERSION,
    )
    if isinstance(claim, dict):
        if str(claim.get("status")) == AI_ARTIFACT_READY:
            state["artifact_result"] = {"status": "attached_hit", "artifact": claim}
            state["final_response"] = _load_persisted_response_from_artifact(runtime.context.connection, claim, state)
            return state
        if str(claim.get("status")) == AI_ARTIFACT_PENDING:
            state["artifact_result"] = {"status": "conflict", "artifact": claim}
            state["refusal_reason"] = "Já existe uma geração de PDF em andamento para este pedido."
            state["final_response"] = _build_response_from_state(state, runtime.context, refusal=True)
            return state
        state["artifact_result"] = {"status": "existing", "artifact": claim}
        return state

    state["artifact_result"] = {
        "status": "claimed",
        "idempotencyHash": claim.idempotency_hash,
        "ownerToken": claim.owner_token,
        "leaseExpiresAt": claim.lease_expires_at,
        "filename": claim.filename,
        "relativePath": claim.relative_path,
        "url": claim.url,
        "reportType": report_type,
        "requestFingerprint": request_fingerprint,
    }
    return state


async def _node_load_persisted_result(
    state: AgentState,
    runtime: Runtime[AgentRuntimeContext],
) -> AgentState:
    progress = list(state.get("progress", []))
    progress.append("load_persisted_result")
    state["progress"] = progress
    artifact_row = _artifact_row(state)
    if artifact_row is None:
        state["final_response"] = _build_response_from_state(state, runtime.context, refusal=True)
        return state
    state["final_response"] = _load_persisted_response_from_artifact(runtime.context.connection, artifact_row, state)
    return state


async def _node_semantic_cache_if_text_only(
    state: AgentState,
    runtime: Runtime[AgentRuntimeContext],
) -> AgentState:
    progress = list(state.get("progress", []))
    progress.append("semantic_cache_if_text_only")
    state["progress"] = progress
    if state.get("final_response"):
        return state
    if not bool(state.get("cache_eligible", True)):
        return state
    if not bool(state.get("cache_key")):
        return state
    if state.get("history_messages"):
        return state

    cached = _SEMANTIC_CACHE.get(str(state["cache_key"]))
    if cached is None:
        return state

    cached_at = int(cached.get("cachedAtEpochMs") or 0)
    now_ms = int(time.time() * 1000)
    if cached_at <= 0 or (now_ms - cached_at) > (_SEMANTIC_CACHE_TTL_SECONDS * 1000):
        _SEMANTIC_CACHE.pop(str(state["cache_key"]), None)
        return state

    _SEMANTIC_CACHE.move_to_end(str(state["cache_key"]))
    state["cache_hit"] = True
    state.setdefault("observability", {})["cacheHit"] = True
    response = deepcopy(cached.get("response") or {})
    generation = dict(response.get("generation") or {})
    generation.update(
        {
            "provider": "cache",
            "model": "semantic-cache",
            "status": "success",
            "latencyMs": 0,
            "generatedTokens": None,
            "thinkingTimeMs": None,
            "errorMessage": None,
        }
    )
    response["generation"] = generation
    state["final_response"] = response
    state["answer"] = str(response.get("answer") or "")
    state["citations"] = list(response.get("citations") or [])
    state["suggested_questions"] = list(response.get("suggestedQuestions") or [])
    state["visualization"] = response.get("visualization") or {}
    state["generation"] = generation
    return state


async def _node_resolve_entities(state: AgentState, runtime: Runtime[AgentRuntimeContext]) -> AgentState:
    progress = list(state.get("progress", []))
    progress.append("resolve_entities")
    state["progress"] = progress
    if state.get("final_response"):
        return state

    entities = dict(state.get("entities") or {})
    clarification = _build_clarification_from_entities(entities, state["scope"] or "general")
    if clarification is not None:
        state["clarification"] = clarification
        state["final_response"] = _build_response_from_state(state, runtime.context, clarification=True)
    return state


async def _node_build_refusal(state: AgentState, runtime: Runtime[AgentRuntimeContext]) -> AgentState:
    progress = list(state.get("progress", []))
    progress.append("build_refusal")
    state["progress"] = progress
    state["final_response"] = _build_response_from_state(state, runtime.context, refusal=True)
    return state


async def _node_build_clarification(state: AgentState, runtime: Runtime[AgentRuntimeContext]) -> AgentState:
    progress = list(state.get("progress", []))
    progress.append("build_clarification")
    state["progress"] = progress
    state["final_response"] = _build_response_from_state(state, runtime.context, clarification=True)
    return state


async def _node_execute_required_data_tools(
    state: AgentState,
    runtime: Runtime[AgentRuntimeContext],
) -> AgentState:
    progress = list(state.get("progress", []))
    progress.append("execute_required_data_tools")
    state["progress"] = progress
    if state.get("final_response"):
        return state
    if _graph_budget_guard(state, note="execute_required_data_tools"):
        return state

    if not runtime.context.has_reports_permission:
        state.setdefault("errors", []).append("reports:view é obrigatório para executar tools determinísticas do assistente.")
        state["final_response"] = _build_response_from_state(state, runtime.context, refusal=True)
        return state

    scope = str(state.get("scope") or "general")
    date_range = dict(state.get("ranges") or _detect_date_range(str(state.get("question") or "")))
    results: dict[str, Any] = {}

    try:
        if scope == "models":
            tool_specs: list[tuple[str, Callable[[Connection], Any]]] = [
                (
                    "modelRuns",
                    lambda connection: list_model_runs(
                        connection,
                        start_date=date_range["start"],
                        end_date=date_range["end"],
                        limit=40,
                    ),
                ),
                (
                    "modelSummary",
                    lambda connection: summarize_model_runs(
                        connection,
                        start_date=date_range["start"],
                        end_date=date_range["end"],
                    ),
                ),
            ]
            if bool(state.get("execution_plan", {}).get("includeComparison")):
                tool_specs.append(
                    (
                        "modelComparison",
                        lambda connection: compare_model_run_periods(
                            connection,
                            start_date=date_range["start"],
                            end_date=date_range["end"],
                        ),
                    )
                )
            await _run_required_tool_batch(runtime.context, results, state, tool_specs)
            model_matches = ((state.get("entities") or {}).get("models") or {}).get("matches") or []
            if model_matches:
                model_id = str(model_matches[0]["id"])
                follow_up_specs: list[tuple[str, Callable[[Connection], Any]]] = [
                    (
                        "modelHistory",
                        lambda connection, model_id=model_id: get_model_run_history(
                            connection,
                            product_id_or_slug=model_id,
                        ),
                    ),
                    (
                        "modelInterventions",
                        lambda connection, model_id=model_id: list_model_interventions(
                            connection,
                            product_ids=[model_id],
                            limit=20,
                        ),
                    ),
                ]
                await _run_required_tool_batch(runtime.context, results, state, follow_up_specs)
        elif scope == "pending":
            await _run_required_tool_batch(
                runtime.context,
                results,
                state,
                [
                    ("projectsSnapshot", lambda connection: get_projects_snapshot(connection)),
                    (
                        "projectsReport",
                        lambda connection: get_projects_report_data(
                            connection,
                            {"start": date_range["start"], "end": date_range["end"]},
                        ),
                    ),
                ],
            )
        elif scope == "problems":
            await _run_required_tool_batch(
                runtime.context,
                results,
                state,
                [
                    (
                        "problemsList",
                        lambda connection: list_registered_problems(
                            connection,
                            start_date=date_range["start"],
                            end_date=date_range["end"],
                            limit=40,
                        ),
                    ),
                    (
                        "problemSummary",
                        lambda connection: summarize_problems(
                            connection,
                            start_date=date_range["start"],
                            end_date=date_range["end"],
                        ),
                    ),
                    (
                        "problemComparison",
                        lambda connection: compare_problem_periods(
                            connection,
                            start_date=date_range["start"],
                            end_date=date_range["end"],
                        ),
                    ),
                    (
                        "problematicRuns",
                        lambda connection: list_problematic_runs(
                            connection,
                            start_date=date_range["start"],
                            end_date=date_range["end"],
                            limit=20,
                        ),
                    ),
                ],
            )
            problem_category_matches = ((state.get("entities") or {}).get("problemCategories") or {}).get("matches") or []
            if problem_category_matches:
                category_id = str(problem_category_matches[0]["id"])
                await _run_required_tool_batch(
                    runtime.context,
                    results,
                    state,
                    [("problemCategory", lambda connection, category_id=category_id: resolve_problem_categories(connection, category_id))],
                )
        elif scope == "solutions":
            await _run_required_tool_batch(
                runtime.context,
                results,
                state,
                [
                    (
                        "problemsList",
                        lambda connection: list_registered_problems(
                            connection,
                            start_date=date_range["start"],
                            end_date=date_range["end"],
                            limit=20,
                        ),
                    ),
                    (
                        "problemSummary",
                        lambda connection: summarize_problems(
                            connection,
                            start_date=date_range["start"],
                            end_date=date_range["end"],
                        ),
                    ),
                    ("knowledgeSearch", lambda connection: search_silo_knowledge(connection, query=str(state["question"]), limit=5)),
                ],
            )
        elif scope == "projects":
            await _run_required_tool_batch(
                runtime.context,
                results,
                state,
                [
                    ("projectsSnapshot", lambda connection: get_projects_snapshot(connection)),
                    (
                        "projectsReport",
                        lambda connection: get_projects_report_data(
                            connection,
                            {"start": date_range["start"], "end": date_range["end"]},
                        ),
                    ),
                ],
            )
        elif scope == "reports":
            await _run_required_tool_batch(
                runtime.context,
                results,
                state,
                [
                    ("executiveReport", lambda connection: get_executive_report_data(connection, {"start": date_range["start"], "end": date_range["end"]})),
                    ("availabilityReport", lambda connection: get_availability_report_data(connection, {"start": date_range["start"], "end": date_range["end"]})),
                ],
            )
            await _run_required_tool_batch(
                runtime.context,
                results,
                state,
                [
                    ("problemsReport", lambda connection: get_problems_report_data(connection, {"start": date_range["start"], "end": date_range["end"]})),
                    ("projectsReport", lambda connection: get_projects_report_data(connection, {"start": date_range["start"], "end": date_range["end"]})),
                ],
            )
        else:
            await _run_required_tool_batch(
                runtime.context,
                results,
                state,
                [
                    ("executiveReport", lambda connection: get_executive_report_data(connection, {"start": date_range["start"], "end": date_range["end"]})),
                    ("availabilityReport", lambda connection: get_availability_report_data(connection, {"start": date_range["start"], "end": date_range["end"]})),
                ],
            )
            await _run_required_tool_batch(
                runtime.context,
                results,
                state,
                [
                    ("problemsReport", lambda connection: get_problems_report_data(connection, {"start": date_range["start"], "end": date_range["end"]})),
                    ("projectsReport", lambda connection: get_projects_report_data(connection, {"start": date_range["start"], "end": date_range["end"]})),
                ],
            )
    except Exception as exc:
        state.setdefault("errors", []).append(str(exc))

    state["required_results"] = results
    state["dataset_manifests"] = []
    return state


async def _run_required_tool_batch(
    runtime_context: AgentRuntimeContext,
    results: dict[str, Any],
    state: AgentState,
    tool_specs: list[tuple[str, Callable[[Connection], Any]]],
    *,
    timeout_seconds: float = 20.0,
) -> None:
    for index in range(0, len(tool_specs), 2):
        batch = tool_specs[index : index + 2]
        task_results = await asyncio.gather(
            *[
                _run_required_tool(state, runtime_context, tool_name, callback, timeout_seconds=timeout_seconds)
                for tool_name, callback in batch
            ]
        )
        for tool_name, result in task_results:
            if tool_name is None:
                continue
            if result is None:
                state.setdefault("errors", []).append(f"Tool obrigatória sem resultado: {tool_name}.")
                continue
            results[tool_name] = result


async def _run_required_tool(
    state: AgentState,
    runtime_context: AgentRuntimeContext,
    tool_name: str,
    callback: Callable[[Connection], Any],
    *,
    timeout_seconds: float,
) -> tuple[str | None, Any | None]:
    async def _invoke() -> Any:
        def _call() -> Any:
            if runtime_context.connection_factory is None:
                return callback(runtime_context.connection)
            with runtime_context.connection_factory() as connection:
                return callback(connection)

        return await asyncio.to_thread(_call)

    started_at = time.perf_counter()
    try:
        result = await asyncio.wait_for(_invoke(), timeout=timeout_seconds)
    except asyncio.TimeoutError:
        _record_observability_event(state, "tool", tool_name, int((time.perf_counter() - started_at) * 1000), status="timeout")
        return tool_name, None
    except Exception:
        _record_observability_event(state, "tool", tool_name, int((time.perf_counter() - started_at) * 1000), status="error")
        return tool_name, None
    _record_observability_event(state, "tool", tool_name, int((time.perf_counter() - started_at) * 1000), status="success")
    return tool_name, result


async def _node_agent_decide(
    state: AgentState,
    runtime: Runtime[AgentRuntimeContext],
) -> AgentState:
    progress = list(state.get("progress", []))
    progress.append("agent_decide")
    state["progress"] = progress
    if state.get("final_response") or state.get("mode") != "hybrid":
        return state
    if _graph_budget_guard(state, note="agent_decide"):
        return state

    scope = str(state.get("scope") or "general")
    tool_schemas = get_hybrid_tool_schemas(scope)
    if not tool_schemas:
        return state

    model_runtime = runtime.context.model_runtime
    if not hasattr(model_runtime, "bind_tools"):
        return state

    tool_messages: list[ToolMessage] = []
    supplemental_results = dict(state.get("supplemental_results") or {})
    executed_signatures: set[str] = set()
    max_tool_rounds = 2
    max_tool_calls = 4
    rounds_completed = 0

    prompt = _build_hybrid_tool_prompt(state, runtime.context, scope)
    messages: list[Any] = [
        SystemMessage(content="Você é o orquestrador híbrido do SILO. Use somente ferramentas de leitura e nunca produza a resposta final aqui."),
        HumanMessage(content=prompt),
    ]

    for round_index in range(max_tool_rounds):
        if len(executed_signatures) >= max_tool_calls:
            break
        try:
            bound_model = model_runtime.bind_tools(tool_schemas)
            model_started_at = time.perf_counter()
            ai_message = await bound_model.ainvoke(messages)
            _record_observability_event(
                state,
                "model",
                f"hybrid_round_{round_index + 1}",
                int((time.perf_counter() - model_started_at) * 1000),
            )
        except Exception as exc:
            state.setdefault("errors", []).append(str(exc))
            break

        tool_calls = _extract_tool_calls(ai_message)
        if not tool_calls:
            break

        messages.append(ai_message)
        round_executed = False
        for tool_call in tool_calls:
            if len(executed_signatures) >= max_tool_calls:
                break
            tool_name = str(tool_call.get("name") or "")
            tool_args = tool_call.get("args") if isinstance(tool_call.get("args"), dict) else {}
            signature = _tool_call_signature(tool_name, tool_args)
            if not tool_name or signature in executed_signatures:
                continue
            try:
                tool_started_at = time.perf_counter()
                spec, result = execute_hybrid_tool(tool_name, runtime.context, state, tool_args)
                _record_observability_event(
                    state,
                    "tool",
                    tool_name,
                    int((time.perf_counter() - tool_started_at) * 1000),
                )
            except Exception as exc:
                _record_observability_event(
                    state,
                    "tool",
                    tool_name,
                    int((time.perf_counter() - tool_started_at) * 1000),
                    status="error",
                )
                state.setdefault("errors", []).append(str(exc))
                continue
            executed_signatures.add(signature)
            round_executed = True
            result_key = _hybrid_result_key(spec.name)
            supplemental_results[result_key] = result
            tool_messages.append(
                ToolMessage(
                    tool_call_id=str(tool_call.get("id") or signature),
                    content=_compact_tool_result(result),
                )
            )
            messages.append(tool_messages[-1])
        rounds_completed += 1
        if not round_executed:
            break

    if supplemental_results:
        state["supplemental_results"] = supplemental_results
    if rounds_completed:
        state["remaining_steps"] = max(0, int(state.get("remaining_steps") or 0) - rounds_completed)
    return state


async def _node_analyze_and_register_datasets(
    state: AgentState,
    runtime: Runtime[AgentRuntimeContext],
) -> AgentState:
    progress = list(state.get("progress", []))
    progress.append("analyze_and_register_datasets")
    state["progress"] = progress
    if state.get("final_response"):
        return state

    combined_results = _combined_tool_results(state)
    response_base, citations, suggested_questions = _build_grounded_text(state, runtime.context)
    state["response_base"] = response_base
    state["citations"] = [citation.model_dump(mode="json") for citation in citations]
    state["suggested_questions"] = list(suggested_questions)
    state["dataset_manifests"] = _register_datasets(runtime.context, state, combined_results)
    return state


async def _node_presentation_router(
    state: AgentState,
    runtime: Runtime[AgentRuntimeContext],
) -> AgentState:
    progress = list(state.get("progress", []))
    progress.append("presentation_router")
    state["progress"] = progress
    if state.get("final_response"):
        return state

    intent = str(state.get("artifact_intent", {}).get("kind") or "text")
    scope = str(state.get("scope") or "general")
    results = dict(state.get("required_results") or {})
    visualization: AiAssistantVisualizationDto | None = None
    artifact_result: dict[str, Any] | None = None

    try:
        if intent == "chart":
            visualization = _build_chart_visualization(scope, state, results)
        elif intent == "image":
            visualization = _build_image_visualization(scope, state, results)
        elif intent == "mermaid":
            visualization = _build_mermaid_visualization(scope, state, results)
        elif intent == "pdf":
            artifact_result, visualization = await _build_pdf_artifact(runtime.context, state, results)
    except Exception as exc:
        state.setdefault("errors", []).append(str(exc))

    if visualization is not None:
        state["visualization"] = visualization.model_dump(mode="json")
    if artifact_result is not None:
        state["artifact_result"] = artifact_result
    return state


async def _node_synthesize_once(state: AgentState, runtime: Runtime[AgentRuntimeContext]) -> AgentState:
    progress = list(state.get("progress", []))
    progress.append("synthesize_once")
    state["progress"] = progress
    if state.get("final_response"):
        return state
    if _graph_budget_guard(state, note="synthesize_once") and not state.get("response_base"):
        state["answer"] = ""
        state["generation"] = {
            "provider": "ollama",
            "model": runtime.context.settings.vllm.model,
            "status": "error",
            "latencyMs": 0,
            "generatedTokens": None,
            "thinkingTimeMs": None,
            "errorMessage": "Orçamento de execução esgotado.",
        }
        return state

    started_at = time.perf_counter()
    prompt = _build_synthesis_prompt(state)
    answer = str(state.get("response_base") or "")
    generation_status: Literal["success", "fallback", "error"] = "fallback"
    generated_tokens: int | None = None
    prompt_eval_count: int | None = None
    prompt_size_bytes = len(prompt.encode("utf-8"))
    try:
        if prompt_size_bytes > 12_000:
            state.setdefault("errors", []).append("Prompt de síntese excedeu o orçamento de 12.000 bytes.")
            generation_status = "fallback" if answer else "error"
        else:
            messages = [
                ChatMessage(
                    role="system",
                    content=(
                        "Você é o assistente do SILO. Preserve fatos, números, URLs e citações. "
                        "Responda somente em JSON válido com as chaves answer e contextSummary."
                    ),
                ),
                ChatMessage(role="user", content=prompt),
            ]
            if hasattr(runtime.context.model_runtime, "complete_with_metadata"):
                model_started_at = time.perf_counter()
                response, telemetry = await runtime.context.model_runtime.complete_with_metadata(messages)
                _record_observability_event(
                    state,
                    "model",
                    "synthesize_once",
                    int((time.perf_counter() - model_started_at) * 1000),
                )
                prompt_eval_count = telemetry.prompt_eval_count
                generated_tokens = telemetry.output_token_count
                if telemetry.output_token_count is not None and telemetry.output_token_count > 768:
                    state.setdefault("errors", []).append("Síntese ultrapassou o limite de tokens de saída.")
                    generation_status = "fallback" if answer else "error"
                else:
                    parsed = _parse_structured_synthesis_response(response.content)
                    candidate_answer = _optional_text(parsed.get("answer")) if isinstance(parsed, dict) else None
                    if candidate_answer and _synthesis_answer_is_safe(candidate_answer, str(state.get("response_base") or "")):
                        answer = candidate_answer
                        if isinstance(parsed, dict) and isinstance(parsed.get("contextSummary"), str):
                            state["synthesis_context_summary"] = str(parsed["contextSummary"])
                        generation_status = "success"
                    elif not answer:
                        generation_status = "error"
            else:
                model_started_at = time.perf_counter()
                response = await runtime.context.model_runtime.complete(messages)
                _record_observability_event(
                    state,
                    "model",
                    "synthesize_once",
                    int((time.perf_counter() - model_started_at) * 1000),
                )
                parsed = _parse_structured_synthesis_response(response.content)
                candidate_answer = _optional_text(parsed.get("answer")) if isinstance(parsed, dict) else None
                if candidate_answer and _synthesis_answer_is_safe(candidate_answer, str(state.get("response_base") or "")):
                    answer = candidate_answer
                    if isinstance(parsed, dict) and isinstance(parsed.get("contextSummary"), str):
                        state["synthesis_context_summary"] = str(parsed["contextSummary"])
                    generation_status = "success"
    except Exception as exc:
        state.setdefault("errors", []).append(str(exc))
        generation_status = "fallback" if answer else "error"
    latency_ms = int((time.perf_counter() - started_at) * 1000)
    state["answer"] = answer
    state["generation"] = {
        "provider": "ollama",
        "model": runtime.context.settings.vllm.model,
        "status": generation_status,
        "latencyMs": latency_ms,
        "generatedTokens": generated_tokens,
        "thinkingTimeMs": None,
        "errorMessage": None if generation_status != "error" else "Falha na síntese final.",
    }
    if prompt_eval_count is not None:
        state["prompt_eval_count"] = prompt_eval_count
    return state


async def _node_validate_output_citations_and_artifacts(
    state: AgentState,
    runtime: Runtime[AgentRuntimeContext],
) -> AgentState:
    progress = list(state.get("progress", []))
    progress.append("validate_output_citations_and_artifacts")
    state["progress"] = progress
    final_response = _build_response_from_state(state, runtime.context)
    if not final_response["citations"] and not final_response.get("refusalReason"):
        final_response["citations"] = _default_citations_for_scope(str(state.get("scope") or "general"), state)
    state["final_response"] = final_response
    return state


async def _node_persist_transaction(
    state: AgentState,
    runtime: Runtime[AgentRuntimeContext],
) -> AgentState:
    progress = list(state.get("progress", []))
    progress.append("persist_transaction")
    state["progress"] = progress
    if state.get("final_response") is None:
        state["final_response"] = _build_response_from_state(state, runtime.context)

    if state.get("artifact_result", {}).get("status") == "attached_hit":
        return state

    if state.get("artifact_result", {}).get("status") == "claimed":
        _persist_user_and_assistant_messages(runtime.context, state)
        _finalize_pdf_artifact(runtime.context, state)
        _store_semantic_cache(state)
        return state

    _persist_user_and_assistant_messages(runtime.context, state)
    _store_semantic_cache(state)
    return state


async def _node_emit_result(
    state: AgentState,
    runtime: Runtime[AgentRuntimeContext],
) -> AgentState:
    progress = list(state.get("progress", []))
    progress.append("emit_result")
    state["progress"] = progress
    if state.get("final_response") is None:
        state["final_response"] = _build_response_from_state(state, runtime.context)
    return state


def _build_response_from_state(
    state: AgentState,
    runtime_context: AgentRuntimeContext,
    *,
    refusal: bool = False,
    clarification: bool = False,
) -> dict[str, Any]:
    scope = str(state.get("scope") or "general")
    answer = str(state.get("answer") or state.get("response_base") or "")
    if refusal and not answer:
        answer = str(state.get("refusal_reason") or "Não posso responder esta solicitação.")
    if clarification and not answer:
        clarification_text = str(state.get("clarification") or "Preciso de mais detalhes para continuar.")
        answer = clarification_text

    thread_summary = _current_thread_summary(runtime_context.connection, runtime_context.current_user.id, str(state.get("thread_id") or ""))
    final_response = AiAssistantMessageResponseDto(
        thread_id=str(state.get("thread_id") or ""),
        thread=thread_summary,
        message_content=None,
        scope=scope,  # type: ignore[arg-type]
        is_in_scope=not refusal,
        refusal_reason=str(state.get("refusal_reason")) if refusal else None,
        answer=answer,
        thinking=" · ".join(state.get("progress", [])[-4:]) if state.get("progress") else None,
        suggested_questions=list(state.get("suggested_questions") or _suggested_questions_for_scope(scope)),
        citations=[AiAssistantCitationDto.model_validate(item) if isinstance(item, dict) else item for item in state.get("citations", [])],
        visualization=_current_visualization(state),
        artifacts=_current_artifacts(state),
        generation=AiAssistantGenerationDto.model_validate(state["generation"]) if state.get("generation") else None,
        context_summary=str(state.get("synthesis_context_summary") or _build_context_summary(state)),
    )
    return final_response.model_dump(mode="json")


def _build_context_summary(state: AgentState) -> str:
    scope = str(state.get("scope") or "general")
    date_range = dict(state.get("ranges") or {})
    sources = ", ".join(state.get("source_kinds") or [])
    return f"scope={scope}; range={date_range.get('start', '')}..{date_range.get('end', '')}; sources={sources}"


def _current_epoch_ms() -> int:
    return int(time.time() * 1000)


def _initial_observability(runtime_context: AgentRuntimeContext) -> dict[str, Any]:
    return {
        "scope": None,
        "mode": runtime_context.mode,
        "cacheHit": False,
        "cancelled": False,
        "versions": {
            "graph": runtime_context.graph_version,
            "prompt": runtime_context.prompt_version,
            "toolCatalog": runtime_context.tool_catalog_version,
            "metric": runtime_context.metric_version,
        },
        "nodes": [],
        "nodeDurationsMs": {},
        "modelCalls": [],
        "modelDurationsMs": {},
        "toolCalls": [],
        "toolDurationsMs": {},
        "counts": {
            "nodes": 0,
            "models": 0,
            "tools": 0,
        },
        "errors": [],
    }


def _record_observability_event(
    state: AgentState,
    kind: Literal["node", "model", "tool"],
    name: str,
    duration_ms: int,
    *,
    status: str = "success",
) -> None:
    observability = state.setdefault("observability", {})
    observability.setdefault("scope", state.get("scope"))
    observability.setdefault("mode", state.get("mode"))
    observability.setdefault(
        "versions",
        {
            "graph": ASSISTANT_GRAPH_VERSION,
            "prompt": ASSISTANT_PROMPT_VERSION,
            "toolCatalog": ASSISTANT_TOOL_VERSION,
            "metric": ASSISTANT_METRIC_VERSION,
        },
    )
    event = {"name": name, "durationMs": max(0, int(duration_ms)), "status": status}
    if kind == "node":
        observability.setdefault("nodes", []).append(event)
        observability.setdefault("nodeDurationsMs", {})[name] = max(0, int(duration_ms))
        observability.setdefault("counts", {}).setdefault("nodes", 0)
        observability["counts"]["nodes"] = int(observability["counts"]["nodes"]) + 1
    elif kind == "model":
        observability.setdefault("modelCalls", []).append(event)
        observability.setdefault("modelDurationsMs", {})[name] = max(0, int(duration_ms))
        observability.setdefault("counts", {}).setdefault("models", 0)
        observability["counts"]["models"] = int(observability["counts"]["models"]) + 1
    else:
        observability.setdefault("toolCalls", []).append(event)
        observability.setdefault("toolDurationsMs", {})[name] = max(0, int(duration_ms))
        observability.setdefault("counts", {}).setdefault("tools", 0)
        observability["counts"]["tools"] = int(observability["counts"]["tools"]) + 1


def _sanitized_observability(state: AgentState) -> dict[str, Any]:
    observability = dict(state.get("observability") or {})
    safe_observability: dict[str, Any] = {
        "scope": state.get("scope"),
        "mode": state.get("mode"),
        "cacheHit": bool(state.get("cache_hit")),
        "cancelled": bool(observability.get("cancelled")),
        "versions": {
            "graph": ASSISTANT_GRAPH_VERSION,
            "prompt": ASSISTANT_PROMPT_VERSION,
            "toolCatalog": ASSISTANT_TOOL_VERSION,
            "metric": ASSISTANT_METRIC_VERSION,
        },
        "trajectory": _canonical_trajectory(state),
        "counts": dict(observability.get("counts") or {}),
        "errors": [str(error) for error in state.get("errors") or []],
    }
    for key in ("nodes", "modelCalls", "toolCalls"):
        safe_observability[key] = _sanitize_observability_events(observability.get(key))
    for key in ("nodeDurationsMs", "modelDurationsMs", "toolDurationsMs"):
        value = observability.get(key)
        safe_observability[key] = dict(value) if isinstance(value, dict) else {}
    return safe_observability


def _sanitize_observability_events(events: object) -> list[dict[str, Any]]:
    if not isinstance(events, list):
        return []

    sanitized: list[dict[str, Any]] = []
    for event in events:
        if not isinstance(event, dict):
            continue
        sanitized.append(
            {
                key: event[key]
                for key in ("name", "durationMs", "status")
                if key in event
            }
        )
    return sanitized


def _canonical_trajectory(state: AgentState) -> list[str]:
    if state.get("refusal_reason"):
        return ["normalize_question", "classify_scope", "refuse_out_of_scope", "verify_response"]

    trajectory: list[str] = ["normalize_question", "classify_scope", "build_and_validate_plan"]
    entities = dict(state.get("entities") or {})
    if entities.get("models"):
        trajectory.append("resolve_models")
    if entities.get("projects"):
        trajectory.append("resolve_projects")
    if entities.get("problemCategories"):
        trajectory.append("resolve_problem_categories")

    required_phases = _trajectory_from_results(dict(state.get("required_results") or {}))
    supplemental_phases = _trajectory_from_results(dict(state.get("supplemental_results") or {}))
    trajectory.extend(required_phases)
    trajectory.extend([phase for phase in supplemental_phases if phase not in trajectory])

    presentation_phase = _presentation_phase_from_state(state)
    if presentation_phase and presentation_phase not in trajectory:
        trajectory.append(presentation_phase)

    if state.get("artifact_intent", {}).get("kind") == "pdf" and "generate_report_pdf" not in trajectory:
        trajectory.append("generate_report_pdf")

    trajectory.extend(["build_grounded_response", "synthesize_answer", "verify_response"])
    return _dedupe_preserve_order(trajectory)


def _trajectory_from_results(results: dict[str, Any]) -> list[str]:
    mapping = {
        "modelRuns": "list_model_runs",
        "modelSummary": "summarize_model_runs",
        "modelComparison": "compare_model_run_periods",
        "modelHistory": "get_model_run_history",
        "modelInterventions": "list_model_interventions",
        "projectsSnapshot": "get_projects_snapshot",
        "projectsReport": "get_projects_report_data",
        "problemsList": "list_registered_problems",
        "problemSummary": "summarize_problems",
        "problemComparison": "compare_problem_periods",
        "problematicRuns": "list_problematic_runs",
        "problemCategory": "resolve_problem_categories",
        "executiveReport": "get_executive_report_data",
        "availabilityReport": "get_availability_report_data",
        "problemsReport": "get_problems_report_data",
        "knowledgeSearch": "search_silo_knowledge",
        "getExecutiveReportData": "get_executive_report_data",
        "getAvailabilityReportData": "get_availability_report_data",
        "getProblemsReportData": "get_problems_report_data",
        "getProjectsReportData": "get_projects_report_data",
    }
    phases: list[str] = []
    for key in results.keys():
        phase = mapping.get(key)
        if phase and phase not in phases:
            phases.append(phase)
    return phases


def _presentation_phase_from_state(state: AgentState) -> str | None:
    intent = str(state.get("artifact_intent", {}).get("kind") or "text")
    mapping = {
        "chart": "build_chart_spec",
        "image": "render_summary_image",
        "mermaid": "build_mermaid_diagram",
        "pdf": "generate_report_pdf",
    }
    return mapping.get(intent)


def _dedupe_preserve_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        ordered.append(value)
    return ordered


def _graph_budget_exhausted(state: AgentState) -> bool:
    remaining_steps_value = state.get("remaining_steps")
    deadline_epoch_ms_value = state.get("deadline_epoch_ms")
    if remaining_steps_value is not None and int(remaining_steps_value) <= 0:
        return True
    if deadline_epoch_ms_value is not None and int(deadline_epoch_ms_value) > 0 and _current_epoch_ms() >= int(deadline_epoch_ms_value):
        return True
    return False


def _graph_budget_guard(state: AgentState, *, note: str) -> bool:
    if not _graph_budget_exhausted(state):
        return False
    state.setdefault("errors", []).append(f"Orçamento de execução esgotado em {note}.")
    observability = state.setdefault("observability", {})
    observability["cancelled"] = True
    observability.setdefault("errors", []).append(f"Budget exceeded at {note}.")
    return True


def _observed_node(name: str, handler: Callable[[AgentState, Runtime[AgentRuntimeContext]], Any]):
    async def _wrapper(state: AgentState, runtime: Runtime[AgentRuntimeContext]) -> AgentState:
        started_at = time.perf_counter()
        try:
            return await handler(state, runtime)
        finally:
            elapsed_ms = int((time.perf_counter() - started_at) * 1000)
            _record_observability_event(state, "node", name, elapsed_ms)

    return _wrapper


def _combined_tool_results(state: AgentState) -> dict[str, Any]:
    combined = dict(state.get("required_results") or {})
    combined.update(dict(state.get("supplemental_results") or {}))
    return combined


def _build_hybrid_tool_prompt(state: AgentState, runtime_context: AgentRuntimeContext, scope: str) -> str:
    payload = {
        "question": state.get("question"),
        "scope": scope,
        "dateRange": state.get("ranges"),
        "requiredResultKeys": sorted((state.get("required_results") or {}).keys()),
        "supplementalResultKeys": sorted((state.get("supplemental_results") or {}).keys()),
        "allowedTools": [schema["function"]["name"] for schema in get_hybrid_tool_schemas(scope)],
        "toolCatalogVersion": runtime_context.tool_catalog_version,
        "graphVersion": runtime_context.graph_version,
        "promptVersion": runtime_context.prompt_version,
    }
    return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)


def _extract_tool_calls(message: Any) -> list[dict[str, Any]]:
    tool_calls = getattr(message, "tool_calls", None)
    if isinstance(tool_calls, list):
        calls: list[dict[str, Any]] = []
        for tool_call in tool_calls:
            if isinstance(tool_call, dict):
                calls.append(tool_call)
        return calls
    additional_kwargs = getattr(message, "additional_kwargs", None)
    if isinstance(additional_kwargs, dict):
        raw_calls = additional_kwargs.get("tool_calls")
        if isinstance(raw_calls, list):
            calls = []
            for tool_call in raw_calls:
                if isinstance(tool_call, dict):
                    calls.append(tool_call)
            return calls
    return []


def _tool_call_signature(tool_name: str, tool_args: Mapping[str, Any]) -> str:
    return _hash_json({"tool": tool_name, "args": tool_args})


def _hybrid_result_key(tool_name: str) -> str:
    mapping = {
        "search_silo_knowledge": "knowledgeSearch",
        "compare_model_run_periods": "modelComparison",
        "get_model_run_history": "modelHistory",
        "list_model_interventions": "modelInterventions",
        "compare_problem_periods": "problemComparison",
        "list_problematic_runs": "problematicRuns",
    }
    return mapping.get(tool_name, tool_name)


def _parse_model_scope_response(content: str) -> dict[str, Any] | None:
    text = content.strip()
    if not text:
        return None
    if text.startswith("```"):
        lines = [line for line in text.splitlines() if not line.strip().startswith("```")]
        text = "\n".join(lines).strip()
    if text.startswith("{") and text.endswith("}"):
        try:
            payload = json.loads(text)
        except json.JSONDecodeError:
            return None
        if isinstance(payload, dict):
            return payload
        return None
    try:
        start = text.index("{")
        end = text.rindex("}") + 1
    except ValueError:
        return None
    try:
        payload = json.loads(text[start:end])
    except json.JSONDecodeError:
        return None
    return payload if isinstance(payload, dict) else None


def _compact_tool_result(result: Any) -> str:
    try:
        payload = json.dumps(result, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)
    except TypeError:
        payload = json.dumps({"value": str(result)}, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return payload[:4_000]


def _current_thread_summary(connection: Connection, user_id: str, thread_id: str) -> AiAssistantThreadSummaryDto | None:
    if not thread_id:
        return None
    row = _load_thread_row(connection, user_id, thread_id)
    if row is None:
        row = _load_thread_row_by_id(connection, thread_id)
    if row is None:
        return None
    return _thread_summary_from_row(row)


def _current_visualization(state: AgentState) -> AiAssistantVisualizationDto | None:
    value = state.get("visualization")
    if not value:
        return None
    if isinstance(value, dict):
        try:
            return _validate_visualization_payload(value)
        except Exception:
            return None
    return None


def _current_artifacts(state: AgentState) -> list[AiAssistantArtifactDto] | None:
    artifact_result = state.get("artifact_result") or {}
    if not isinstance(artifact_result, dict):
        return None
    if artifact_result.get("status") not in {"claimed", "attached_hit"}:
        return None
    artifact = artifact_result.get("artifact")
    if not isinstance(artifact, dict):
        return None
    try:
        return [AiAssistantArtifactDto.model_validate(artifact)]
    except Exception:
        return None


def _suggested_questions_for_scope(scope: str) -> list[str]:
    suggestions = {
        "models": [
            "Quais modelos tiveram mais intervenções no período?",
            "Como a disponibilidade dos modelos mudou em relação ao período anterior?",
            "Quais modelos merecem prioridade agora?",
        ],
        "pending": [
            "Quais pendências estão bloqueando o fluxo?",
            "Quais projetos têm mais tarefas abertas?",
            "O que devo priorizar nesta semana?",
        ],
        "reports": [
            "Quais são os principais pontos de atenção do relatório executivo?",
            "Qual gráfico eu deveria abrir primeiro?",
            "Quais recortes mudaram mais no período?",
        ],
        "problems": [
            "Quais categorias mais cresceram na semana?",
            "Que problemas parecem recorrentes?",
            "Quais problemas deveriam virar plano de ação?",
        ],
        "solutions": [
            "Quais soluções estão realmente funcionando?",
            "Onde há recorrência de falhas?",
            "Quais correções ainda precisam ser validadas?",
        ],
        "projects": [
            "Quais projetos estão mais atrasados?",
            "Onde estão os maiores gargalos de execução?",
            "Quais tarefas precisam de atenção imediata?",
        ],
        "general": [
            "O que mudou mais desde o período anterior?",
            "Quais pontos exigem ação imediata?",
            "Qual relatório devo abrir primeiro?",
        ],
    }
    return suggestions.get(scope, suggestions["general"])


def _default_citations_for_scope(scope: str, state: AgentState) -> list[AiAssistantCitationDto]:
    date_range = dict(state.get("ranges") or {})
    period = f"{date_range.get('start', '')} a {date_range.get('end', '')}".strip()
    mapping = {
        "models": [AiAssistantCitationDto(label="Rodadas e disponibilidade", detail=period)],
        "pending": [AiAssistantCitationDto(label="Projetos e tarefas", detail=period)],
        "reports": [AiAssistantCitationDto(label="Relatórios operacionais", detail=period)],
        "problems": [AiAssistantCitationDto(label="Problemas registrados", detail=period)],
        "solutions": [AiAssistantCitationDto(label="Problemas e soluções", detail=period)],
        "projects": [AiAssistantCitationDto(label="Projetos e atividades", detail=period)],
        "generate_pdf": [AiAssistantCitationDto(label="Relatório em PDF", detail=period)],
    }
    return mapping.get(scope, [AiAssistantCitationDto(label="Visão consolidada", detail=period)])


def _build_grounded_text(
    state: AgentState,
    runtime_context: AgentRuntimeContext,
) -> tuple[str, list[AiAssistantCitationDto], list[str]]:
    scope = str(state.get("scope") or "general")
    results = _combined_tool_results(state)
    date_range = dict(state.get("ranges") or {})
    period = f"{date_range.get('start', '')} a {date_range.get('end', '')}".strip()
    citations = _default_citations_for_scope(scope, state)
    suggestions = _suggested_questions_for_scope(scope)

    if scope == "models":
        summary = results.get("modelSummary") or {}
        answer = _format_models_answer(summary, results, period)
    elif scope == "pending":
        answer = _format_pending_answer(results, period)
    elif scope == "problems":
        answer = _format_problems_answer(results, period)
    elif scope == "solutions":
        answer = _format_solutions_answer(results, period)
    elif scope == "projects":
        answer = _format_projects_answer(results, period)
    elif scope == "reports":
        answer = _format_reports_answer(results, period)
    elif scope == "generate_pdf":
        answer = _format_pdf_answer(state, period)
    else:
        answer = _format_general_answer(results, period)

    if state.get("artifact_result", {}).get("status") == "claimed":
        artifact = state["artifact_result"]
        if isinstance(artifact, dict):
            citations = [
                *citations,
                AiAssistantCitationDto(
                    label="PDF solicitado",
                    detail=str(artifact.get("filename") or artifact.get("url") or ""),
                ),
            ]
            suggestions = [*suggestions[:2], "Quer que eu gere outro recorte em PDF?"]

    return answer, citations, suggestions


def _format_models_answer(summary: dict[str, Any], results: dict[str, Any], period: str) -> str:
    availability = summary.get("availabilityPct") or summary.get("availability_pct") or 0
    total_runs = summary.get("totalRuns") or 0
    incident_runs = summary.get("incidentRuns") or 0
    top_products = summary.get("topProducts") or []
    lines = [f"No período {period}, os modelos tiveram {total_runs} rodadas e disponibilidade média de {availability}%.", f"Foram identificadas {incident_runs} rodadas problemáticas."]
    if top_products:
        names = ", ".join(str(item.get("productName") or item.get("name") or item.get("productSlug") or "") for item in top_products[:3] if item)
        if names:
            lines.append(f"Principais itens de atenção: {names}.")
    history = results.get("modelHistory")
    if isinstance(history, dict) and history.get("history"):
        lines.append("Há histórico de intervenções registrado para o modelo mais relevante identificado.")
    return " ".join(lines)


def _format_pending_answer(results: dict[str, Any], period: str) -> str:
    snapshot = results.get("projectsSnapshot") or {}
    total_projects = snapshot.get("totalProjects") or 0
    total_tasks = snapshot.get("totalTasks") or 0
    open_tasks = snapshot.get("openTasks") or 0
    blocked_tasks = snapshot.get("blockedTasks") or 0
    return (
        f"O recorte {period} mostra {total_projects} projetos, {total_tasks} tarefas e {open_tasks} tarefas em aberto, "
        f"com {blocked_tasks} tarefas bloqueadas."
    )


def _format_problems_answer(results: dict[str, Any], period: str) -> str:
    summary = results.get("problemSummary") or {}
    total_problems = summary.get("totalProblems") or 0
    avg_resolution = summary.get("avgResolutionHours") or 0
    top = summary.get("problemsByCategory") or summary.get("topProblems") or []
    names = ", ".join(str(item.get("name") or item.get("categoryName") or item.get("title") or "") for item in list(top)[:3] if item)
    parts = [f"No período {period}, foram registrados {total_problems} problemas, com tempo médio de resolução de {avg_resolution}h."]
    if names:
        parts.append(f"As categorias mais presentes foram {names}.")
    if results.get("knowledgeSearch"):
        parts.append("Também consultei a base de conhecimento para reforçar o contexto.")
    return " ".join(parts)


def _format_solutions_answer(results: dict[str, Any], period: str) -> str:
    summary = results.get("problemSummary") or {}
    total_solutions = summary.get("totalSolutions") or 0
    total_problems = summary.get("totalProblems") or 0
    return (
        f"No período {period}, o ecossistema de problemas e soluções mostra {total_problems} problemas e {total_solutions} soluções registradas. "
        "A leitura é útil para identificar correções recorrentes e o que ainda precisa de validação."
    )


def _format_projects_answer(results: dict[str, Any], period: str) -> str:
    snapshot = results.get("projectsSnapshot") or {}
    total_projects = snapshot.get("totalProjects") or 0
    open_tasks = snapshot.get("openTasks") or 0
    blocked_tasks = snapshot.get("blockedTasks") or 0
    avg_progress = snapshot.get("avgProgress") or 0
    return (
        f"Em {period}, os projetos somam {total_projects} itens principais, {open_tasks} tarefas abertas e {blocked_tasks} bloqueadas, "
        f"com progresso médio de {avg_progress}%."
    )


def _format_reports_answer(results: dict[str, Any], period: str) -> str:
    executive = results.get("executiveReport") or {}
    availability = results.get("availabilityReport") or {}
    problems = results.get("problemsReport") or {}
    projects = results.get("projectsReport") or {}
    return (
        f"O resumo executivo do período {period} indica {executive.get('summary', {}).get('totalProducts', 0)} produtos monitorados, "
        f"disponibilidade média de {availability.get('avgAvailability', availability.get('avgAvailabilityPct', 0))}%, "
        f"{problems.get('totalProblems', 0)} problemas e {projects.get('summary', {}).get('totalProjects', 0)} projetos."
    )


def _format_pdf_answer(state: AgentState, period: str) -> str:
    artifact = state.get("artifact_result") or {}
    report_type = str(artifact.get("reportType") or state.get("artifact_intent", {}).get("reportType") or "executive")
    return f"Relatório em PDF de {report_type} preparado para o período {period}."


def _format_general_answer(results: dict[str, Any], period: str) -> str:
    executive = results.get("executiveReport") or {}
    availability = results.get("availabilityReport") or {}
    problems = results.get("problemsReport") or {}
    projects = results.get("projectsReport") or {}
    return (
        f"No período {period}, o cenário consolidado mostra disponibilidade média de {availability.get('avgAvailability', 0)}%, "
        f"{problems.get('totalProblems', 0)} problemas e {projects.get('summary', {}).get('totalProjects', 0)} projetos. "
        f"O relatório executivo totaliza {executive.get('summary', {}).get('totalProducts', 0)} produtos monitorados."
    )


def _build_chart_visualization(scope: str, state: AgentState, results: dict[str, Any]) -> AiAssistantVisualizationDto:
    date_range = dict(state.get("ranges") or {})
    title = f"Visão de {scope}"
    if scope == "models":
        summary = results.get("modelSummary") or {}
        top = summary.get("topProducts") or []
        dataset = {
            "categories": [str(item.get("productName") or item.get("productSlug") or item.get("name") or "") for item in top[:5]],
            "series": [
                {
                    "name": "Incidentes",
                    "values": [float(item.get("incidentRuns") or item.get("incident_runs") or 0) for item in top[:5]],
                }
            ],
        }
        chart = build_chart_spec(template_id="models_overview", dataset=dataset, chart_type="bar", title=title, subtitle=f"{date_range.get('start')} a {date_range.get('end')}")
    elif scope == "projects":
        snapshot = results.get("projectsSnapshot") or {}
        projects = snapshot.get("projects") or []
        dataset = {
            "categories": [str(item.get("name") or item.get("title") or "") for item in projects[:5]],
            "series": [
                {
                    "name": "Progresso",
                    "values": [float(item.get("taskCount") or 0) for item in projects[:5]],
                }
            ],
        }
        chart = build_chart_spec(template_id="projects_overview", dataset=dataset, chart_type="bar", title=title, subtitle=f"{date_range.get('start')} a {date_range.get('end')}")
    elif scope in {"problems", "solutions"}:
        summary = results.get("problemSummary") or {}
        categories = summary.get("problemsByCategory") or summary.get("categories") or []
        dataset = {
            "categories": [str(item.get("name") or item.get("categoryName") or "") for item in categories[:5]],
            "series": [
                {
                    "name": "Problemas",
                    "values": [float(item.get("problemsCount") or item.get("count") or 0) for item in categories[:5]],
                }
            ],
        }
        chart = build_chart_spec(template_id="problems_overview", dataset=dataset, chart_type="bar", title=title, subtitle=f"{date_range.get('start')} a {date_range.get('end')}")
    else:
        summary = results.get("executiveReport") or {}
        products = (summary.get("topProducts") or [])[:5]
        dataset = {
            "products": [
                {
                    "name": str(item.get("name") or item.get("productName") or item.get("productSlug") or ""),
                    "availabilityPercentage": float(item.get("availabilityPercentage") or item.get("availabilityPct") or 0),
                }
                for item in products
            ]
        }
        chart = build_chart_spec(template_id="executive_overview", dataset=dataset, chart_type="bar", title=title, subtitle=f"{date_range.get('start')} a {date_range.get('end')}")
    return AiAssistantVisualizationChartDto.model_validate(chart)


def _build_image_visualization(scope: str, state: AgentState, results: dict[str, Any]) -> AiAssistantVisualizationDto:
    period = f"{state.get('ranges', {}).get('start', '')} a {state.get('ranges', {}).get('end', '')}"
    lines = [f"Escopo: {scope}", f"Período: {period}"]
    if scope == "models":
        lines.append(f"Rodadas: {results.get('modelSummary', {}).get('totalRuns', 0)}")
    elif scope == "projects":
        lines.append(f"Projetos: {results.get('projectsSnapshot', {}).get('totalProjects', 0)}")
    elif scope in {"problems", "solutions"}:
        lines.append(f"Problemas: {results.get('problemSummary', {}).get('totalProblems', 0)}")
    else:
        lines.append("Resumo executivo consolidado")
    image = render_summary_image(title=f"Resumo de {scope}", lines=lines)
    return AiAssistantVisualizationImageDto.model_validate(image)


def _build_mermaid_visualization(scope: str, state: AgentState, results: dict[str, Any]) -> AiAssistantVisualizationDto:
    title = f"Fluxo de {scope}"
    dataset = results.get("projectsSnapshot") or results.get("problemSummary") or results.get("executiveReport") or {}
    template_id = "project_flow" if scope in {"projects", "pending"} else "problem_flow"
    diagram = build_mermaid_diagram(template_id=template_id, dataset=dataset, title=title)
    return AiAssistantVisualizationMermaidDto.model_validate(diagram)


async def _build_pdf_artifact(
    runtime_context: AgentRuntimeContext,
    state: AgentState,
    results: dict[str, Any],
) -> tuple[dict[str, Any] | None, AiAssistantVisualizationDto | None]:
    artifact_state = dict(state.get("artifact_result") or {})
    if artifact_state.get("status") != "claimed":
        return None, None
    report_type = str(artifact_state.get("reportType") or "executive")
    period = f"{state.get('ranges', {}).get('start', '')} a {state.get('ranges', {}).get('end', '')}"
    data = _select_report_data_for_pdf(report_type, results, state)
    pdf = generate_report_pdf(runtime_context.connection, report_type=report_type, data=data, period_label=period)
    artifact_dict = {
        "kind": "pdf",
        "url": pdf["url"],
        "filename": pdf["filename"],
        "title": f"Relatório {report_type}",
        "mimeType": "application/pdf",
        "reportType": report_type,
        "checksum": pdf["checksum"],
        "byteSize": pdf["byteSize"],
    }
    visualization = AiAssistantVisualizationImageDto(
        kind="image",
        src=pdf["url"],
        alt=f"Relatório em PDF — {report_type}",
        caption=f"Arquivo {pdf['filename']}",
        width=1200,
        height=700,
    )
    artifact_state["artifact"] = artifact_dict
    state["artifact_result"] = artifact_state
    return artifact_dict, visualization


def _select_report_data_for_pdf(report_type: str, results: dict[str, Any], state: AgentState) -> dict[str, Any]:
    if report_type == "availability":
        return results.get("availabilityReport") or results.get("modelSummary") or {}
    if report_type == "problems":
        return results.get("problemsReport") or results.get("problemSummary") or {}
    if report_type == "projects":
        return results.get("projectsReport") or results.get("projectsSnapshot") or {}
    return results.get("executiveReport") or results.get("problemSummary") or {}


def _register_datasets(
    runtime_context: AgentRuntimeContext,
    state: AgentState,
    results: dict[str, Any],
) -> list[dict[str, Any]]:
    registry = runtime_context.dataset_registry
    manifests: list[dict[str, Any]] = []
    for name, data, schema_id, source_kind in _iter_dataset_registration_candidates(state, results):
        try:
            manifest = registry.register(
                name,
                data,
                schema_id=schema_id,
                source_kind=source_kind,
                row_count=_infer_row_count(data),
                clock=runtime_context.clock,
            )
            manifests.append(asdict(manifest))
        except Exception:
            continue
    return manifests


def _iter_dataset_registration_candidates(
    state: AgentState,
    results: dict[str, Any],
) -> list[tuple[str, Any, str, str]]:
    scope = str(state.get("scope") or "general")
    candidates: list[tuple[str, Any, str, str]] = []
    for key, value in results.items():
        candidates.append((key, value, f"{scope}.{key}.v1", "report"))
    return candidates


def _infer_row_count(data: Any) -> int | None:
    if isinstance(data, dict):
        for key in ("items", "projects", "problems", "messages", "history"):
            value = data.get(key)
            if isinstance(value, list):
                return len(value)
    if isinstance(data, list):
        return len(data)
    return None


def _build_synthesis_prompt(state: AgentState) -> str:
    combined_results = _combined_tool_results(state)
    payload = {
        "question": state.get("question"),
        "scope": state.get("scope"),
        "responseBase": state.get("response_base"),
        "requiredResults": state.get("required_results"),
        "supplementalResults": state.get("supplemental_results"),
        "citations": state.get("citations"),
        "suggestedQuestions": state.get("suggested_questions"),
        "visualization": state.get("visualization"),
        "artifact": state.get("artifact_result"),
        "combinedResultsKeys": sorted(combined_results.keys()),
        "contextSummary": _build_context_summary(state),
        "outputFormat": {
            "answer": "string",
            "contextSummary": "string",
        },
        "rules": [
            "Não invente números, URLs, nomes ou citações.",
            "Não inclua raciocínio interno.",
            "Não inclua campos adicionais.",
        ],
    }
    return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)


def _parse_structured_synthesis_response(content: str) -> dict[str, Any] | None:
    text = content.strip()
    if not text:
        return None
    if text.startswith("```"):
        lines = [line for line in text.splitlines() if not line.strip().startswith("```")]
        text = "\n".join(lines).strip()
    if not text.startswith("{") or not text.endswith("}"):
        return None
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        return None
    return payload if isinstance(payload, dict) else None


def _synthesis_answer_is_safe(candidate_answer: str, base_answer: str) -> bool:
    candidate_answer = candidate_answer.strip()
    if not candidate_answer:
        return False
    candidate_numbers = set(re.findall(r"\b\d+(?:[.,]\d+)?\b", candidate_answer))
    base_numbers = set(re.findall(r"\b\d+(?:[.,]\d+)?\b", base_answer))
    return candidate_numbers.issubset(base_numbers)


def _semantic_cache_key(state: AgentState, runtime_context: AgentRuntimeContext, plan: AssistantPlan) -> str:
    payload = {
        "userId": runtime_context.current_user.id,
        "question": normalize_text(str(state.get("question") or "")),
        "scope": plan.scope,
        "range": plan.date_range,
        "presentation": plan.presentation_intent,
        "sourceKinds": list(state.get("source_kinds") or plan.required_sources),
        "chatModel": runtime_context.settings.vllm.model,
        "embeddingModel": runtime_context.settings.vllm.embedding_model,
        "graphVersion": ASSISTANT_GRAPH_VERSION,
        "promptVersion": ASSISTANT_PROMPT_VERSION,
        "toolVersion": ASSISTANT_TOOL_VERSION,
        "metricVersion": ASSISTANT_METRIC_VERSION,
    }
    return _hash_json(payload)


def _store_semantic_cache(state: AgentState) -> None:
    if state.get("cache_hit"):
        return
    if not bool(state.get("cache_eligible", True)):
        return
    if state.get("history_messages"):
        return
    if state.get("visualization") or state.get("artifact_result", {}).get("status") == "claimed":
        return
    response = state.get("final_response")
    if not isinstance(response, dict):
        return
    key = str(state.get("cache_key") or "")
    if not key:
        return
    _SEMANTIC_CACHE[key] = {
        "cachedAtEpochMs": int(time.time() * 1000),
        "response": deepcopy(response),
    }
    _SEMANTIC_CACHE.move_to_end(key)
    while len(_SEMANTIC_CACHE) > _SEMANTIC_CACHE_MAX_SIZE:
        _SEMANTIC_CACHE.popitem(last=False)


def _artifact_row(state: AgentState) -> dict[str, Any] | None:
    artifact_result = state.get("artifact_result") or {}
    if not isinstance(artifact_result, dict):
        return None
    artifact = artifact_result.get("artifact")
    if isinstance(artifact, dict):
        return artifact
    return None


def _load_persisted_response_from_artifact(
    connection: Connection,
    artifact_row: dict[str, Any],
    state: AgentState,
) -> dict[str, Any]:
    artifact_id = _optional_text(artifact_row.get("id"))
    if artifact_id is None and _optional_text(artifact_row.get("messageId")) is None:
        return _build_response_from_state(state, _build_runtime_context_from_cache(connection, state), refusal=True)

    message_row = None
    if artifact_row.get("messageId"):
        message_row = connection.execute(
            select(legacy_tables["ai_assistant_message"]).where(
                legacy_tables["ai_assistant_message"].c.id == artifact_row["messageId"]
            ).limit(1)
        ).mappings().first()
    if message_row is None:
        return _build_response_from_state(state, _build_runtime_context_from_cache(connection, state), refusal=True)

    payload = serialize_legacy_row(message_row)
    metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}
    visualization = metadata.get("visualization") if isinstance(metadata, dict) else None
    artifacts = [
        {
            "kind": "pdf",
            "url": str(artifact_row.get("url") or ""),
            "filename": str(artifact_row.get("filename") or ""),
            "title": f"Relatório {artifact_row.get('reportType') or 'pdf'}",
            "mimeType": "application/pdf",
            "reportType": str(artifact_row.get("reportType") or ""),
            "checksum": artifact_row.get("file_sha256"),
            "byteSize": artifact_row.get("byte_size"),
        }
    ] if artifact_row.get("url") else []
    response = AiAssistantMessageResponseDto(
        thread_id=str(state.get("thread_id") or artifact_row.get("thread_id") or ""),
        thread=None,
        message_content=None,
        scope=str(metadata.get("scope") or state.get("scope") or "general"),
        is_in_scope=True,
        refusal_reason=None,
        answer=str(metadata.get("answer") or payload.get("content") or ""),
        thinking=_optional_text(metadata.get("thinking")),
        suggested_questions=list(metadata.get("suggestedQuestions") or []),
        citations=[AiAssistantCitationDto.model_validate(item) for item in metadata.get("citations") or [] if isinstance(item, dict)],
        visualization=_validate_visualization_payload(visualization) if isinstance(visualization, dict) else None,
        artifacts=[AiAssistantArtifactDto.model_validate(item) for item in artifacts if isinstance(item, dict)] if artifacts else None,
        generation=AiAssistantGenerationDto.model_validate(metadata["generation"]) if isinstance(metadata, dict) and isinstance(metadata.get("generation"), dict) else None,
        context_summary=str(metadata.get("contextSummary") or ""),
    )
    thread_summary = _current_thread_summary(connection, str(artifact_row.get("user_id") or ""), str(artifact_row.get("thread_id") or state.get("thread_id") or ""))
    return response.model_dump(mode="json") | {"thread": thread_summary.model_dump(mode="json") if thread_summary else None}


def _build_runtime_context_from_cache(connection: Connection, state: AgentState) -> AgentRuntimeContext:
    settings = load_settings()
    return AgentRuntimeContext(
        connection=connection,
        current_user=CurrentUser(id=str(""), email=None, name=None, is_active=True),
        request_id=str(state.get("request_id") or uuid.uuid4()),
        run_id=str(state.get("run_id") or uuid.uuid4()),
        settings=settings,
        model_runtime=create_model_runtime(settings),
        embedding_provider=create_embedding_runtime(settings),
        connection_factory=(lambda: connection.engine.connect()),
        mode=cast(Literal["deterministic", "hybrid"], settings.ai_agent_mode.value),
    )


def _persist_user_and_assistant_messages(runtime_context: AgentRuntimeContext, state: AgentState) -> None:
    thread_id = str(state.get("thread_id") or "")
    if not thread_id:
        return
    thread_table = legacy_tables["ai_assistant_thread"]
    message_table = legacy_tables["ai_assistant_message"]
    now = SYSTEM_CLOCK.now().astimezone().replace(tzinfo=None)
    question = str(state.get("question") or "")
    user_message_id = str(uuid.uuid4())
    assistant_message_id = str(uuid.uuid4())

    connection = runtime_context.connection
    user_message = {
        "id": user_message_id,
        "thread_id": thread_id,
        "sender_type": "user",
        "sender_user_id": runtime_context.current_user.id,
        "sender_name": runtime_context.current_user.name or runtime_context.current_user.email or "Usuário",
        "provider": None,
        "model": None,
        "generation_status": None,
        "latency_ms": None,
        "error_message": None,
        "content": question,
        "metadata": {"scope": state.get("scope"), "role": "user"},
        "embedding": None,
        "created_at": now,
        "updated_at": now,
    }
    assistant_response = state.get("final_response") or {}
    assistant_message = {
        "id": assistant_message_id,
        "thread_id": thread_id,
        "sender_type": "assistant",
        "sender_user_id": None,
        "sender_name": "Assistente de IA",
        "provider": "ollama",
        "model": runtime_context.settings.vllm.model,
        "generation_status": str((assistant_response.get("generation") or {}).get("status") or "fallback"),
        "latency_ms": int((assistant_response.get("generation") or {}).get("latencyMs") or 0),
        "error_message": None,
        "content": str(assistant_response.get("answer") or assistant_response.get("messageContent") or ""),
        "metadata": {
            "scope": assistant_response.get("scope"),
            "answer": assistant_response.get("answer"),
            "thinking": assistant_response.get("thinking"),
            "suggestedQuestions": assistant_response.get("suggestedQuestions"),
            "citations": assistant_response.get("citations"),
            "visualization": assistant_response.get("visualization"),
            "artifacts": assistant_response.get("artifacts"),
            "generation": assistant_response.get("generation"),
            "contextSummary": assistant_response.get("contextSummary"),
            "trajectory": _canonical_trajectory(state),
            "observability": _sanitized_observability(state),
            "versions": {
                "graph": ASSISTANT_GRAPH_VERSION,
                "prompt": ASSISTANT_PROMPT_VERSION,
                "toolCatalog": ASSISTANT_TOOL_VERSION,
                "metric": ASSISTANT_METRIC_VERSION,
            },
        },
        "embedding": None,
        "created_at": now,
        "updated_at": now,
    }
    thread_values = {
        "id": thread_id,
        "user_id": runtime_context.current_user.id,
        "title": _thread_title_from_question(str(state.get("question") or "")),
        "last_message_preview": str(assistant_message["content"])[:140],
        "message_count": 2,
        "last_message_at": now,
        "created_at": now,
        "updated_at": now,
    }
    existing_thread = connection.execute(
        select(thread_table.c.id).where(thread_table.c.id == thread_id).limit(1)
    ).first()
    if existing_thread is None:
        connection.execute(insert(thread_table).values(thread_values))
    else:
        connection.execute(
            update(thread_table)
            .where(thread_table.c.id == thread_id)
            .values(
                title=thread_values["title"],
                last_message_preview=thread_values["last_message_preview"],
                message_count=thread_values["message_count"],
                last_message_at=thread_values["last_message_at"],
                updated_at=thread_values["updated_at"],
            )
        )
    connection.execute(insert(message_table).values(user_message))
    connection.execute(insert(message_table).values(assistant_message))
    _attach_artifact_if_needed(runtime_context, state, assistant_message_id)
    _prune_thread_messages(connection, thread_id)
    _recalculate_thread_state(connection, thread_id)
    connection.commit()


def _thread_title_from_question(question: str) -> str:
    title = question.strip()
    if len(title) <= 60:
        return title or "Nova conversa"
    return title[:57].rstrip() + "..."


def _attach_artifact_if_needed(runtime_context: AgentRuntimeContext, state: AgentState, message_id: str) -> None:
    artifact_result = state.get("artifact_result") or {}
    if not isinstance(artifact_result, dict):
        return
    if artifact_result.get("status") != "claimed":
        return
    repository = AiArtifactRepository(runtime_context.connection)
    repository.mark_ready(
        idempotency_hash=str(artifact_result.get("idempotencyHash") or ""),
        owner_token=str(artifact_result.get("ownerToken") or ""),
        artifact=PdfArtifact(
            file_path=get_upload_file_path("reports", str((artifact_result.get("artifact") or {}).get("filename") or "")),
            filename=str((artifact_result.get("artifact") or {}).get("filename") or ""),
            url=str((artifact_result.get("artifact") or {}).get("url") or ""),
            byte_size=int((artifact_result.get("artifact") or {}).get("byteSize") or 0),
            sha256=str((artifact_result.get("artifact") or {}).get("checksum") or ""),
        ),
        dataset_checksum=str((artifact_result.get("artifact") or {}).get("checksum") or ""),
        report_type=str(artifact_result.get("reportType") or "executive"),
        request_fingerprint=str(artifact_result.get("requestFingerprint") or ""),
        metric_version=ASSISTANT_METRIC_VERSION,
    )
    repository.attach_artifact(
        idempotency_hash=str(artifact_result.get("idempotencyHash") or ""),
        owner_token=str(artifact_result.get("ownerToken") or ""),
        thread_id=str(state.get("thread_id") or ""),
        message_id=message_id,
    )


def _finalize_pdf_artifact(runtime_context: AgentRuntimeContext, state: AgentState) -> None:
    artifact_result = state.get("artifact_result") or {}
    if not isinstance(artifact_result, dict):
        return
    if artifact_result.get("status") != "claimed":
        return
    artifact = artifact_result.get("artifact")
    if not isinstance(artifact, dict):
        return
    repository = AiArtifactRepository(runtime_context.connection)
    repository.mark_ready(
        idempotency_hash=str(artifact_result.get("idempotencyHash") or ""),
        owner_token=str(artifact_result.get("ownerToken") or ""),
        artifact=PdfArtifact(
            file_path=get_upload_file_path("reports", str(artifact.get("filename") or "")),
            filename=str(artifact.get("filename") or ""),
            url=str(artifact.get("url") or ""),
            byte_size=int(artifact.get("byteSize") or 0),
            sha256=str(artifact.get("checksum") or ""),
        ),
        dataset_checksum=str(artifact.get("checksum") or ""),
        report_type=str(artifact_result.get("reportType") or "executive"),
        request_fingerprint=str(artifact_result.get("requestFingerprint") or ""),
        metric_version=ASSISTANT_METRIC_VERSION,
    )


def _build_clarification_from_entities(entities: dict[str, Any], scope: str) -> str | None:
    if scope == "models":
        matches = ((entities.get("models") or {}).get("matches") or [])
        if len(matches) > 1:
            names = ", ".join(str(match.get("name") or match.get("slug") or match.get("id")) for match in matches[:3])
            return f"Encontrei mais de um modelo possível: {names}. Qual devo usar?"
    if scope == "projects":
        matches = ((entities.get("projects") or {}).get("matches") or [])
        if len(matches) > 1:
            names = ", ".join(str(match.get("name") or match.get("id")) for match in matches[:3])
            return f"Encontrei mais de um projeto possível: {names}. Qual devo usar?"
    if scope in {"problems", "solutions", "generate_pdf"}:
        matches = ((entities.get("problemCategories") or {}).get("matches") or [])
        if len(matches) > 1:
            names = ", ".join(str(match.get("name") or match.get("id")) for match in matches[:3])
            return f"Encontrei mais de uma categoria possível: {names}. Qual devo usar?"
    return None


def _load_recent_history(connection: Connection, thread_id: str) -> list[dict[str, str]]:
    message_table = legacy_tables["ai_assistant_message"]
    rows = connection.execute(
        select(message_table).where(message_table.c.thread_id == thread_id).order_by(
            message_table.c.created_at.asc(),
            message_table.c.id.asc(),
        ).limit(12)
    ).mappings().all()
    return [
        {
            "role": str(row["sender_type"]),
            "content": str(row["content"]),
        }
        for row in rows
    ]


def _build_conversation_memory(history_messages: list[dict[str, str]]) -> str:
    if not history_messages:
        return ""
    tail = history_messages[-6:]
    lines = [f"{message['role']}: {message['content'][:180]}" for message in tail]
    return " | ".join(lines)


def _infer_last_scope(history_messages: list[dict[str, str]]) -> str | None:
    for message in reversed(history_messages):
        normalized = normalize_text(message.get("content") or "")
        for scope, keywords in _SCOPE_KEYWORDS.items():
            if any(keyword in normalized for keyword in keywords):
                return scope
    return None


async def _graph_guard_router(state: AgentState) -> str:
    if state.get("final_response"):
        return "emit_result"
    return "classify_and_plan"


async def _graph_claim_router(state: AgentState) -> str:
    if state.get("final_response") and state.get("artifact_result", {}).get("status") == "attached_hit":
        return "load_persisted_result"
    return "semantic_cache_if_text_only"


async def _graph_cache_router(state: AgentState) -> str:
    if state.get("final_response") and state.get("cache_hit"):
        return "persist_transaction"
    return "resolve_entities"


async def _graph_resolution_router(state: AgentState) -> str:
    if state.get("final_response") and state.get("clarification"):
        return "build_clarification"
    return "execute_required_data_tools"


async def _graph_after_execute_router(state: AgentState) -> str:
    return "agent_decide"


async def _graph_after_agent_router(state: AgentState) -> str:
    return "analyze_and_register_datasets"


async def _graph_after_analyze_router(state: AgentState) -> str:
    return "presentation_router"


async def _graph_after_presentation_router(state: AgentState) -> str:
    return "synthesize_once"


async def _graph_after_synthesis_router(state: AgentState) -> str:
    return "validate_output_citations_and_artifacts"


async def _graph_after_validate_router(state: AgentState) -> str:
    return "persist_transaction"


async def _graph_after_persist_router(state: AgentState) -> str:
    return "emit_result"


def _build_graph():
    graph = StateGraph(AgentState, context_schema=AgentRuntimeContext)
    graph.add_node("guard_and_normalize", _observed_node("guard_and_normalize", _node_guard_and_normalize))
    graph.add_node("classify_and_plan", _observed_node("classify_and_plan", _node_classify_and_plan))
    graph.add_node("claim_pdf_idempotency_if_needed", _observed_node("claim_pdf_idempotency_if_needed", _node_claim_pdf_idempotency_if_needed))
    graph.add_node("load_persisted_result", _observed_node("load_persisted_result", _node_load_persisted_result))
    graph.add_node("semantic_cache_if_text_only", _observed_node("semantic_cache_if_text_only", _node_semantic_cache_if_text_only))
    graph.add_node("resolve_entities", _observed_node("resolve_entities", _node_resolve_entities))
    graph.add_node("build_refusal", _observed_node("build_refusal", _node_build_refusal))
    graph.add_node("build_clarification", _observed_node("build_clarification", _node_build_clarification))
    graph.add_node("execute_required_data_tools", _observed_node("execute_required_data_tools", _node_execute_required_data_tools))
    graph.add_node("agent_decide", _observed_node("agent_decide", _node_agent_decide))
    graph.add_node("analyze_and_register_datasets", _observed_node("analyze_and_register_datasets", _node_analyze_and_register_datasets))
    graph.add_node("presentation_router", _observed_node("presentation_router", _node_presentation_router))
    graph.add_node("synthesize_once", _observed_node("synthesize_once", _node_synthesize_once))
    graph.add_node("validate_output_citations_and_artifacts", _observed_node("validate_output_citations_and_artifacts", _node_validate_output_citations_and_artifacts))
    graph.add_node("persist_transaction", _observed_node("persist_transaction", _node_persist_transaction))
    graph.add_node("emit_result", _observed_node("emit_result", _node_emit_result))
    graph.add_edge(START, "guard_and_normalize")
    graph.add_conditional_edges("guard_and_normalize", _graph_guard_router, {"classify_and_plan": "classify_and_plan", "emit_result": "emit_result"})
    graph.add_edge("classify_and_plan", "claim_pdf_idempotency_if_needed")
    graph.add_conditional_edges(
        "claim_pdf_idempotency_if_needed",
        _graph_claim_router,
        {
            "load_persisted_result": "load_persisted_result",
            "semantic_cache_if_text_only": "semantic_cache_if_text_only",
        },
    )
    graph.add_conditional_edges(
        "load_persisted_result",
        lambda state: "emit_result",
        {"emit_result": "emit_result"},
    )
    graph.add_conditional_edges(
        "semantic_cache_if_text_only",
        _graph_cache_router,
        {
            "persist_transaction": "persist_transaction",
            "resolve_entities": "resolve_entities",
        },
    )
    graph.add_conditional_edges(
        "resolve_entities",
        _graph_resolution_router,
        {
            "build_clarification": "build_clarification",
            "execute_required_data_tools": "execute_required_data_tools",
        },
    )
    graph.add_conditional_edges("build_refusal", lambda state: "persist_transaction", {"persist_transaction": "persist_transaction"})
    graph.add_conditional_edges("build_clarification", lambda state: "persist_transaction", {"persist_transaction": "persist_transaction"})
    graph.add_conditional_edges("execute_required_data_tools", _graph_after_execute_router, {"agent_decide": "agent_decide"})
    graph.add_conditional_edges("agent_decide", _graph_after_agent_router, {"analyze_and_register_datasets": "analyze_and_register_datasets"})
    graph.add_conditional_edges("analyze_and_register_datasets", _graph_after_analyze_router, {"presentation_router": "presentation_router"})
    graph.add_conditional_edges("presentation_router", _graph_after_presentation_router, {"synthesize_once": "synthesize_once"})
    graph.add_conditional_edges("synthesize_once", _graph_after_synthesis_router, {"validate_output_citations_and_artifacts": "validate_output_citations_and_artifacts"})
    graph.add_conditional_edges("validate_output_citations_and_artifacts", _graph_after_validate_router, {"persist_transaction": "persist_transaction"})
    graph.add_conditional_edges("persist_transaction", _graph_after_persist_router, {"emit_result": "emit_result"})
    graph.add_edge("emit_result", END)
    return graph.compile(name="silo-assistant-graph")


_COMPILED_GRAPH = _build_graph()
