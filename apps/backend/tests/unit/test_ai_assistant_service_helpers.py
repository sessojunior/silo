from __future__ import annotations

import json
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from sqlalchemy import Column, DateTime, Integer, JSON, MetaData, String, Table, create_engine, select

from silo.ai import assistant_service
from silo.ai.assistant_registry import DatasetRegistry
from silo.ai.assistant_contracts import AiAssistantMessageRequestDto
from silo.api.dependencies import CurrentUser


FIXED_NOW = datetime(2026, 8, 4, 12, 0, tzinfo=UTC)


class _FixedClock:
    def now(self) -> datetime:
        return FIXED_NOW


def _build_assistant_thread_tables(metadata: MetaData) -> tuple[Table, Table, Table]:
    thread_table = Table(
        "ai_assistant_thread",
        metadata,
        Column("id", String, primary_key=True),
        Column("user_id", String, nullable=False),
        Column("title", String, nullable=False),
        Column("last_message_preview", String, nullable=False),
        Column("message_count", Integer, nullable=False),
        Column("last_message_at", DateTime, nullable=False),
        Column("created_at", DateTime, nullable=False),
        Column("updated_at", DateTime, nullable=False),
    )
    message_table = Table(
        "ai_assistant_message",
        metadata,
        Column("id", String, primary_key=True),
        Column("thread_id", String, nullable=False),
        Column("sender_type", String, nullable=False),
        Column("sender_user_id", String, nullable=True),
        Column("sender_name", String, nullable=False),
        Column("provider", String, nullable=True),
        Column("model", String, nullable=True),
        Column("generation_status", String, nullable=True),
        Column("latency_ms", Integer, nullable=True),
        Column("error_message", String, nullable=True),
        Column("content", String, nullable=False),
        Column("metadata", JSON, nullable=True),
        Column("embedding", JSON, nullable=True),
        Column("created_at", DateTime, nullable=False),
        Column("updated_at", DateTime, nullable=False),
    )
    artifact_table = Table(
        "ai_assistant_artifact",
        metadata,
        Column("id", String, primary_key=True),
        Column("thread_id", String, nullable=False),
        Column("message_id", String, nullable=False),
        Column("kind", String, nullable=False),
        Column("filename", String, nullable=True),
        Column("url", String, nullable=True),
        Column("reportType", String, nullable=True),
        Column("file_sha256", String, nullable=True),
        Column("byte_size", Integer, nullable=True),
    )
    return thread_table, message_table, artifact_table


@pytest.mark.asyncio
async def test_assistant_examples_runtime_status_and_context_setup(monkeypatch: pytest.MonkeyPatch) -> None:
    examples = assistant_service.get_assistant_examples()
    assert examples.guidance
    assert examples.scope_policy
    assert examples.examples

    monkeypatch.setattr(assistant_service, "load_settings", lambda: (_ for _ in ()).throw(RuntimeError("config ausente")))
    fallback = await assistant_service.get_assistant_runtime_status(clock=_FixedClock())
    assert fallback.provider == "vllm"
    assert fallback.mode == "fallback"
    assert fallback.fallback_reason == "config ausente"
    assert fallback.checked_at == "2026-08-04T12:00:00Z"

    async def _fake_probe(_settings, *, clock):
        return SimpleNamespace(
            provider="vllm",
            model="mistral",
            mode=SimpleNamespace(value="vllm"),
            latency_ms=17,
            checked_at=clock.now().astimezone(UTC).isoformat().replace("+00:00", "Z"),
            fallback_reason=None,
        )

    monkeypatch.setattr(assistant_service, "load_settings", lambda: SimpleNamespace(vllm=SimpleNamespace(url="http://localhost:8000/v1")))
    monkeypatch.setattr(assistant_service, "probe_ai_runtime", _fake_probe)
    status = await assistant_service.get_assistant_runtime_status(clock=_FixedClock())
    assert status.model == "mistral"
    assert status.mode == "vllm"
    assert status.latency_ms == 17

    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    with engine.connect() as connection:
        fake_settings = SimpleNamespace(
            vllm=SimpleNamespace(
                model="mistral",
                embedding_model="nomic-embed-text:v1.5",
                timeout_ms=30_000,
                max_concurrent_requests=1,
            ),
            ai_agent_mode=SimpleNamespace(value="deterministic"),
        )
        runtime = assistant_service._build_runtime_context(
            connection,
            CurrentUser(id="user-1", email="user@example.test", name="User", is_active=True),
            request_id="request-1",
            settings=fake_settings,
            model_runtime=SimpleNamespace(),
            embedding_provider=SimpleNamespace(),
        )
        assert runtime.request_id == "request-1"
        assert runtime.mode == "deterministic"
        assert runtime.has_reports_permission is True
        assert runtime.group_permissions == ("reports:view",)

        monkeypatch.setattr(assistant_service, "_current_epoch_ms", lambda: 1_723_000_000_000)
        request = AiAssistantMessageRequestDto(content="Resumo diário")
        state = assistant_service._initial_state(request, runtime)
        assert state["question"] == "Resumo diário"
        assert state["request_id"] == "request-1"
        assert state["deadline_epoch_ms"] == 1_723_000_000_000 + (assistant_service.ASSISTANT_GRAPH_DEADLINE_SECONDS * 1000)
        assert assistant_service.get_assistant_graph() is assistant_service._COMPILED_GRAPH


def test_assistant_message_and_thread_row_helpers() -> None:
    summary_row = {
        "id": "thread-1",
        "title": "Nova conversa",
        "last_message_preview": "Última mensagem",
        "message_count": 3,
        "last_message_at": "2026-08-04T11:59:00",
        "created_at": "2026-08-04T11:00:00",
        "updated_at": "2026-08-04T11:59:00",
    }
    summary = assistant_service._thread_summary_from_row(summary_row)
    assert summary.id == "thread-1"
    assert summary.message_count == 3
    assert summary.last_message_preview == "Última mensagem"

    generation = {
        "provider": "ollama",
        "model": "mistral",
        "status": "success",
        "latency_ms": 12,
        "generated_tokens": 34,
        "thinking_time_ms": 5,
    }
    visualization = {
        "kind": "chart",
        "chart_type": "bar",
        "title": "Resumo",
        "categories": ["A"],
        "series": [{"name": "Incidentes", "values": [1.0]}],
    }
    artifacts = [
        {
            "kind": "pdf",
            "url": "https://example.test/report.pdf",
            "filename": "report.pdf",
            "title": "Relatório",
            "mime_type": "application/pdf",
        },
        {"kind": "pdf", "url": "https://example.test/ignored.pdf", "filename": "ignored.pdf"},
    ]
    message_row = {
        "id": "message-1",
        "thread_id": "thread-1",
        "sender_type": "assistant",
        "sender_user_id": None,
        "sender_name": "Assistente",
        "content": "Resposta final",
        "metadata": {
            "generation": generation,
            "visualization": visualization,
            "artifacts": artifacts,
            "thinking": "  cadeia interna  ",
        },
        "created_at": "2026-08-04T11:59:00",
    }
    message = assistant_service._thread_message_from_row(message_row)
    assert message.id == "message-1"
    assert message.thread_id == "thread-1"
    assert message.sender_type == "assistant"
    assert message.thinking == "cadeia interna"
    assert message.generation is not None
    assert message.generation.model == "mistral"
    assert message.visualization is not None
    assert message.visualization.kind == "chart"
    assert message.artifacts is not None
    assert message.artifacts[0].filename == "report.pdf"
    assert assistant_service._safe_model_validate_generation({"generation": generation}) is not None  # noqa: SLF001
    assert assistant_service._safe_model_validate_generation({"generation": {"provider": "ollama"}}) is None  # noqa: SLF001
    assert assistant_service._safe_model_validate_visualization({"visualization": visualization}) is not None  # noqa: SLF001
    assert assistant_service._safe_model_validate_visualization({"visualization": {"kind": "unknown"}}) is None  # noqa: SLF001
    assert assistant_service._safe_model_validate_artifacts({"artifacts": artifacts}) is not None  # noqa: SLF001
    assert assistant_service._safe_model_validate_artifacts({"artifacts": [123]}) is None  # noqa: SLF001
    assert assistant_service._safe_model_validate_artifacts({"artifacts": [{"kind": "pdf"}]}) is None  # noqa: SLF001
    assert assistant_service._safe_nested_value({"thinking": "ok"}, "thinking") == "ok"  # noqa: SLF001
    assert assistant_service._safe_nested_value("bad", "thinking") is None  # noqa: SLF001
    assert assistant_service._optional_text("  texto  ") == "texto"  # noqa: SLF001
    assert assistant_service._optional_text("   ") is None  # noqa: SLF001


def test_assistant_observability_and_plan_helpers(monkeypatch: pytest.MonkeyPatch) -> None:
    state = {
        "scope": "reports",
        "mode": "deterministic",
        "cache_hit": True,
        "observability": {
            "cancelled": True,
            "counts": {"nodes": 1, "models": 2, "tools": 3},
            "nodes": [{"name": "normalize", "durationMs": 12, "status": "success", "secret": "x"}],
            "modelCalls": ["bad"],
            "toolCalls": [{"name": "tool", "durationMs": 4, "status": "success"}],
            "nodeDurationsMs": {"normalize": 12},
            "modelDurationsMs": {"classify": 7},
            "toolDurationsMs": {"search": 4},
        },
        "errors": [ValueError("boom")],
        "entities": {"models": ["m"], "projects": ["p"], "problemCategories": ["c"]},
        "required_results": {"modelRuns": {}, "projectsSnapshot": {}},
        "supplemental_results": {"projectsReport": {}, "knowledgeSearch": {}},
        "artifact_intent": {"kind": "pdf"},
        "ranges": {"start": "2026-08-01", "end": "2026-08-04"},
    }

    assert assistant_service._build_context_summary(state) == "scope=reports; range=2026-08-01..2026-08-04; sources="
    assert assistant_service._sanitize_observability_events(None) == []  # noqa: SLF001
    assert assistant_service._sanitize_observability_events([{"name": "node", "durationMs": 1, "status": "success"}, "bad"]) == [  # noqa: SLF001
        {"name": "node", "durationMs": 1, "status": "success"}
    ]

    sanitized = assistant_service._sanitized_observability(state)
    assert sanitized["cacheHit"] is True
    assert sanitized["counts"] == {"nodes": 1, "models": 2, "tools": 3}
    assert sanitized["errors"] == ["boom"]
    assert sanitized["trajectory"] == [
        "normalize_question",
        "classify_scope",
        "build_and_validate_plan",
        "resolve_models",
        "resolve_projects",
        "resolve_problem_categories",
        "list_model_runs",
        "get_projects_snapshot",
        "get_projects_report_data",
        "search_silo_knowledge",
        "generate_report_pdf",
        "build_grounded_response",
        "synthesize_answer",
        "verify_response",
    ]

    assert assistant_service._canonical_trajectory({"refusal_reason": "fora de escopo"}) == [  # noqa: SLF001
        "normalize_question",
        "classify_scope",
        "refuse_out_of_scope",
        "verify_response",
    ]
    assert assistant_service._trajectory_from_results({"projectsSnapshot": {}, "projectsReport": {}, "projectsSnapshot": {}}) == [  # noqa: SLF001
        "get_projects_snapshot",
        "get_projects_report_data",
    ]
    assert assistant_service._presentation_phase_from_state({"artifact_intent": {"kind": "mermaid"}}) == "build_mermaid_diagram"  # noqa: SLF001
    assert assistant_service._presentation_phase_from_state({"artifact_intent": {}}) is None  # noqa: SLF001
    assert assistant_service._dedupe_preserve_order(["a", "b", "a", "c"]) == ["a", "b", "c"]  # noqa: SLF001

    monkeypatch.setattr(assistant_service, "_current_epoch_ms", lambda: 1_723_000_100_000)
    assert assistant_service._graph_budget_exhausted({"remaining_steps": 0}) is True  # noqa: SLF001
    assert assistant_service._graph_budget_exhausted({"deadline_epoch_ms": 1_722_999_999_999}) is True  # noqa: SLF001
    budget_state = {"errors": []}
    assert assistant_service._graph_budget_guard(budget_state, note="classify_scope") is False  # noqa: SLF001
    assert budget_state["errors"] == []

    exhausted_state = {"remaining_steps": 0, "errors": []}
    assert assistant_service._graph_budget_guard(exhausted_state, note="classify_scope") is True  # noqa: SLF001
    assert exhausted_state["errors"] == ["Orçamento de execução esgotado em classify_scope."]


@pytest.mark.parametrize(
    ("question", "expected"),
    [
        ("Quero um gráfico dos resultados", "chart"),
        ("Preciso de uma imagem resumo", "image"),
        ("Me mostre o fluxo em Mermaid", "mermaid"),
        ("Gere o PDF executivo", "pdf"),
        ("Somente texto", "text"),
    ],
)
def test_assistant_selection_helpers(question: str, expected: str, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(assistant_service, "SYSTEM_CLOCK", _FixedClock())
    assert assistant_service._detect_presentation_intent(question) == expected  # noqa: SLF001


@pytest.mark.parametrize(
    ("question", "expected"),
    [
        ("hoje", {"start": "2026-08-04", "end": "2026-08-04"}),
        ("ontem", {"start": "2026-08-03", "end": "2026-08-03"}),
        ("anteontem", {"start": "2026-08-02", "end": "2026-08-02"}),
        ("7 dias", {"start": "2026-07-29", "end": "2026-08-04"}),
        ("15 dias", {"start": "2026-07-21", "end": "2026-08-04"}),
        ("90 dias", {"start": "2026-05-07", "end": "2026-08-04"}),
        ("qualquer outra coisa", {"start": "2026-07-06", "end": "2026-08-04"}),
    ],
)
def test_assistant_date_range_helpers(question: str, expected: dict[str, str], monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(assistant_service, "SYSTEM_CLOCK", _FixedClock())
    assert assistant_service._detect_date_range(question) == expected  # noqa: SLF001


@pytest.mark.parametrize(
    ("scope", "question", "expected"),
    [
        ("generate_pdf", "preciso de um pdf de problemas", "problems"),
        ("generate_pdf", "quero um relatório executivo em pdf", "executive"),
        ("models", "qualquer pergunta", "availability"),
        ("projects", "qualquer pergunta", "projects"),
        ("problems", "qualquer pergunta", "problems"),
        ("general", "qualquer pergunta", "executive"),
    ],
)
def test_assistant_report_selection(scope: str, question: str, expected: str) -> None:
    assert assistant_service._select_report_type(question, scope) == expected  # noqa: SLF001


@pytest.mark.parametrize(
    ("report_type", "results", "expected"),
    [
        ("availability", {"availabilityReport": {"kind": "availability"}}, {"kind": "availability"}),
        ("problems", {"problemsReport": {"kind": "problems"}}, {"kind": "problems"}),
        ("projects", {"projectsReport": {"kind": "projects"}}, {"kind": "projects"}),
        ("executive", {"executiveReport": {"kind": "executive"}}, {"kind": "executive"}),
    ],
)
def test_assistant_pdf_selection_and_infer_helpers(report_type: str, results: dict[str, object], expected: dict[str, object]) -> None:
    assert assistant_service._select_report_data_for_pdf(report_type, results, {"artifact_intent": {}}) == expected  # noqa: SLF001
    assert assistant_service._infer_row_count({"items": [1, 2]}) == 2  # noqa: SLF001
    assert assistant_service._infer_row_count([1, 2, 3]) == 3  # noqa: SLF001
    assert assistant_service._infer_row_count({"missing": []}) is None  # noqa: SLF001


@pytest.mark.asyncio
async def test_assistant_prompt_and_visualization_helpers(monkeypatch: pytest.MonkeyPatch) -> None:
    state = {
        "question": "Quero um resumo visual",
        "scope": "projects",
        "response_base": {"answer": "base"},
        "required_results": {"projectsSnapshot": {"items": [1, 2]}},
        "supplemental_results": {"knowledgeSearch": {"items": [1]}},
        "citations": [{"label": "Fonte"}],
        "suggested_questions": ["Pergunta 1"],
        "visualization": {"kind": "chart"},
        "artifact_result": {"status": "claimed", "reportType": "projects"},
        "ranges": {"start": "2026-08-01", "end": "2026-08-04"},
        "scope": "projects",
    }

    prompt = assistant_service._build_synthesis_prompt(state)
    payload = json.loads(prompt)
    assert payload["question"] == "Quero um resumo visual"
    assert payload["combinedResultsKeys"] == ["knowledgeSearch", "projectsSnapshot"]
    assert payload["outputFormat"] == {"answer": "string", "contextSummary": "string"}

    assert assistant_service._parse_structured_synthesis_response("") is None  # noqa: SLF001
    assert assistant_service._parse_structured_synthesis_response("```json\n{\"answer\":\"ok\"}\n```") == {"answer": "ok"}  # noqa: SLF001
    assert assistant_service._parse_structured_synthesis_response("sem json") is None  # noqa: SLF001
    assert assistant_service._synthesis_answer_is_safe("Resposta 10", "Resposta 10 e 12") is True  # noqa: SLF001
    assert assistant_service._synthesis_answer_is_safe("Resposta 99", "Resposta 10") is False  # noqa: SLF001

    monkeypatch.setattr(
        assistant_service,
        "build_chart_spec",
        lambda **kwargs: {
            "kind": "chart",
            "chart_type": "bar",
            "title": kwargs["title"],
            "categories": ["A"],
            "series": [{"name": "Incidentes", "values": [1.0]}],
        },
    )
    monkeypatch.setattr(
        assistant_service,
        "render_summary_image",
        lambda **kwargs: {"kind": "image", "src": "https://example.test/image.webp", "alt": kwargs["title"]},
    )
    monkeypatch.setattr(
        assistant_service,
        "build_mermaid_diagram",
        lambda **kwargs: {"kind": "mermaid", "diagram": "graph TD; A-->B;", "title": kwargs["title"]},
    )
    monkeypatch.setattr(
        assistant_service,
        "generate_report_pdf",
        lambda _connection, **kwargs: {
            "kind": "pdf",
            "url": "https://example.test/report.pdf",
            "filename": f"{kwargs['report_type']}.pdf",
            "checksum": "abc123",
            "byteSize": 321,
        },
    )

    chart = assistant_service._build_chart_visualization("projects", state, {"projectsSnapshot": {"projects": [{"name": "P1"}]}})
    image = assistant_service._build_image_visualization("projects", state, {"projectsSnapshot": {"totalProjects": 2}})
    mermaid = assistant_service._build_mermaid_visualization("projects", state, {"projectsSnapshot": {"projects": []}})
    assert chart.kind == "chart"
    assert image.kind == "image"
    assert mermaid.kind == "mermaid"

    runtime_context = SimpleNamespace(connection=object())
    artifact, pdf_visualization = await assistant_service._build_pdf_artifact(
        runtime_context,
        state,
        {"projectsReport": {"summary": {"totalProjects": 1}}},
    )
    assert artifact is not None
    assert artifact["filename"] == "projects.pdf"
    assert pdf_visualization is not None
    assert pdf_visualization.kind == "image"


@pytest.mark.asyncio
async def test_assistant_grounded_text_helpers_cover_all_scope_formats() -> None:
    runtime_context = SimpleNamespace()
    base_ranges = {"start": "2026-08-01", "end": "2026-08-04"}

    cases = [
        (
            "models",
            {
                "modelSummary": {
                    "totalRuns": 12,
                    "availabilityPct": 87.5,
                    "incidentRuns": 3,
                    "topProducts": [
                        {"productName": "BAM"},
                        {"productSlug": "smec"},
                    ],
                },
                "modelHistory": {"history": [{"id": "history-1"}]},
            },
            "rodadas",
            "histórico",
        ),
        (
            "pending",
            {
                "projectsSnapshot": {
                    "totalProjects": 4,
                    "totalTasks": 9,
                    "openTasks": 3,
                    "blockedTasks": 1,
                }
            },
            "4 projetos",
            "tarefas em aberto",
        ),
        (
            "problems",
            {
                "problemSummary": {
                    "totalProblems": 5,
                    "avgResolutionHours": 7.2,
                    "problemsByCategory": [{"name": "Falha de modelo"}],
                },
                "knowledgeSearch": {"items": [{"id": "kb-1"}]},
            },
            "5 problemas",
            "base de conhecimento",
        ),
        (
            "solutions",
            {
                "problemSummary": {
                    "totalProblems": 2,
                    "totalSolutions": 6,
                }
            },
            "2 problemas",
            "6 soluções",
        ),
        (
            "projects",
            {
                "projectsSnapshot": {
                    "totalProjects": 7,
                    "openTasks": 4,
                    "blockedTasks": 2,
                    "avgProgress": 61.5,
                }
            },
            "7 itens principais",
            "progresso médio",
        ),
        (
            "reports",
            {
                "executiveReport": {"summary": {"totalProducts": 8}},
                "availabilityReport": {"avgAvailability": 91.2},
                "problemsReport": {"totalProblems": 9},
                "projectsReport": {"summary": {"totalProjects": 3}},
            },
            "resumo executivo",
            "9 problemas",
        ),
        (
            "generate_pdf",
            {},
            "PDF de projects",
            "Relatório em PDF",
        ),
        (
            "general",
            {
                "executiveReport": {"summary": {"totalProducts": 8}},
                "availabilityReport": {"avgAvailability": 91.2},
                "problemsReport": {"totalProblems": 9},
                "projectsReport": {"summary": {"totalProjects": 3}},
            },
            "cenário consolidado",
            "produtos monitorados",
        ),
    ]

    for scope, results, expected_snippet, expected_secondary in cases:
        state = {
            "scope": scope,
            "ranges": base_ranges,
            "required_results": results,
            "supplemental_results": {},
            "artifact_result": {"status": "claimed", "reportType": "projects", "filename": "projects.pdf", "url": "/reports/projects.pdf"}
            if scope == "generate_pdf"
            else {},
        }
        answer, citations, suggestions = assistant_service._build_grounded_text(state, runtime_context)

        assert expected_snippet in answer
        assert expected_secondary in answer
        assert citations
        assert suggestions

    pdf_state = {
        "scope": "generate_pdf",
        "ranges": base_ranges,
        "required_results": {},
        "supplemental_results": {},
        "artifact_result": {
            "status": "claimed",
            "reportType": "executive",
            "filename": "executive.pdf",
            "url": "/reports/executive.pdf",
        },
    }
    pdf_answer, pdf_citations, pdf_suggestions = assistant_service._build_grounded_text(pdf_state, runtime_context)
    assert "PDF de executive" in pdf_answer
    assert any(citation.label == "PDF solicitado" for citation in pdf_citations)
    assert pdf_suggestions[-1] == "Quer que eu gere outro recorte em PDF?"


def test_assistant_history_cache_and_persisted_response_helpers(monkeypatch: pytest.MonkeyPatch) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    metadata = MetaData()
    message_table = Table(
        "ai_assistant_message",
        metadata,
        Column("id", String, primary_key=True),
        Column("thread_id", String, nullable=False),
        Column("sender_type", String, nullable=False),
        Column("sender_user_id", String, nullable=True),
        Column("sender_name", String, nullable=False),
        Column("content", String, nullable=False),
        Column("metadata", JSON, nullable=True),
        Column("created_at", DateTime, nullable=False),
        Column("updated_at", DateTime, nullable=False),
    )
    metadata.create_all(engine)
    monkeypatch.setattr(assistant_service, "legacy_tables", {"ai_assistant_message": message_table})

    created_at = datetime(2026, 8, 4, 11, 0)
    with engine.begin() as connection:
        connection.execute(
            message_table.insert(),
            [
                {
                    "id": "message-1",
                    "thread_id": "thread-1",
                    "sender_type": "user",
                    "sender_user_id": "user-1",
                    "sender_name": "User One",
                    "content": "Quero um resumo dos modelos",
                    "metadata": {"scope": "models"},
                    "created_at": created_at,
                    "updated_at": created_at,
                },
                {
                    "id": "message-2",
                    "thread_id": "thread-1",
                    "sender_type": "assistant",
                    "sender_user_id": None,
                    "sender_name": "Assistente de IA",
                    "content": "Agora explique os projetos e tarefas.",
                    "metadata": {
                        "scope": "projects",
                        "answer": "Agora explique os projetos e tarefas.",
                        "visualization": {
                            "kind": "chart",
                            "chartType": "bar",
                            "title": "Resumo de projetos",
                            "categories": ["Projeto A"],
                            "series": [{"name": "Progresso", "values": [1]}],
                        },
                    },
                    "created_at": created_at.replace(minute=1),
                    "updated_at": created_at.replace(minute=1),
                },
            ],
        )

    with engine.connect() as connection:
        history = assistant_service._load_recent_history(connection, "thread-1")
        assert history == [
            {"role": "user", "content": "Quero um resumo dos modelos"},
            {"role": "assistant", "content": "Agora explique os projetos e tarefas."},
        ]
        assert assistant_service._build_conversation_memory(history) == (
            "user: Quero um resumo dos modelos | assistant: Agora explique os projetos e tarefas."
        )
        assert assistant_service._infer_last_scope(history[:1]) == "models"
        assert assistant_service._infer_last_scope(history) == "pending"

        clarification_models = assistant_service._build_clarification_from_entities(
            {"models": {"matches": [{"id": "a", "name": "A"}, {"id": "b", "name": "B"}]}},
            "models",
        )
        clarification_projects = assistant_service._build_clarification_from_entities(
            {"projects": {"matches": [{"id": "a", "name": "A"}, {"id": "b", "name": "B"}]}},
            "projects",
        )
        clarification_pdf = assistant_service._build_clarification_from_entities(
            {"problemCategories": {"matches": [{"id": "a", "name": "A"}, {"id": "b", "name": "B"}]}},
            "generate_pdf",
        )
        assert clarification_models and "modelo" in clarification_models
        assert clarification_projects and "projeto" in clarification_projects
        assert clarification_pdf and "categoria" in clarification_pdf
        assert assistant_service._build_clarification_from_entities(
            {"models": {"matches": [{"id": "a", "name": "A"}]}},
            "models",
        ) is None

        fake_settings = SimpleNamespace(
            vllm=SimpleNamespace(model="mistral", embedding_model="nomic-embed-text:v1.5", url="http://localhost:8000/v1", api_key="k", timeout_ms=30000, max_concurrent_requests=4),
            ai_agent_mode=SimpleNamespace(value="deterministic"),
        )
        runtime_context = SimpleNamespace(
            current_user=SimpleNamespace(id="user-1"),
            settings=fake_settings,
            graph_version="graph-v1",
            prompt_version="prompt-v1",
            tool_catalog_version="tool-v1",
            metric_version="metric-v1",
        )
        plan = SimpleNamespace(
            scope="projects",
            date_range={"start": "2026-08-01", "end": "2026-08-04"},
            presentation_intent="chart",
            required_sources=("projects_snapshot",),
        )
        cache_key = assistant_service._semantic_cache_key({"question": "Resumo de projetos"}, runtime_context, plan)
        assistant_service._SEMANTIC_CACHE.clear()
        state = {
            "cache_hit": False,
            "cache_eligible": True,
            "history_messages": [],
            "visualization": None,
            "artifact_result": {},
            "final_response": {"answer": "Resposta final", "citations": [], "suggestedQuestions": []},
            "cache_key": cache_key,
        }
        assistant_service._store_semantic_cache(state)
        assert cache_key in assistant_service._SEMANTIC_CACHE
        assert assistant_service._artifact_row({"artifact_result": {"artifact": {"kind": "pdf"}}}) == {"kind": "pdf"}
        assert assistant_service._artifact_row({"artifact_result": {"status": "ok"}}) is None

        monkeypatch.setattr(assistant_service, "_current_thread_summary", lambda *args, **kwargs: None)
        monkeypatch.setattr(
            assistant_service,
            "load_settings",
            lambda: SimpleNamespace(
                vllm=SimpleNamespace(
                    model="mistral",
                    embedding_model="nomic-embed-text:v1.5",
                    url="http://localhost:8000/v1",
                    api_key="k",
                    timeout_ms=30_000,
                    max_concurrent_requests=4,
                ),
                ai_agent_mode=SimpleNamespace(value="deterministic"),
            ),
        )
        monkeypatch.setattr(assistant_service, "VLLMModelRuntime", lambda settings: SimpleNamespace(settings=settings))
        monkeypatch.setattr(assistant_service, "VLLMEmbeddingRuntime", lambda settings: SimpleNamespace(settings=settings))

        cache_runtime = assistant_service._build_runtime_context_from_cache(connection, {"request_id": "req-1", "run_id": "run-1"})
        assert cache_runtime.request_id == "req-1"
        assert cache_runtime.run_id == "run-1"
        assert cache_runtime.current_user.id == ""

        response_row = {
            "id": "message-2",
            "messageId": "message-2",
            "thread_id": "thread-1",
            "url": "/reports/executive.pdf",
            "filename": "executive.pdf",
            "file_sha256": "abc123",
            "byte_size": 123,
            "reportType": "executive",
        }
        persisted = assistant_service._load_persisted_response_from_artifact(
            connection,
            response_row,
            {"thread_id": "thread-1", "scope": "projects"},
        )
        assert persisted["answer"] == "Agora explique os projetos e tarefas."
        assert persisted["artifacts"][0]["kind"] == "pdf"
        assert persisted["artifacts"][0]["filename"] == "executive.pdf"
        assert persisted["visualization"]["kind"] == "chart"


def test_assistant_thread_crud_and_state_helpers(monkeypatch: pytest.MonkeyPatch) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    metadata = MetaData()
    thread_table, message_table, artifact_table = _build_assistant_thread_tables(metadata)
    metadata.create_all(engine)

    monkeypatch.setattr(
        assistant_service,
        "legacy_tables",
        {
            "ai_assistant_thread": thread_table,
            "ai_assistant_message": message_table,
            "ai_assistant_artifact": artifact_table,
        },
    )
    delete_calls: list[tuple[str, str]] = []
    monkeypatch.setattr(
        assistant_service,
        "delete_upload_file",
        lambda kind, filename: delete_calls.append((kind, filename)),
    )
    monkeypatch.setattr(assistant_service, "SYSTEM_CLOCK", _FixedClock())
    monkeypatch.setattr(assistant_service.uuid, "uuid4", lambda: "thread-new")

    thread_base = datetime(2026, 8, 4, 10, 0)
    prune_base = datetime(2026, 8, 4, 8, 0)

    with engine.begin() as connection:
        connection.execute(
            thread_table.insert(),
            [
                {
                    "id": "thread-1",
                    "user_id": "user-1",
                    "title": "Conversa principal",
                    "last_message_preview": "Mais detalhes",
                    "message_count": 3,
                    "last_message_at": thread_base.replace(minute=2),
                    "created_at": thread_base,
                    "updated_at": thread_base,
                },
                {
                    "id": "thread-2",
                    "user_id": "user-1",
                    "title": "Conversa recente",
                    "last_message_preview": "Último assunto",
                    "message_count": 1,
                    "last_message_at": thread_base.replace(hour=11),
                    "created_at": thread_base.replace(hour=11),
                    "updated_at": thread_base.replace(hour=11, minute=30),
                },
                {
                    "id": "thread-prune",
                    "user_id": "user-1",
                    "title": "Thread de poda",
                    "last_message_preview": "Mensagem 25",
                    "message_count": 26,
                    "last_message_at": prune_base.replace(minute=25),
                    "created_at": prune_base,
                    "updated_at": prune_base.replace(minute=25),
                },
                {
                    "id": "thread-empty",
                    "user_id": "user-1",
                    "title": "Sem mensagens",
                    "last_message_preview": "",
                    "message_count": 0,
                    "last_message_at": prune_base,
                    "created_at": prune_base,
                    "updated_at": prune_base,
                },
                {
                    "id": "thread-other",
                    "user_id": "user-2",
                    "title": "Outro usuário",
                    "last_message_preview": "Ignorar",
                    "message_count": 1,
                    "last_message_at": thread_base,
                    "created_at": thread_base,
                    "updated_at": thread_base,
                },
            ],
        )
        connection.execute(
            message_table.insert(),
            [
                {
                    "id": "message-1",
                    "thread_id": "thread-1",
                    "sender_type": "user",
                    "sender_user_id": "user-1",
                    "sender_name": "User One",
                    "content": "Quero ver os modelos",
                    "metadata": {"scope": "models"},
                    "created_at": thread_base,
                    "updated_at": thread_base,
                },
                {
                    "id": "message-2",
                    "thread_id": "thread-1",
                    "sender_type": "assistant",
                    "sender_user_id": None,
                    "sender_name": "Assistente",
                    "content": "Claro, sobre projetos e tarefas.",
                    "metadata": {
                        "scope": "projects",
                        "answer": "Claro, sobre projetos e tarefas.",
                        "thinking": "  cadeia interna  ",
                        "visualization": {
                            "kind": "chart",
                            "chartType": "bar",
                            "title": "Resumo de projetos",
                            "categories": ["Projeto A"],
                            "series": [{"name": "Progresso", "values": [1]}],
                        },
                        "artifacts": [
                            {
                                "kind": "pdf",
                                "url": "/uploads/reports/second.pdf",
                                "filename": "second.pdf",
                                "title": "Relatório secundário",
                                "report_type": "projects",
                                "checksum": "abc123",
                                "byte_size": 42,
                            }
                        ],
                        "generation": {
                            "provider": "ollama",
                            "model": "mistral",
                            "status": "success",
                            "latency_ms": 42,
                            "generated_tokens": 128,
                            "thinking_time_ms": 12,
                            "error_message": None,
                        },
                    },
                    "created_at": thread_base.replace(minute=1),
                    "updated_at": thread_base.replace(minute=1),
                },
                {
                    "id": "message-3",
                    "thread_id": "thread-1",
                    "sender_type": "user",
                    "sender_user_id": "user-1",
                    "sender_name": "User One",
                    "content": "Mais detalhes",
                    "metadata": {"scope": "pending"},
                    "created_at": thread_base.replace(minute=2),
                    "updated_at": thread_base.replace(minute=2),
                },
                {
                    "id": "message-prune-00",
                    "thread_id": "thread-prune",
                    "sender_type": "assistant",
                    "sender_user_id": None,
                    "sender_name": "Assistente",
                    "content": "Mensagem 0",
                    "metadata": {"scope": "reports"},
                    "created_at": prune_base,
                    "updated_at": prune_base,
                },
                {
                    "id": "message-prune-01",
                    "thread_id": "thread-prune",
                    "sender_type": "assistant",
                    "sender_user_id": None,
                    "sender_name": "Assistente",
                    "content": "Mensagem 1",
                    "metadata": {"scope": "reports"},
                    "created_at": prune_base.replace(minute=1),
                    "updated_at": prune_base.replace(minute=1),
                },
            ]
            + [
                {
                    "id": f"message-prune-{index:02d}",
                    "thread_id": "thread-prune",
                    "sender_type": "assistant",
                    "sender_user_id": None,
                    "sender_name": "Assistente",
                    "content": f"Mensagem {index}",
                    "metadata": {"scope": "reports"},
                    "created_at": prune_base.replace(minute=index),
                    "updated_at": prune_base.replace(minute=index),
                }
                for index in range(2, 26)
            ],
        )
        connection.execute(
            artifact_table.insert(),
            [
                {
                    "id": "artifact-1",
                    "thread_id": "thread-1",
                    "message_id": "message-1",
                    "kind": "pdf",
                    "filename": "first.pdf",
                    "url": "/uploads/reports/first.pdf",
                    "reportType": "projects",
                    "file_sha256": "abc111",
                    "byte_size": 111,
                },
                {
                    "id": "artifact-2",
                    "thread_id": "thread-1",
                    "message_id": "message-2",
                    "kind": "pdf",
                    "filename": "second.pdf",
                    "url": "/uploads/reports/second.pdf",
                    "reportType": "projects",
                    "file_sha256": "abc222",
                    "byte_size": 222,
                },
                {
                    "id": "artifact-prune",
                    "thread_id": "thread-prune",
                    "message_id": "message-prune-00",
                    "kind": "pdf",
                    "filename": "prune-old.pdf",
                    "url": "/uploads/reports/prune-old.pdf",
                    "reportType": "executive",
                    "file_sha256": "abc333",
                    "byte_size": 333,
                },
            ],
        )

    with engine.connect() as connection:
        threads = assistant_service.list_assistant_threads(connection, "user-1")
        assert [thread.id for thread in threads.threads] == [
            "thread-2",
            "thread-1",
            "thread-prune",
            "thread-empty",
        ]

        created = assistant_service.create_assistant_thread(connection, "user-1", title="   ")
        assert created.thread.id == "thread-new"
        assert created.thread.title == "Nova conversa"

        loaded = assistant_service._load_thread_row_by_id(connection, "thread-1")  # noqa: SLF001
        assert loaded is not None and loaded["user_id"] == "user-1"
        assert assistant_service._load_thread_row_by_id(connection, "missing") is None  # noqa: SLF001

        details = assistant_service.get_assistant_thread_details(connection, "user-1", "thread-1")
        assert details is not None
        assert details.thread.id == "thread-1"
        assert details.thread.message_count == 3
        assert [message.id for message in details.messages] == ["message-1", "message-2", "message-3"]
        assert details.messages[1].thinking == "cadeia interna"
        assert details.messages[1].visualization is not None
        assert details.messages[1].artifacts is not None
        assert details.messages[1].artifacts[0].filename == "second.pdf"

        assert assistant_service.get_assistant_thread_details(connection, "user-2", "thread-1") is None

        summary = assistant_service._current_thread_summary(connection, "user-1", "thread-1")  # noqa: SLF001
        assert summary is not None and summary.id == "thread-1"
        fallback_summary = assistant_service._current_thread_summary(connection, "user-2", "thread-1")  # noqa: SLF001
        assert fallback_summary is not None and fallback_summary.id == "thread-1"

        visualization = assistant_service._current_visualization(  # noqa: SLF001
            {
                "visualization": {
                    "kind": "chart",
                    "chartType": "bar",
                    "title": "Visão geral",
                    "categories": ["A"],
                    "series": [{"name": "Incidentes", "values": [1]}],
                }
            }
        )
        assert visualization is not None and visualization.kind == "chart"
        assert assistant_service._current_visualization({"visualization": "bad"}) is None  # noqa: SLF001

        artifacts = assistant_service._current_artifacts(  # noqa: SLF001
            {
                "artifact_result": {
                    "status": "claimed",
                    "artifact": {
                        "kind": "pdf",
                        "url": "/uploads/reports/current.pdf",
                        "filename": "current.pdf",
                        "title": "Relatório atual",
                        "mimeType": "application/pdf",
                        "reportType": "executive",
                        "checksum": "abc444",
                        "byteSize": 444,
                    },
                }
            }
        )
        assert artifacts is not None and artifacts[0].filename == "current.pdf"
        assert assistant_service._current_artifacts({"artifact_result": {"status": "ready"}}) is None  # noqa: SLF001

        assert assistant_service._thread_title_from_question("   " + ("A" * 80) + " ") == ("A" * 57) + "..."  # noqa: SLF001
        assert assistant_service._thread_title_from_question("   ") == "Nova conversa"  # noqa: SLF001
        assert assistant_service._hash_json({"b": 2, "a": 1}) == assistant_service._hash_json({"a": 1, "b": 2})  # noqa: SLF001

        assistant_service._delete_artifact_file_if_present({"kind": "image", "filename": "ignored.webp"})  # noqa: SLF001
        assistant_service._delete_artifact_file_if_present({"kind": "pdf", "filename": "report.pdf"})  # noqa: SLF001
        assistant_service._delete_artifact_file_if_present({"kind": "pdf", "filename": None})  # noqa: SLF001
        assert delete_calls == [("reports", "report.pdf")]

        delete_calls.clear()
        assistant_service._recalculate_thread_state(connection, "thread-empty")  # noqa: SLF001
        refreshed_empty = assistant_service._load_thread_row_by_id(connection, "thread-empty")  # noqa: SLF001
        assert refreshed_empty is not None
        assert refreshed_empty["message_count"] == 0
        assert refreshed_empty["last_message_preview"] == ""
        assert refreshed_empty["last_message_at"] == FIXED_NOW.astimezone().replace(tzinfo=None)

        assistant_service._prune_thread_messages(connection, "thread-prune")  # noqa: SLF001
        assert delete_calls == [("reports", "prune-old.pdf")]
        prune_remaining = connection.execute(
            select(message_table.c.id).where(message_table.c.thread_id == "thread-prune")
        ).all()
        assert len(prune_remaining) == assistant_service.MAX_THREAD_MESSAGES

        delete_calls.clear()
        with pytest.raises(assistant_service.AssistantThreadNotFoundError):
            assistant_service.delete_assistant_message(connection, "user-2", "thread-1", "message-1")
        with pytest.raises(assistant_service.AssistantThreadNotFoundError):
            assistant_service.delete_assistant_message(connection, "user-1", "thread-1", "missing-message")

        assistant_service.delete_assistant_message(connection, "user-1", "thread-1", "message-2")
        assert delete_calls == [("reports", "second.pdf")]
        updated_thread = assistant_service._load_thread_row_by_id(connection, "thread-1")  # noqa: SLF001
        assert updated_thread is not None
        assert updated_thread["message_count"] == 2
        assert updated_thread["last_message_preview"] == "Mais detalhes"

        delete_calls.clear()
        with pytest.raises(assistant_service.AssistantThreadNotFoundError):
            assistant_service.delete_assistant_thread(connection, "user-2", "thread-1")

        assistant_service.delete_assistant_thread(connection, "user-1", "thread-1")
        assert delete_calls == [("reports", "first.pdf")]
        assert assistant_service._load_thread_row_by_id(connection, "thread-1") is None  # noqa: SLF001
        remaining_messages = connection.execute(
            select(message_table.c.id).where(message_table.c.thread_id == "thread-1")
        ).all()
        assert remaining_messages == []


def test_assistant_persistence_helpers_cover_message_and_pdf_artifact_writes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    metadata = MetaData()
    thread_table, message_table, artifact_table = _build_assistant_thread_tables(metadata)
    metadata.create_all(engine)

    monkeypatch.setattr(
        assistant_service,
        "legacy_tables",
        {
            "ai_assistant_thread": thread_table,
            "ai_assistant_message": message_table,
            "ai_assistant_artifact": artifact_table,
        },
    )
    monkeypatch.setattr(assistant_service, "SYSTEM_CLOCK", _FixedClock())
    monkeypatch.setattr(assistant_service, "get_upload_file_path", lambda kind, filename: f"/uploads/{kind}/{filename}")

    class FakeArtifactRepository:
        instances: list["FakeArtifactRepository"] = []

        def __init__(self, connection) -> None:  # noqa: ANN001
            self.connection = connection
            self.mark_ready_calls: list[dict[str, object]] = []
            self.attach_artifact_calls: list[dict[str, object]] = []
            FakeArtifactRepository.instances.append(self)

        def mark_ready(self, **kwargs) -> None:
            self.mark_ready_calls.append(kwargs)

        def attach_artifact(self, **kwargs) -> None:
            self.attach_artifact_calls.append(kwargs)

    monkeypatch.setattr(assistant_service, "AiArtifactRepository", FakeArtifactRepository)
    monkeypatch.setattr(assistant_service, "_current_thread_summary", lambda *args, **kwargs: None)

    with engine.begin() as connection:
        connection.execute(
            thread_table.insert(),
            [
                {
                    "id": "thread-persist",
                    "user_id": "user-1",
                    "title": "Conversa para persistência",
                    "last_message_preview": "",
                    "message_count": 0,
                    "last_message_at": datetime(2026, 8, 4, 10, 0),
                    "created_at": datetime(2026, 8, 4, 10, 0),
                    "updated_at": datetime(2026, 8, 4, 10, 0),
                }
            ],
        )

    with engine.connect() as connection:
        runtime_context = SimpleNamespace(
            connection=connection,
            current_user=SimpleNamespace(id="user-1", email="admin@example.test", name="Admin"),
            settings=SimpleNamespace(vllm=SimpleNamespace(model="mistral", url="http://localhost:8000/v1", api_key="k", timeout_ms=30000, max_concurrent_requests=4)),
        )
        state = {
            "thread_id": "thread-persist",
            "question": "Quero gerar um PDF executivo",
            "scope": "generate_pdf",
            "final_response": {
                "scope": "generate_pdf",
                "answer": "Resposta final",
                "thinking": "Pensando",
                "suggestedQuestions": ["Quer outro recorte?"],
                "citations": [{"label": "Fonte", "detail": "ok"}],
                "visualization": {"kind": "image", "src": "https://example.test/preview.webp", "alt": "preview"},
                "artifacts": [
                    {
                        "kind": "pdf",
                        "url": "/uploads/reports/executive.pdf",
                        "filename": "executive.pdf",
                        "title": "Relatório executivo",
                        "report_type": "executive",
                        "checksum": "abc123",
                        "byte_size": 123,
                    }
                ],
                "generation": {
                    "provider": "ollama",
                    "model": "mistral",
                    "status": "success",
                    "latencyMs": 42,
                    "generatedTokens": 128,
                    "thinkingTimeMs": 12,
                    "errorMessage": None,
                },
                "contextSummary": "scope=generate_pdf",
            },
            "artifact_result": {
                "status": "claimed",
                "idempotencyHash": "idem-1",
                "ownerToken": "owner-1",
                "reportType": "executive",
                "requestFingerprint": "fp-1",
                "artifact": {
                    "kind": "pdf",
                    "url": "/uploads/reports/executive.pdf",
                    "filename": "executive.pdf",
                    "byteSize": 123,
                    "checksum": "abc123",
                },
            },
            "progress": [],
            "errors": [],
            "observability": {},
            "required_results": {},
            "supplemental_results": {},
        }

        assistant_service._persist_user_and_assistant_messages(runtime_context, state)  # noqa: SLF001
        thread_row = assistant_service._load_thread_row_by_id(connection, "thread-persist")  # noqa: SLF001
        assert thread_row is not None
        assert thread_row["message_count"] == 2
        message_rows = connection.execute(
            select(message_table.c.id).where(message_table.c.thread_id == "thread-persist")
        ).all()
        assert len(message_rows) == 2

        assert len(FakeArtifactRepository.instances) == 1
        repo = FakeArtifactRepository.instances[0]
        assert len(repo.mark_ready_calls) == 1
        assert len(repo.attach_artifact_calls) == 1
        assert repo.mark_ready_calls[0]["report_type"] == "executive"

        assistant_service._finalize_pdf_artifact(runtime_context, state)  # noqa: SLF001
        assert len(FakeArtifactRepository.instances) == 2
        assert len(FakeArtifactRepository.instances[1].mark_ready_calls) == 1
        assert FakeArtifactRepository.instances[1].attach_artifact_calls == []


def test_assistant_validation_and_thread_lookup_branches(monkeypatch: pytest.MonkeyPatch) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    metadata = MetaData()
    thread_table, message_table, artifact_table = _build_assistant_thread_tables(metadata)
    metadata.create_all(engine)

    monkeypatch.setattr(
        assistant_service,
        "legacy_tables",
        {
            "ai_assistant_thread": thread_table,
            "ai_assistant_message": message_table,
            "ai_assistant_artifact": artifact_table,
        },
    )
    monkeypatch.setattr(assistant_service, "SYSTEM_CLOCK", _FixedClock())

    with engine.begin() as connection:
        connection.execute(
            thread_table.insert(),
            [
                {
                    "id": "thread-1",
                    "user_id": "user-1",
                    "title": "Conversa existente",
                    "last_message_preview": "Preview",
                    "message_count": 1,
                    "last_message_at": FIXED_NOW.replace(hour=11),
                    "created_at": FIXED_NOW.replace(hour=10),
                    "updated_at": FIXED_NOW.replace(hour=11),
                }
            ],
        )

    runtime = SimpleNamespace(context=SimpleNamespace(marker="ctx"))
    assert assistant_service._build_runtime_context_from_state({}, runtime) is runtime.context  # noqa: SLF001
    assert assistant_service._safe_model_validate_generation("bad") is None  # noqa: SLF001
    assert assistant_service._safe_model_validate_visualization("bad") is None  # noqa: SLF001
    assert assistant_service._safe_model_validate_artifacts("bad") is None  # noqa: SLF001
    assert assistant_service._safe_model_validate_artifacts({"artifacts": []}) is None  # noqa: SLF001

    valid_artifacts = assistant_service._safe_model_validate_artifacts(  # noqa: SLF001
        {
            "artifacts": [
                {"kind": "pdf", "url": "https://example.test/report.pdf", "filename": "report.pdf"},
                123,
            ]
        }
    )
    assert valid_artifacts is not None
    assert valid_artifacts[0].filename == "report.pdf"

    image_payload = {"kind": "image", "src": "https://example.test/preview.webp", "alt": "Preview"}
    mermaid_payload = {"kind": "mermaid", "diagram": "graph TD;A-->B;", "title": "Fluxo"}
    assert assistant_service._validate_visualization_payload(image_payload).kind == "image"  # noqa: SLF001
    assert assistant_service._validate_visualization_payload(mermaid_payload).kind == "mermaid"  # noqa: SLF001
    with pytest.raises(ValueError):
        assistant_service._validate_visualization_payload({"kind": "unknown"})  # noqa: SLF001

    with engine.connect() as connection:
        current_user = CurrentUser(id="user-1", email="user@example.test", name="User One", is_active=True)
        existing = assistant_service._get_thread_or_create(connection, current_user, "thread-1")  # noqa: SLF001
        assert existing["id"] == "thread-1"
        assert assistant_service._load_thread_row(connection, "user-1", "thread-1") is not None  # noqa: SLF001
        assert assistant_service._load_thread_row(connection, "user-2", "thread-1") is None  # noqa: SLF001

        with pytest.raises(assistant_service.AssistantThreadNotFoundError):
            assistant_service._get_thread_or_create(connection, current_user, "missing-thread")  # noqa: SLF001

        created = assistant_service._get_thread_or_create(connection, current_user, None)  # noqa: SLF001
        assert created["user_id"] == "user-1"
        assert assistant_service._load_thread_row_by_id(connection, created["id"]) is not None  # noqa: SLF001


@pytest.mark.asyncio
async def test_assistant_scope_detection_and_resolution_branches(monkeypatch: pytest.MonkeyPatch) -> None:
    class _EmbeddingProvider:
        def __init__(self, *, raise_for_question: bool = False) -> None:
            self.raise_for_question = raise_for_question

        async def embed(self, text: str) -> tuple[float, float]:
            models_profile = "disponibilidade de modelos, rodadas, intervenções e execução operacional"
            if self.raise_for_question and text == "Modelos recentes":
                raise RuntimeError("embedding indisponível")
            if text in {"Modelos recentes", models_profile}:
                return (1.0, 0.0)
            return (0.0, 1.0)

    class _ModelRuntime:
        def __init__(self, content: str) -> None:
            self.content = content

        async def complete(self, _messages):
            return SimpleNamespace(content=self.content)

    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    connection = engine.connect()
    runtime_context = SimpleNamespace(
        connection=connection,
        model_runtime=_ModelRuntime('{"scope":"projects","confidence":0.9}'),
        embedding_provider=_EmbeddingProvider(),
    )

    assert assistant_service._scope_candidates("Modelos e disponibilidade")[:2][0][0] == "models"  # noqa: SLF001

    detected_scope, confidence = await assistant_service._detect_scope("Modelos e disponibilidade", runtime_context)  # noqa: SLF001
    assert detected_scope == "models"
    assert confidence > 0.7

    embedding_scope = await assistant_service._detect_scope_by_embedding("Modelos recentes", runtime_context)  # noqa: SLF001
    assert embedding_scope == "models"

    embedding_none = await assistant_service._detect_scope_by_embedding(  # noqa: SLF001
        "Modelos recentes",
        SimpleNamespace(
            connection=connection,
            model_runtime=_ModelRuntime("{}"),
            embedding_provider=_EmbeddingProvider(raise_for_question=True),
        ),
    )
    assert embedding_none is None

    model_scope = await assistant_service._detect_scope_by_model(  # noqa: SLF001
        "Algo ambíguo sobre projetos e relatórios",
        runtime_context,
        [("projects", 1.0), ("reports", 0.9)],
    )
    assert model_scope == "projects"

    assert assistant_service._select_report_type("Gerar PDF", "generate_pdf") == "executive"  # noqa: SLF001
    assert assistant_service._select_report_type("Atualização", "unknown") == "executive"  # noqa: SLF001
    assert assistant_service._required_sources_for_scope("generate_pdf") == ("report_pdf",)  # noqa: SLF001
    assert assistant_service._required_sources_for_scope("desconhecido") == ("executive_report",)  # noqa: SLF001

    monkeypatch.setattr(assistant_service, "resolve_models", lambda _connection, _question: ["model-1"])
    monkeypatch.setattr(assistant_service, "resolve_projects", lambda _connection, _question: ["project-1"])
    monkeypatch.setattr(assistant_service, "resolve_problem_categories", lambda _connection, _question: ["category-1"])

    assert assistant_service._resolve_entities("sobre modelos", "models", connection) == {"models": ["model-1"]}  # noqa: SLF001
    assert assistant_service._resolve_entities("sobre projetos", "projects", connection) == {"projects": ["project-1"]}  # noqa: SLF001
    assert assistant_service._resolve_entities("sobre problemas", "problems", connection) == {"problemCategories": ["category-1"]}  # noqa: SLF001
    assert assistant_service._resolve_entities("geral", "general", connection) == {}  # noqa: SLF001


@pytest.mark.asyncio
async def test_assistant_scope_plan_and_pdf_claim_fallback_branches(monkeypatch: pytest.MonkeyPatch) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    connection = engine.connect()
    current_user = CurrentUser(id="user-1", email="user@example.test", name="User", is_active=True)
    original_detect_scope_by_embedding = assistant_service._detect_scope_by_embedding  # noqa: SLF001
    original_detect_scope_by_model = assistant_service._detect_scope_by_model  # noqa: SLF001
    runtime_context = SimpleNamespace(
        connection=connection,
        current_user=current_user,
        has_reports_permission=True,
        settings=SimpleNamespace(
            vllm=SimpleNamespace(model="mistral", embedding_model="nomic-embed-text:v1.5", url="http://localhost:8000/v1", api_key="k", timeout_ms=30000, max_concurrent_requests=4),
        ),
        request_id="request-1",
        run_id="run-1",
    )
    runtime = SimpleNamespace(context=runtime_context)

    async def _unexpected_scope_call(*args, **kwargs):  # noqa: ANN001
        raise AssertionError(f"unexpected call: {args!r} {kwargs!r}")

    monkeypatch.setattr(
        assistant_service,
        "_scope_candidates",
        lambda question: [("models", 2.5), ("general", 0.1)],
    )
    monkeypatch.setattr(assistant_service, "_detect_scope_by_embedding", _unexpected_scope_call)
    monkeypatch.setattr(assistant_service, "_detect_scope_by_model", _unexpected_scope_call)
    detected_scope, detected_confidence = await assistant_service._detect_scope("Modelos e disponibilidade", runtime_context)  # noqa: SLF001
    assert detected_scope == "models"
    assert detected_confidence > 0.9

    monkeypatch.setattr(
        assistant_service,
        "_scope_candidates",
        lambda question: [("reports", 0.1), ("projects", 0.05)],
    )

    async def _embedding_scope_call(question: str, runtime_context: object) -> str | None:
        del question, runtime_context
        return "reports"

    monkeypatch.setattr(assistant_service, "_detect_scope_by_embedding", _embedding_scope_call)
    monkeypatch.setattr(assistant_service, "_detect_scope_by_model", _unexpected_scope_call)
    detected_scope, detected_confidence = await assistant_service._detect_scope("Resumo ambíguo", runtime_context)  # noqa: SLF001
    assert detected_scope == "reports"
    assert detected_confidence == 0.7

    monkeypatch.setattr(
        assistant_service,
        "_scope_candidates",
        lambda question: [("projects", 0.3), ("reports", 0.25)],
    )

    async def _embedding_none(question: str, runtime_context: object) -> str | None:
        del question, runtime_context
        return None

    async def _model_scope_call(question: str, runtime_context: object, keyword_scores: list[tuple[str, float]]) -> str | None:
        del question, runtime_context, keyword_scores
        return "projects"

    monkeypatch.setattr(assistant_service, "_detect_scope_by_embedding", _embedding_none)
    monkeypatch.setattr(assistant_service, "_detect_scope_by_model", _model_scope_call)
    detected_scope, detected_confidence = await assistant_service._detect_scope("Algo ambíguo", runtime_context)  # noqa: SLF001
    assert detected_scope == "projects"
    assert detected_confidence == 0.65

    monkeypatch.setattr(
        assistant_service,
        "_scope_candidates",
        lambda question: [("general", 0.1), ("reports", 0.05)],
    )
    monkeypatch.setattr(assistant_service, "_detect_scope_by_embedding", _embedding_none)
    monkeypatch.setattr(assistant_service, "_detect_scope_by_model", _unexpected_scope_call)
    detected_scope, detected_confidence = await assistant_service._detect_scope("Pergunta aberta", runtime_context)  # noqa: SLF001
    assert detected_scope == "general"
    assert detected_confidence == 0.4

    class _EmbeddingProvider:
        def __init__(self) -> None:
            self.calls: list[str] = []

        async def embed(self, text: str) -> tuple[float, float]:
            self.calls.append(text)
            if text == "Modelos recentes":
                return (0.0, 1.0)
            if text.startswith("disponibilidade de modelos"):
                raise RuntimeError("embedding indisponível")
            if text.startswith("relatórios executivos"):
                return (0.0, 1.0)
            if text.startswith("pendências"):
                return (1.0, 0.0)
            return (0.0, 0.0)

    monkeypatch.setattr(assistant_service, "_detect_scope_by_embedding", original_detect_scope_by_embedding)
    embedding_scope = await assistant_service._detect_scope_by_embedding(
        "Modelos recentes",
        SimpleNamespace(embedding_provider=_EmbeddingProvider()),
    )  # noqa: SLF001
    assert embedding_scope == "reports"

    class _NoCompleteModelRuntime:
        pass

    monkeypatch.setattr(assistant_service, "_detect_scope_by_model", original_detect_scope_by_model)
    assert (
        await assistant_service._detect_scope_by_model(
            "Pergunta",
            SimpleNamespace(model_runtime=_NoCompleteModelRuntime()),
            [("projects", 1.0)],
        )
        is None
    )  # noqa: SLF001

    class _ExplodingModelRuntime:
        async def complete(self, _messages):  # noqa: ANN001
            raise RuntimeError("boom")

    assert (
        await assistant_service._detect_scope_by_model(
            "Pergunta",
            SimpleNamespace(model_runtime=_ExplodingModelRuntime()),
            [("projects", 1.0)],
        )
        is None
    )  # noqa: SLF001

    class _InvalidModelRuntime:
        async def complete(self, _messages):  # noqa: ANN001
            return SimpleNamespace(content="not json")

    assert (
        await assistant_service._detect_scope_by_model(
            "Pergunta",
            SimpleNamespace(model_runtime=_InvalidModelRuntime()),
            [("projects", 1.0)],
        )
        is None
    )  # noqa: SLF001

    class _UnknownScopeModelRuntime:
        async def complete(self, _messages):  # noqa: ANN001
            return SimpleNamespace(content='{"scope":"desconhecido"}')

    assert (
        await assistant_service._detect_scope_by_model(
            "Pergunta",
            SimpleNamespace(model_runtime=_UnknownScopeModelRuntime()),
            [("projects", 1.0)],
        )
        is None
    )  # noqa: SLF001

    async def _detect_scope_stub(question: str, context: object) -> tuple[str, float]:
        del question, context
        return "projects", 0.88

    monkeypatch.setattr(assistant_service, "_detect_scope", _detect_scope_stub)
    monkeypatch.setattr(assistant_service, "_detect_presentation_intent", lambda question: "pdf")
    monkeypatch.setattr(assistant_service, "_detect_date_range", lambda question: {"start": "2026-08-01", "end": "2026-08-04"})
    monkeypatch.setattr(assistant_service, "_select_report_type", lambda question, scope: "projects")
    monkeypatch.setattr(assistant_service, "_resolve_entities", lambda question, scope, connection: {"projects": ["project-1"]})

    plan = await assistant_service._plan_from_question("comparar projetos", runtime_context, {})  # noqa: SLF001
    assert plan.scope == "projects"
    assert plan.confidence == 0.88
    assert plan.presentation_intent == "pdf"
    assert plan.include_comparison is True
    assert plan.cache_eligible is False
    assert plan.required_sources == ("projects_snapshot", "projects_report")
    assert plan.resolved_entities == {"projects": ["project-1"]}

    response_stub = {"refusal": False, "clarification": False}
    monkeypatch.setattr(
        assistant_service,
        "_build_response_from_state",
        lambda state, context, **kwargs: {**response_stub, **kwargs},
    )

    empty_state = {"question": "   ", "progress": []}
    result_state = await assistant_service._node_guard_and_normalize(empty_state, runtime)  # noqa: SLF001
    assert result_state["refusal_reason"] == "A pergunta está vazia."
    assert result_state["final_response"]["refusal"] is True
    assert result_state["progress"] == ["guard_and_normalize"]

    long_state = {"question": "x" * 4001, "progress": []}
    result_state = await assistant_service._node_guard_and_normalize(long_state, runtime)  # noqa: SLF001
    assert result_state["refusal_reason"] == "A pergunta excede o limite permitido."
    assert result_state["final_response"]["refusal"] is True

    monkeypatch.setattr(assistant_service, "_get_thread_or_create", lambda connection, current_user, thread_id: {"id": "thread-1"})
    monkeypatch.setattr(assistant_service, "_load_recent_history", lambda connection, thread_id: [{"scope": "models"}])
    monkeypatch.setattr(assistant_service, "_build_conversation_memory", lambda history_messages: "memory")
    monkeypatch.setattr(assistant_service, "_infer_last_scope", lambda history_messages: None)

    valid_state = {"question": "  Resumo operacional  ", "progress": []}
    result_state = await assistant_service._node_guard_and_normalize(valid_state, runtime)  # noqa: SLF001
    assert result_state["thread_id"] == "thread-1"
    assert result_state["question"] == "Resumo operacional"
    assert result_state["normalized_question"] == "Resumo operacional"
    assert result_state["last_known_scope"] == "general"
    assert result_state["conversation_memory"] == "memory"
    assert result_state["progress"] == ["guard_and_normalize"]

    plan_state = {"final_response": {"answer": "já finalizado"}, "progress": []}
    result_state = await assistant_service._node_classify_and_plan(plan_state, runtime)  # noqa: SLF001
    assert result_state["progress"] == ["classify_and_plan"]
    assert result_state["final_response"]["answer"] == "já finalizado"

    plan_stub = assistant_service.AssistantPlan(
        scope="projects",
        confidence=0.88,
        presentation_intent="pdf",
        date_range={"start": "2026-08-01", "end": "2026-08-04"},
        report_type="projects",
        required_sources=("projects_snapshot", "projects_report"),
        include_comparison=True,
        include_knowledge_search=False,
        resolved_entities={"projects": ["project-1"]},
        cache_eligible=False,
    )

    async def _plan_stub(question: str, runtime_context: object, state: object) -> assistant_service.AssistantPlan:
        del question, runtime_context, state
        return plan_stub

    monkeypatch.setattr(assistant_service, "_plan_from_question", _plan_stub)
    monkeypatch.setattr(assistant_service, "_semantic_cache_key", lambda state, runtime_context, plan: "cache-key")

    plan_state = {"question": "Comparar projetos", "progress": []}
    result_state = await assistant_service._node_classify_and_plan(plan_state, runtime)  # noqa: SLF001
    assert result_state["scope"] == "projects"
    assert result_state["confidence"] == 0.88
    assert result_state["artifact_intent"] == {"kind": "pdf", "reportType": "projects"}
    assert result_state["cache_key"] == "cache-key"
    assert result_state["observability"]["scope"] == "projects"
    assert result_state["observability"]["cacheHit"] is False

    class _Repo:
        def __init__(self, claim_value: object) -> None:
            self.claim_value = claim_value
            self.calls: list[dict[str, object]] = []

        def claim(self, **kwargs):  # noqa: ANN001
            self.calls.append(dict(kwargs))
            return self.claim_value

    monkeypatch.setattr(assistant_service, "_build_response_from_state", lambda state, context, **kwargs: {"refusal": kwargs.get("refusal", False)})

    non_pdf_state = {"artifact_intent": {"kind": "chart"}, "progress": []}
    monkeypatch.setattr(assistant_service, "AiArtifactRepository", lambda connection: _Repo({"status": "ignored"}))
    result_state = await assistant_service._node_claim_pdf_idempotency_if_needed(non_pdf_state, runtime)  # noqa: SLF001
    assert result_state["artifact_result"] == {"status": "not_requested"}

    ready_state = {
        "artifact_intent": {"kind": "pdf", "reportType": "projects"},
        "scope": "projects",
        "question": "Gere PDF",
        "ranges": {"start": "2026-08-01", "end": "2026-08-04"},
        "entities": {"projects": ["project-1"]},
        "thread_id": "thread-1",
        "progress": [],
    }
    monkeypatch.setattr(assistant_service, "AiArtifactRepository", lambda connection: _Repo({"status": assistant_service.AI_ARTIFACT_READY, "id": "artifact-1"}))
    monkeypatch.setattr(assistant_service, "_load_persisted_response_from_artifact", lambda connection, artifact_row, state: {"loaded": True, "artifact": artifact_row})
    result_state = await assistant_service._node_claim_pdf_idempotency_if_needed(ready_state, runtime)  # noqa: SLF001
    assert result_state["artifact_result"]["status"] == "attached_hit"
    assert result_state["final_response"] == {"loaded": True, "artifact": {"status": assistant_service.AI_ARTIFACT_READY, "id": "artifact-1"}}

    pending_state = {
        "artifact_intent": {"kind": "pdf", "reportType": "projects"},
        "scope": "projects",
        "question": "Gere PDF",
        "ranges": {"start": "2026-08-01", "end": "2026-08-04"},
        "entities": {"projects": ["project-1"]},
        "thread_id": "thread-1",
        "progress": [],
    }
    monkeypatch.setattr(assistant_service, "AiArtifactRepository", lambda connection: _Repo({"status": assistant_service.AI_ARTIFACT_PENDING, "id": "artifact-2"}))
    result_state = await assistant_service._node_claim_pdf_idempotency_if_needed(pending_state, runtime)  # noqa: SLF001
    assert result_state["artifact_result"]["status"] == "conflict"
    assert result_state["refusal_reason"].startswith("Já existe uma geração de PDF")
    assert result_state["final_response"]["refusal"] is True

    existing_state = {
        "artifact_intent": {"kind": "pdf", "reportType": "projects"},
        "scope": "projects",
        "question": "Gere PDF",
        "ranges": {"start": "2026-08-01", "end": "2026-08-04"},
        "entities": {"projects": ["project-1"]},
        "thread_id": "thread-1",
        "progress": [],
    }
    monkeypatch.setattr(assistant_service, "AiArtifactRepository", lambda connection: _Repo({"status": "existing", "id": "artifact-3"}))
    result_state = await assistant_service._node_claim_pdf_idempotency_if_needed(existing_state, runtime)  # noqa: SLF001
    assert result_state["artifact_result"]["status"] == "existing"
    assert "final_response" not in result_state

    class _Claim:
        idempotency_hash = "hash-1"
        owner_token = "owner-1"
        lease_expires_at = datetime(2026, 8, 4, 13, 0)
        filename = "report.pdf"
        relative_path = "reports/report.pdf"
        url = "/api/upload/serve/reports/report.pdf"

    claimed_state = {
        "artifact_intent": {"kind": "pdf", "reportType": "projects"},
        "scope": "projects",
        "question": "Gere PDF",
        "ranges": {"start": "2026-08-01", "end": "2026-08-04"},
        "entities": {"projects": ["project-1"]},
        "thread_id": "thread-1",
        "progress": [],
    }
    monkeypatch.setattr(assistant_service, "AiArtifactRepository", lambda connection: _Repo(_Claim()))
    result_state = await assistant_service._node_claim_pdf_idempotency_if_needed(claimed_state, runtime)  # noqa: SLF001
    assert result_state["artifact_result"]["status"] == "claimed"
    assert result_state["artifact_result"]["filename"] == "report.pdf"
    assert result_state["artifact_result"]["relativePath"] == "reports/report.pdf"
    assert result_state["artifact_result"]["url"] == "/api/upload/serve/reports/report.pdf"


@pytest.mark.asyncio
async def test_assistant_node_runtime_helpers_cover_remaining_branches(monkeypatch: pytest.MonkeyPatch) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    connection = engine.connect()
    current_user = CurrentUser(id="user-1", email="user@example.test", name="User", is_active=True)
    runtime_context = SimpleNamespace(
        connection=connection,
        current_user=current_user,
        settings=SimpleNamespace(
            vllm=SimpleNamespace(model="mistral", embedding_model="nomic-embed-text:v1.5", url="http://localhost:8000/v1", api_key="k", timeout_ms=30000, max_concurrent_requests=4),
        ),
        model_runtime=SimpleNamespace(),
        embedding_provider=SimpleNamespace(),
        request_id="request-2",
        run_id="run-2",
        graph_version="graph-v1",
        prompt_version="prompt-v1",
        tool_catalog_version="tool-v1",
        metric_version="metric-v1",
        dataset_registry=DatasetRegistry(),
        clock=_FixedClock(),
        connection_factory=None,
        mode="deterministic",
        has_reports_permission=True,
    )
    runtime = SimpleNamespace(context=runtime_context)

    monkeypatch.setattr(
        assistant_service,
        "_build_response_from_state",
        lambda state, context, **kwargs: {
            "answer": state.get("answer") or state.get("response_base") or "Resposta base",
            "citations": list(state.get("citations") or []),
            "suggestedQuestions": list(state.get("suggested_questions") or []),
            "visualization": state.get("visualization") or {},
            "generation": state.get("generation") or {},
            **kwargs,
        },
    )

    # Load persisted result branch.
    load_state = {"progress": []}
    monkeypatch.setattr(assistant_service, "_artifact_row", lambda _state: None)
    loaded_state = await assistant_service._node_load_persisted_result(load_state, runtime)  # noqa: SLF001
    assert loaded_state["final_response"]["refusal"] is True

    monkeypatch.setattr(assistant_service, "_artifact_row", lambda _state: {"kind": "pdf", "filename": "report.pdf"})
    monkeypatch.setattr(
        assistant_service,
        "_load_persisted_response_from_artifact",
        lambda connection, artifact_row, state: {
            "loaded": True,
            "artifact": artifact_row,
            "state": {"progress": list(state.get("progress", []))},
        },
    )
    loaded_state = await assistant_service._node_load_persisted_result({"progress": []}, runtime)  # noqa: SLF001
    assert loaded_state["final_response"] == {
        "loaded": True,
        "artifact": {"kind": "pdf", "filename": "report.pdf"},
        "state": {"progress": ["load_persisted_result"]},
    }

    # Semantic cache branches.
    assistant_service._SEMANTIC_CACHE.clear()
    cache_state = {"progress": [], "cache_eligible": False}
    assert await assistant_service._node_semantic_cache_if_text_only(cache_state, runtime) is cache_state  # noqa: SLF001
    assert cache_state["progress"] == ["semantic_cache_if_text_only"]

    cache_state = {"progress": [], "cache_eligible": True, "cache_key": "cache-1", "history_messages": [{"role": "user", "content": "x"}]}
    assert await assistant_service._node_semantic_cache_if_text_only(cache_state, runtime) is cache_state  # noqa: SLF001
    assert cache_state["progress"] == ["semantic_cache_if_text_only"]

    monkeypatch.setattr(assistant_service.time, "time", lambda: 1_723_000_000.0)
    assistant_service._SEMANTIC_CACHE["cache-1"] = {
        "cachedAtEpochMs": 1_723_000_000_000,
        "response": {
            "answer": "Resposta cacheada",
            "citations": [{"label": "Cache"}],
            "suggestedQuestions": ["Outra pergunta"],
            "visualization": {"kind": "chart"},
        },
    }
    cache_state = {"progress": [], "cache_eligible": True, "cache_key": "cache-1", "history_messages": []}
    cached_state = await assistant_service._node_semantic_cache_if_text_only(cache_state, runtime)  # noqa: SLF001
    assert cached_state["cache_hit"] is True
    assert cached_state["final_response"]["generation"]["provider"] == "cache"

    assistant_service._SEMANTIC_CACHE["cache-expired"] = {
        "cachedAtEpochMs": 1_722_000_000_000,
        "response": {"answer": "velha"},
    }
    expired_state = {"progress": [], "cache_eligible": True, "cache_key": "cache-expired", "history_messages": []}
    await assistant_service._node_semantic_cache_if_text_only(expired_state, runtime)  # noqa: SLF001
    assert "cache-expired" not in assistant_service._SEMANTIC_CACHE

    # Tool batch and execution helpers.
    observed_tools: list[tuple[str, str, int, str]] = []
    monkeypatch.setattr(
        assistant_service,
        "_record_observability_event",
        lambda state, kind, name, duration_ms, status="success": observed_tools.append((kind, name, duration_ms, status)),
    )

    tool_state = {"errors": []}
    result = await assistant_service._run_required_tool(  # noqa: SLF001
        tool_state,
        runtime_context,
        "tool-success",
        lambda _connection: {"ok": True},
        timeout_seconds=1.0,
    )
    assert result == ("tool-success", {"ok": True})

    class _ConnectionContext:
        def __enter__(self):
            return SimpleNamespace(name="connection-from-factory")

        def __exit__(self, exc_type, exc, tb) -> bool:
            return False

    runtime_context.connection_factory = lambda: _ConnectionContext()
    result = await assistant_service._run_required_tool(  # noqa: SLF001
        tool_state,
        runtime_context,
        "tool-factory",
        lambda connection: {"connection": connection.name},
        timeout_seconds=1.0,
    )
    assert result == ("tool-factory", {"connection": "connection-from-factory"})

    async def _slow_to_thread(_call):  # noqa: ANN001
        await asyncio.sleep(0.01)

    monkeypatch.setattr(assistant_service.asyncio, "to_thread", _slow_to_thread)
    timeout_result = await assistant_service._run_required_tool(  # noqa: SLF001
        tool_state,
        runtime_context,
        "tool-timeout",
        lambda _connection: {"ok": True},
        timeout_seconds=0.001,
    )
    assert timeout_result == ("tool-timeout", None)

    async def _explode_to_thread(_call):  # noqa: ANN001
        raise RuntimeError("boom")

    monkeypatch.setattr(assistant_service.asyncio, "to_thread", _explode_to_thread)
    error_result = await assistant_service._run_required_tool(  # noqa: SLF001
        tool_state,
        runtime_context,
        "tool-error",
        lambda _connection: {"ok": True},
        timeout_seconds=1.0,
    )
    assert error_result == ("tool-error", None)

    batch_state = {"errors": []}
    results: dict[str, object] = {}

    async def _fake_run_required_tool(state, runtime_context, tool_name, callback, *, timeout_seconds):  # noqa: ANN001
        del state, runtime_context, callback, timeout_seconds
        if tool_name == "tool-none":
            return None, None
        if tool_name == "tool-null":
            return tool_name, None
        return tool_name, {"ok": True}

    monkeypatch.setattr(assistant_service, "_run_required_tool", _fake_run_required_tool)
    await assistant_service._run_required_tool_batch(  # noqa: SLF001
        runtime_context,
        results,
        batch_state,
        [
            ("tool-none", lambda _connection: None),
            ("tool-null", lambda _connection: None),
            ("tool-ok", lambda _connection: None),
        ],
    )
    assert results == {"tool-ok": {"ok": True}}
    assert any("Tool obrigatória sem resultado" in error for error in batch_state["errors"])

    tool_state = {"progress": [], "errors": [], "scope": "reports", "question": "Resumo", "remaining_steps": 3}
    runtime_context.has_reports_permission = False
    refused_state = await assistant_service._node_execute_required_data_tools(tool_state, runtime)  # noqa: SLF001
    assert refused_state["final_response"]["refusal"] is True

    runtime_context.has_reports_permission = True

    async def _boom_batch(*args, **kwargs):  # noqa: ANN001
        raise RuntimeError("batch boom")

    monkeypatch.setattr(assistant_service, "_run_required_tool_batch", _boom_batch)
    errored_state = await assistant_service._node_execute_required_data_tools({"progress": [], "errors": [], "scope": "reports", "question": "Resumo"}, runtime)  # noqa: SLF001
    assert "batch boom" in "".join(errored_state["errors"])

    class _FakeRegistry:
        def __init__(self) -> None:
            self.calls: list[dict[str, object]] = []

        def register(self, name, data, *, schema_id, source_kind, row_count, clock):  # noqa: ANN001
            self.calls.append(
                {
                    "name": name,
                    "schema_id": schema_id,
                    "source_kind": source_kind,
                    "row_count": row_count,
                    "clock": clock,
                }
            )
            from silo.ai.assistant_registry import DatasetManifest

            return DatasetManifest(
                dataset_id=f"{name}-id",
                name=name,
                schema_id=schema_id,
                source_kind=source_kind,
                checksum="abc123",
                byte_size=12,
                row_count=row_count,
                complete=True,
                truncated=False,
                created_at="2026-08-04T12:00:00+00:00",
                projected_from=None,
            )

    runtime_context.dataset_registry = _FakeRegistry()
    monkeypatch.setattr(assistant_service, "_build_grounded_text", lambda state, context: ("Resposta", [], ["Pergunta 1"]))
    monkeypatch.setattr(assistant_service, "_combined_tool_results", lambda state: {"projectsReport": {"items": [1, 2]}, "availabilityReport": {"items": [1]}})
    dataset_state = {
        "progress": [],
        "scope": "projects",
        "required_results": {"projectsReport": {"items": [1, 2]}},
        "supplemental_results": {"availabilityReport": {"items": [1]}},
    }
    dataset_state = await assistant_service._node_analyze_and_register_datasets(dataset_state, runtime)  # noqa: SLF001
    assert dataset_state["response_base"] == "Resposta"
    assert len(dataset_state["dataset_manifests"]) == 2

    # Presentation routing.
    class _Viz:
        def __init__(self, payload: dict[str, object]) -> None:
            self.payload = payload

        def model_dump(self, mode: str = "json") -> dict[str, object]:  # noqa: ARG002
            return self.payload

    monkeypatch.setattr(
        assistant_service,
        "_build_chart_visualization",
        lambda scope, state, results: _Viz({"kind": "chart", "scope": scope, "intent": "chart"}),
    )
    monkeypatch.setattr(
        assistant_service,
        "_build_image_visualization",
        lambda scope, state, results: _Viz({"kind": "image", "scope": scope, "intent": "image"}),
    )
    monkeypatch.setattr(
        assistant_service,
        "_build_mermaid_visualization",
        lambda scope, state, results: _Viz({"kind": "mermaid", "scope": scope, "intent": "mermaid"}),
    )
    async def _fake_build_pdf_artifact(runtime_context, state, results):  # noqa: ANN001
        del runtime_context, state, results
        return (
            {
                "kind": "pdf",
                "url": "/uploads/reports/report.pdf",
                "filename": "report.pdf",
                "title": "Relatório",
                "mimeType": "application/pdf",
                "reportType": "executive",
                "checksum": "abc123",
                "byteSize": 10,
            },
            _Viz({"kind": "image", "scope": "projects", "intent": "pdf"}),
        )

    monkeypatch.setattr(assistant_service, "_build_pdf_artifact", _fake_build_pdf_artifact)

    for intent in ("chart", "image", "mermaid", "pdf"):
        presentation_state = {"progress": [], "scope": "projects", "artifact_intent": {"kind": intent}, "required_results": {"projectsReport": {}}}
        presentation_state = await assistant_service._node_presentation_router(presentation_state, runtime)  # noqa: SLF001
        assert presentation_state["progress"] == ["presentation_router"]
        if intent == "pdf":
            assert presentation_state["artifact_result"]["filename"] == "report.pdf"
            assert presentation_state["visualization"]["kind"] == "image"
        else:
            assert presentation_state["visualization"]["kind"] == intent

    # Synthesis and validation.
    monkeypatch.setattr(assistant_service, "_build_synthesis_prompt", lambda state: "x" * 12001)
    synth_state = {"progress": [], "response_base": "", "question": "Resumo", "scope": "projects"}
    synth_state = await assistant_service._node_synthesize_once(synth_state, runtime)  # noqa: SLF001
    assert synth_state["generation"]["status"] == "error"

    monkeypatch.setattr(assistant_service, "_build_synthesis_prompt", lambda state: "ok")

    class _MetadataRuntime:
        async def complete_with_metadata(self, messages):  # noqa: ANN001
            del messages
            return (
                SimpleNamespace(content='{"answer":"Resposta final","contextSummary":"resumo"}'),
                SimpleNamespace(prompt_eval_count=7, output_token_count=64),
            )

    runtime.context.model_runtime = _MetadataRuntime()
    synth_state = {"progress": [], "response_base": "Resposta base", "question": "Resumo", "scope": "projects"}
    synth_state = await assistant_service._node_synthesize_once(synth_state, runtime)  # noqa: SLF001
    assert synth_state["answer"] == "Resposta final"
    assert synth_state["synthesis_context_summary"] == "resumo"

    class _TokenLimitedRuntime:
        async def complete_with_metadata(self, messages):  # noqa: ANN001
            del messages
            return (
                SimpleNamespace(content='{"answer":"Resposta 10"}'),
                SimpleNamespace(prompt_eval_count=9, output_token_count=900),
            )

    runtime.context.model_runtime = _TokenLimitedRuntime()
    token_limited_state = {"progress": [], "response_base": "Fallback", "question": "Resumo", "scope": "projects"}
    token_limited_state = await assistant_service._node_synthesize_once(token_limited_state, runtime)  # noqa: SLF001
    assert token_limited_state["generation"]["status"] == "fallback"

    class _SimpleRuntime:
        async def complete(self, messages):  # noqa: ANN001
            del messages
            return SimpleNamespace(content='{"answer":"Resposta final"}')

    runtime.context.model_runtime = _SimpleRuntime()
    simple_state = {"progress": [], "response_base": "Fallback", "question": "Resumo", "scope": "projects"}
    simple_state = await assistant_service._node_synthesize_once(simple_state, runtime)  # noqa: SLF001
    assert simple_state["generation"]["status"] == "success"

    class _ExplodingRuntime:
        async def complete(self, messages):  # noqa: ANN001
            del messages
            raise RuntimeError("synthesis boom")

    runtime.context.model_runtime = _ExplodingRuntime()
    exploded_state = {"progress": [], "response_base": "", "question": "Resumo", "scope": "projects"}
    exploded_state = await assistant_service._node_synthesize_once(exploded_state, runtime)  # noqa: SLF001
    assert exploded_state["generation"]["status"] == "error"

    validate_state = {"progress": [], "scope": "projects"}
    monkeypatch.setattr(
        assistant_service,
        "_build_response_from_state",
        lambda state, context, **kwargs: {
            "citations": [],
            "refusalReason": ("fora de escopo" if kwargs.get("refusal") else None),
            "refusal": kwargs.get("refusal", False),
        },
    )
    monkeypatch.setattr(
        assistant_service,
        "_default_citations_for_scope",
        lambda scope, state: [assistant_service.AiAssistantCitationDto(label="Fonte", detail=scope)],
    )
    validate_state = await assistant_service._node_validate_output_citations_and_artifacts(validate_state, runtime)  # noqa: SLF001
    assert validate_state["final_response"]["citations"][0]["label"] == "Fonte"
    assert validate_state["final_response"]["refusal"] is False

    refusal_validate_state = {"progress": [], "scope": "projects", "refusal_reason": "fora de escopo"}
    refusal_validate_state = await assistant_service._node_validate_output_citations_and_artifacts(refusal_validate_state, runtime)  # noqa: SLF001
    assert refusal_validate_state["final_response"]["refusal"] is True
    assert refusal_validate_state["final_response"]["citations"] == []

    persist_calls: list[str] = []
    monkeypatch.setattr(assistant_service, "_persist_user_and_assistant_messages", lambda runtime_context, state: persist_calls.append("persist"))
    monkeypatch.setattr(assistant_service, "_finalize_pdf_artifact", lambda runtime_context, state: persist_calls.append("finalize"))
    monkeypatch.setattr(assistant_service, "_store_semantic_cache", lambda state: persist_calls.append("cache"))

    attached_state = {"progress": [], "artifact_result": {"status": "attached_hit"}, "final_response": None}
    attached_state = await assistant_service._node_persist_transaction(attached_state, runtime)  # noqa: SLF001
    assert attached_state["final_response"] is not None
    assert persist_calls == []

    claimed_state = {"progress": [], "artifact_result": {"status": "claimed"}, "final_response": None}
    claimed_state = await assistant_service._node_persist_transaction(claimed_state, runtime)  # noqa: SLF001
    assert persist_calls == ["persist", "finalize", "cache"]
    assert claimed_state["final_response"] is not None

    emit_state = {"progress": [], "final_response": None}
    emit_state = await assistant_service._node_emit_result(emit_state, runtime)  # noqa: SLF001
    assert emit_state["final_response"] is not None

    # Helper branches and serialization helpers.
    tool_calls_message = SimpleNamespace(
        tool_calls=[{"id": "1", "name": "tool-a", "args": {"x": 1}}, "ignore"],
        additional_kwargs={"tool_calls": [{"id": "2", "name": "tool-b", "args": {}}]},
    )
    assert assistant_service._extract_tool_calls(tool_calls_message) == [{"id": "1", "name": "tool-a", "args": {"x": 1}}]  # noqa: SLF001
    assert assistant_service._tool_call_signature("tool-a", {"x": 1}) == assistant_service._tool_call_signature("tool-a", {"x": 1})  # noqa: SLF001
    assert assistant_service._hybrid_result_key("search_silo_knowledge") == "knowledgeSearch"  # noqa: SLF001
    assert assistant_service._hybrid_result_key("unknown") == "unknown"  # noqa: SLF001
    assert assistant_service._parse_model_scope_response("```json\n{\"scope\":\"projects\"}\n```") == {"scope": "projects"}  # noqa: SLF001
    assert assistant_service._parse_model_scope_response("sem json") is None  # noqa: SLF001
    assert assistant_service._compact_tool_result({"value": object()})[:1] == "{"  # noqa: SLF001

    state_for_observed = {"progress": []}

    async def _observed_handler(state, runtime):  # noqa: ANN001
        state["handled"] = True
        return state

    wrapper = assistant_service._observed_node("demo", _observed_handler)  # noqa: SLF001
    observed_result = await wrapper(state_for_observed, runtime)
    assert observed_result["handled"] is True
    assert any(kind == "node" and name == "demo" for kind, name, *_ in observed_tools)


def test_question_is_out_of_scope_matches_eval_cases() -> None:
    def _is_out(question: str, scope: str) -> bool:
        return assistant_service._question_is_out_of_scope(question, scope, assistant_service._scope_candidates(question))  # noqa: SLF001

    off_scope_cases = [
        "Qual filme devo assistir hoje?",
        "Me passe uma receita de bolo de chocolate.",
        "Quem ganhou o jogo de futebol ontem?",
        "Explique como investir em criptomoedas.",
        "Qual a previsão do tempo para amanhã?",
        "Escreva um poema sobre praia.",
        "Ajude a configurar um roteador doméstico.",
        "Faça uma piada sem relação com o Silo.",
        "Qual presidente venceu a última eleição?",
        "Resuma um livro de ficção científica.",
    ]
    for question in off_scope_cases:
        assert _is_out(question, "general"), question

    in_scope_cases = [
        ("Como está a operação do Silo hoje?", "general"),
        ("Qual é o estado geral da produção?", "general"),
        ("Quais áreas do Silo precisam de atenção agora?", "general"),
        ("Compare operação atual com o período anterior.", "general"),
        ("Quais modelos estão com menor disponibilidade nos últimos 30 dias?", "models"),
        ("Quais projetos estão em andamento e como acelerar os mais lentos?", "projects"),
        ("Quais problemas ainda não têm solução registrada?", "problems"),
        ("Quais relatórios devo olhar primeiro para entender o cenário de hoje?", "reports"),
    ]
    for question, scope in in_scope_cases:
        assert not _is_out(question, scope), question


@pytest.mark.asyncio
async def test_classify_and_plan_refuses_out_of_scope_questions(monkeypatch: pytest.MonkeyPatch) -> None:
    plan_stub = assistant_service.AssistantPlan(
        scope="general",
        confidence=0.4,
        presentation_intent="text",
        date_range={"start": "2026-07-16", "end": "2026-08-14"},
        report_type="executive",
        required_sources=("executive_report",),
        include_comparison=False,
        include_knowledge_search=False,
        resolved_entities={},
        cache_eligible=True,
    )

    async def _plan_stub(question: str, runtime_context: object, state: object) -> assistant_service.AssistantPlan:
        del question, runtime_context, state
        return plan_stub

    monkeypatch.setattr(assistant_service, "_plan_from_question", _plan_stub)
    monkeypatch.setattr(
        assistant_service,
        "_build_response_from_state",
        lambda state, context, **kwargs: {"refusal": kwargs.get("refusal", False)},
    )
    monkeypatch.setattr(assistant_service, "_semantic_cache_key", lambda state, context, plan: "cache-key")

    runtime = SimpleNamespace(context=SimpleNamespace())

    out_state = {"question": "Qual a previsão do tempo para amanhã?", "progress": []}
    result_state = await assistant_service._node_classify_and_plan(out_state, runtime)  # noqa: SLF001
    assert result_state["refusal_reason"] == "Esta pergunta está fora do escopo do assistente SILO."
    assert result_state["is_in_scope"] is False
    assert result_state["final_response"]["refusal"] is True

    in_state = {"question": "Como está a operação do Silo hoje?", "progress": []}
    result_state = await assistant_service._node_classify_and_plan(in_state, runtime)  # noqa: SLF001
    assert "refusal_reason" not in result_state
    assert result_state["is_in_scope"] is True
