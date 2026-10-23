from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest
from langchain_core.messages import AIMessage
from sqlalchemy import create_engine

from silo.ai import assistant_service
from silo.ai.assistant_registry import (
    MAX_TOTAL_REGISTRY_BYTES,
    DatasetRegistry,
    DatasetRegistryError,
)


class _StructuredSynthesisRuntime:
    def __init__(self, response: str) -> None:
        self.response = response

    async def complete_with_metadata(self, _messages):
        return SimpleNamespace(content=self.response), SimpleNamespace(
            prompt_eval_count=12,
            output_token_count=8,
            latency_ms=1,
        )


class _ExplodingSynthesisRuntime:
    async def complete_with_metadata(self, _messages):
        raise RuntimeError("vllm indisponivel")


def _fake_runtime_context(connection, *, model_runtime) -> SimpleNamespace:
    return SimpleNamespace(
        connection=connection,
        settings=SimpleNamespace(
            vllm=SimpleNamespace(
                model="mistral",
                embedding_model="nomic-embed-text:v1.5",
                timeout_ms=30_000,
                max_concurrent_requests=1,
            )
        ),
        model_runtime=model_runtime,
        embedding_provider=SimpleNamespace(),
    )


def test_dataset_registry_rejects_total_size_limit() -> None:
    registry = DatasetRegistry()
    registry._total_bytes = MAX_TOTAL_REGISTRY_BYTES - 1

    with pytest.raises(DatasetRegistryError) as exc_info:
        registry.register(
            "dataset-teste",
            {"value": "x"},
            schema_id="report.v1",
            source_kind="report",
        )

    assert exc_info.value.code == "DATASET_REGISTRY_TOO_LARGE"


def test_dataset_registry_project_missing_raises() -> None:
    registry = DatasetRegistry()

    with pytest.raises(DatasetRegistryError) as exc_info:
        registry.project(
            "dataset-ausente",
            lambda data: data,
            name="dataset-projetado",
            schema_id="report.v1",
            source_kind="report",
        )

    assert exc_info.value.code == "DATASET_NOT_FOUND"


@pytest.mark.asyncio
async def test_synthesize_once_exposes_error_for_malformed_structured_output() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    with engine.connect() as connection:
        runtime_context = _fake_runtime_context(
            connection,
            model_runtime=_StructuredSynthesisRuntime(response="not-json-at-all"),
        )
        runtime = SimpleNamespace(context=runtime_context)
        state = {
            "question": "Pergunta de teste",
            "scope": "general",
            "required_results": {},
            "supplemental_results": {},
            "response_base": "Resumo base preservado",
            "answer": "",
            "progress": [],
            "final_response": {},
            "ranges": {"start": "2026-07-01", "end": "2026-07-23"},
            "citations": [],
            "suggested_questions": [],
            "artifact_result": {},
            "visualization": {},
            "synthesis_context_summary": "",
            "prompt_eval_count": 0,
        }

        await assistant_service._node_synthesize_once(state, runtime)

    assert state["answer"] == state["generation"]["errorMessage"]
    assert state["generation"]["status"] == "error"
    assert "formato inválido" in state["generation"]["errorMessage"]


@pytest.mark.asyncio
async def test_synthesize_once_exposes_error_when_vllm_fails() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    with engine.connect() as connection:
        runtime_context = _fake_runtime_context(
            connection,
            model_runtime=_ExplodingSynthesisRuntime(),
        )
        runtime = SimpleNamespace(context=runtime_context)
        state = {
            "question": "Pergunta de teste",
            "scope": "general",
            "required_results": {},
            "supplemental_results": {},
            "response_base": "Resposta determinística fundamentada",
            "answer": "",
            "progress": [],
            "final_response": {},
            "ranges": {"start": "2026-07-01", "end": "2026-07-23"},
            "citations": [],
            "suggested_questions": [],
            "artifact_result": {},
            "visualization": {},
            "synthesis_context_summary": "",
            "prompt_eval_count": 0,
        }

        await assistant_service._node_synthesize_once(state, runtime)

    assert state["answer"] == state["generation"]["errorMessage"]
    assert state["generation"]["status"] == "error"
    assert "acessar o modelo" in state["generation"]["errorMessage"]


class _RepeatingKnowledgeRuntime:
    def __init__(self) -> None:
        self.calls = 0

    def bind_tools(self, _tools):
        return self

    async def ainvoke_with_tools(self, messages, _tools):
        return await self.ainvoke(messages)

    async def ainvoke(self, _messages):
        self.calls += 1
        return AIMessage(
            content="",
            tool_calls=[
                {
                    "id": f"call-{self.calls}",
                    "name": "search_silo_knowledge",
                    "args": {"query": "consulta inicial", "limit": 5},
                    "type": "tool_call",
                }
            ],
        )


class _ProtectedKnowledgeRuntime:
    def __init__(self) -> None:
        self.calls = 0

    def bind_tools(self, _tools):
        raise AssertionError("o planner nao deve usar bind_tools cru")

    async def ainvoke_with_tools(self, _messages, _tools):
        self.calls += 1
        return AIMessage(
            content="",
            tool_calls=[
                {
                    "id": "protected-call",
                    "name": "search_silo_knowledge",
                    "args": {"query": "consulta protegida", "limit": 5},
                    "type": "tool_call",
                }
            ],
        )


class _LegacyOnlyKnowledgeRuntime:
    def bind_tools(self, _tools):
        raise AssertionError("bind_tools legado nao pode ser usado pelo planner")


class _ExplodingProtectedKnowledgeRuntime:
    async def ainvoke_with_tools(self, _messages, _tools):
        raise RuntimeError("planner indisponivel")


def _agentic_state() -> dict[str, object]:
    return {
        "question": "Encontre evidências sobre o problema",
        "scope": "general",
        "mode": "hybrid",
        "supplemental_results": {},
        "required_results": {},
        "final_response": {},
        "remaining_steps": 24,
        "progress": [],
        "errors": [],
        "observability": {"toolCalls": [], "counts": {"tools": 0}},
        "ranges": {"start": "2026-07-01", "end": "2026-07-23"},
    }


@pytest.mark.asyncio
async def test_agentic_loop_reformula_busca_sem_evidencia_e_deduplica_resultados(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    runtime_model = _RepeatingKnowledgeRuntime()
    runtime = SimpleNamespace(
        context=SimpleNamespace(
            model_runtime=runtime_model,
            settings=SimpleNamespace(
                ai_agent_max_rounds=2,
                ai_agent_max_tool_calls=4,
                ai_agent_tool_timeout_ms=1_000,
            ),
            has_reports_permission=True,
            connection=engine.connect(),
            connection_factory=None,
            tool_catalog_version="test",
            graph_version="test",
            prompt_version="test",
        )
    )
    state = _agentic_state()
    search_queries: list[str] = []

    async def fake_execute(_tool_name, _context, _state, args):
        query = str(args["query"])
        search_queries.append(query)
        similarity = 0.1 if len(search_queries) == 1 else 0.9
        return SimpleNamespace(name="search_silo_knowledge"), {
            "query": query,
            "items": [
                {
                    "source": "manual",
                    "sourceKind": "manual",
                    "id": "manual-1",
                    "content": "Evidência do manual.",
                    "similarity": similarity,
                }
            ],
        }

    monkeypatch.setattr(assistant_service, "execute_hybrid_tool_async", fake_execute)

    await assistant_service._node_agent_decide(state, runtime)

    assert runtime_model.calls == 2
    assert search_queries[0] == "consulta inicial"
    assert search_queries[1] != search_queries[0]
    items = state["supplemental_results"]["knowledgeSearch"]["items"]  # type: ignore[index]
    assert [item["id"] for item in items] == ["manual-1"]


@pytest.mark.asyncio
async def test_agentic_loop_usa_invocacao_protegida_do_runtime(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    runtime_model = _ProtectedKnowledgeRuntime()
    runtime = SimpleNamespace(
        context=SimpleNamespace(
            model_runtime=runtime_model,
            settings=SimpleNamespace(
                ai_agent_max_rounds=1,
                ai_agent_max_tool_calls=1,
                ai_agent_tool_timeout_ms=1_000,
            ),
            has_reports_permission=True,
            connection=engine.connect(),
            connection_factory=None,
            tool_catalog_version="test",
            graph_version="test",
            prompt_version="test",
        )
    )
    state = _agentic_state()

    async def fake_execute(_tool_name, _context, _state, _args):
        return SimpleNamespace(name="search_silo_knowledge"), {"items": []}

    monkeypatch.setattr(assistant_service, "execute_hybrid_tool_async", fake_execute)

    await assistant_service._node_agent_decide(state, runtime)

    assert runtime_model.calls == 1


@pytest.mark.asyncio
async def test_agentic_loop_recusa_runtime_sem_invocacao_protegida() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    runtime = SimpleNamespace(
        context=SimpleNamespace(
            model_runtime=_LegacyOnlyKnowledgeRuntime(),
            settings=SimpleNamespace(
                ai_agent_max_rounds=1,
                ai_agent_max_tool_calls=1,
                ai_agent_tool_timeout_ms=1_000,
            ),
            has_reports_permission=True,
            connection=engine.connect(),
            connection_factory=None,
            tool_catalog_version="test",
            graph_version="test",
            prompt_version="test",
        )
    )
    state = _agentic_state()

    await assistant_service._node_agent_decide(state, runtime)

    assert state["supplemental_results"] == {}
    assert any("invocaÃ§Ã£o protegida" in error for error in state["errors"])


@pytest.mark.asyncio
async def test_agentic_loop_registra_erro_generico_do_planner() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    runtime = SimpleNamespace(
        context=SimpleNamespace(
            model_runtime=_ExplodingProtectedKnowledgeRuntime(),
            settings=SimpleNamespace(
                ai_agent_max_rounds=1,
                ai_agent_max_tool_calls=1,
                ai_agent_tool_timeout_ms=1_000,
            ),
            has_reports_permission=True,
            connection=engine.connect(),
            connection_factory=None,
            tool_catalog_version="test",
            graph_version="test",
            prompt_version="test",
        )
    )
    state = _agentic_state()

    await assistant_service._node_agent_decide(state, runtime)

    assert any(
        event["name"] == "hybrid_round_1" and event["status"] == "error"
        for event in state["observability"]["modelCalls"]
    )


@pytest.mark.asyncio
async def test_agentic_loop_aplica_limite_de_chamadas_e_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    runtime_model = _RepeatingKnowledgeRuntime()
    runtime = SimpleNamespace(
        context=SimpleNamespace(
            model_runtime=runtime_model,
            settings=SimpleNamespace(
                ai_agent_max_rounds=4,
                ai_agent_max_tool_calls=1,
                ai_agent_tool_timeout_ms=1,
            ),
            has_reports_permission=True,
            connection=engine.connect(),
            connection_factory=None,
            tool_catalog_version="test",
            graph_version="test",
            prompt_version="test",
        )
    )
    state = _agentic_state()

    async def slow_execute(_tool_name, _context, _state, _args):
        await asyncio.sleep(0.2)
        return SimpleNamespace(name="search_silo_knowledge"), {"items": []}

    monkeypatch.setattr(assistant_service, "execute_hybrid_tool_async", slow_execute)

    await assistant_service._node_agent_decide(state, runtime)

    assert runtime_model.calls == 1
    assert state["supplemental_results"] == {}
    assert any(
        event["status"] == "timeout" for event in state["observability"]["toolCalls"]  # type: ignore[index]
    )


class _BurstToolRuntime:
    def bind_tools(self, _tools):
        return self

    async def ainvoke_with_tools(self, _messages, _tools):
        return await self.ainvoke(_messages)

    async def ainvoke(self, _messages):
        return AIMessage(
            content="",
            tool_calls=[
                {
                    "id": "burst-1",
                    "name": "search_silo_knowledge",
                    "args": {"query": "consulta 1", "limit": 5},
                    "type": "tool_call",
                },
                {
                    "id": "burst-2",
                    "name": "search_silo_knowledge",
                    "args": {"query": "consulta 2", "limit": 5},
                    "type": "tool_call",
                },
            ],
        )


@pytest.mark.asyncio
async def test_agentic_loop_respeita_limite_de_chamadas_no_mesmo_turno(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    runtime = SimpleNamespace(
        context=SimpleNamespace(
            model_runtime=_BurstToolRuntime(),
            settings=SimpleNamespace(
                ai_agent_max_rounds=1,
                ai_agent_max_tool_calls=1,
                ai_agent_tool_timeout_ms=1_000,
            ),
            has_reports_permission=True,
            connection=engine.connect(),
            connection_factory=None,
            tool_catalog_version="test",
            graph_version="test",
            prompt_version="test",
        )
    )
    state = _agentic_state()
    executed: list[str] = []

    async def fake_execute(_tool_name, _context, _state, args):
        executed.append(str(args["query"]))
        return SimpleNamespace(name="search_silo_knowledge"), {"items": []}

    monkeypatch.setattr(assistant_service, "execute_hybrid_tool_async", fake_execute)

    await assistant_service._node_agent_decide(state, runtime)

    assert executed == ["consulta 1"]
