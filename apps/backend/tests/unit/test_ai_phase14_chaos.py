from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace

import httpx
import pytest
from langgraph.errors import GraphRecursionError
from pydantic import ValidationError

from silo.ai import assistant_runtime, assistant_service
from silo.ai.assistant_contracts import AiAssistantMessageRequestDto, AiAssistantMessageResponseDto
from silo.ai.ports import ChatResponse, RuntimeMode
from silo.clock import FrozenClock
from silo.config import load_settings


class _FakeDatasetRegistry:
    def __init__(self) -> None:
        self.cleared = False

    def clear(self) -> None:
        self.cleared = True


class _FakeGraph:
    def __init__(self, payload: dict[str, object]) -> None:
        self.payload = payload
        self.calls: list[tuple[dict[str, object], object]] = []

    async def ainvoke(self, state, context):
        self.calls.append((state, context))
        return self.payload


def _make_settings(tmp_path) -> object:
    return load_settings(
        {
            "DATABASE_URL": "postgresql://test-user:test-pass@localhost:5432/silo",
            "SESSION_SECRET": "session-secret",
            "ALLOWED_EMAIL_DOMAINS": "example.test",
            "APP_URL_DEV": "http://localhost:3000",
            "VLLM_URL": "http://localhost:8000/v1",
            "UPLOADS_DIR": str(tmp_path / "uploads"),
        }
    )


def _make_response() -> AiAssistantMessageResponseDto:
    return AiAssistantMessageResponseDto(
        thread_id="thread-1",
        scope="general",
        is_in_scope=True,
        answer="Resposta final objetiva.",
        suggested_questions=["Quais próximos passos?"],
        citations=[{"label": "Relatório", "detail": "ok"}],
        context_summary="Resumo operacional.",
    )


@pytest.mark.asyncio
async def test_probe_vllm_runtime_reports_success_when_models_are_available(
    tmp_path, monkeypatch
) -> None:
    settings = _make_settings(tmp_path)
    calls: list[str] = []

    async def fake_models(_url: str) -> list[str]:
        return [settings.vllm.model, settings.vllm.embedding_model]

    class FakeChatRuntime:
        async def complete(self, messages):
            calls.append("chat")
            assert messages[0].content == "Responda apenas com a palavra ok."
            return ChatResponse(content="ok")

    class FakeEmbeddingRuntime:
        async def embed(self, text: str):
            calls.append(text)
            return tuple(0.5 for _ in range(assistant_runtime.EMBEDDING_VECTOR_SIZE))

    monkeypatch.setattr(assistant_runtime, "_fetch_vllm_models", fake_models)

    probe = await assistant_runtime.probe_vllm_runtime(
        settings,
        clock=FrozenClock(datetime(2026, 7, 22, 12, 0, tzinfo=UTC)),
        chat_runtime=FakeChatRuntime(),
        embedding_runtime=FakeEmbeddingRuntime(),
    )

    assert probe.mode == RuntimeMode.VLLM
    assert probe.fallback_reason is None
    assert probe.embedding_mode == RuntimeMode.VLLM
    assert calls == ["chat", "probe"]


@pytest.mark.asyncio
async def test_probe_vllm_runtime_falls_back_when_embedding_model_is_missing(
    tmp_path,
    monkeypatch,
) -> None:
    settings = _make_settings(tmp_path)

    async def fake_models(_url: str) -> list[str]:
        return [settings.vllm.model]

    class FakeChatRuntime:
        async def complete(self, _messages):  # pragma: no cover - should not be called
            raise AssertionError("chat runtime should not be called on fallback")

    class FakeEmbeddingRuntime:
        async def embed(self, _text):  # pragma: no cover - should not be called
            raise AssertionError("embedding runtime should not be called on fallback")

    monkeypatch.setattr(assistant_runtime, "_fetch_vllm_models", fake_models)

    probe = await assistant_runtime.probe_vllm_runtime(
        settings,
        clock=FrozenClock(datetime(2026, 7, 22, 12, 0, tzinfo=UTC)),
        chat_runtime=FakeChatRuntime(),
        embedding_runtime=FakeEmbeddingRuntime(),
    )

    assert probe.mode == RuntimeMode.FALLBACK
    assert probe.embedding_mode == RuntimeMode.FALLBACK
    assert (
        probe.fallback_reason
        == f"Modelo de embedding ausente: {settings.vllm.embedding_model}."
    )
    assert probe.embedding_latency_ms is None


@pytest.mark.asyncio
async def test_probe_vllm_runtime_falls_back_on_inventory_timeout(tmp_path, monkeypatch) -> None:
    settings = _make_settings(tmp_path)

    async def fake_models(_url: str) -> list[str]:
        raise httpx.ReadTimeout("vllm timed out")

    class FakeChatRuntime:
        async def complete(self, _messages):  # pragma: no cover - should not be called
            raise AssertionError("chat runtime should not be called on timeout fallback")

    class FakeEmbeddingRuntime:
        async def embed(self, _text):  # pragma: no cover - should not be called
            raise AssertionError("embedding runtime should not be called on timeout fallback")

    monkeypatch.setattr(assistant_runtime, "_fetch_vllm_models", fake_models)

    probe = await assistant_runtime.probe_vllm_runtime(
        settings,
        clock=FrozenClock(datetime(2026, 7, 22, 12, 0, tzinfo=UTC)),
        chat_runtime=FakeChatRuntime(),
        embedding_runtime=FakeEmbeddingRuntime(),
    )

    assert probe.mode == RuntimeMode.FALLBACK
    assert probe.embedding_mode == RuntimeMode.FALLBACK
    assert "timed out" in (probe.fallback_reason or "")


def test_ensure_finite_vector_rejects_invalid_embedding_payloads() -> None:
    assert assistant_runtime._ensure_finite_vector(
        [0.0] * assistant_runtime.EMBEDDING_VECTOR_SIZE, allow_zero_vector=True
    ) == tuple(0.0 for _ in range(assistant_runtime.EMBEDDING_VECTOR_SIZE))

    with pytest.raises(ValueError, match="exatamente 768 dimensões"):
        assistant_runtime._ensure_finite_vector(
            [0.0] * (assistant_runtime.EMBEDDING_VECTOR_SIZE - 1)
        )

    with pytest.raises(ValueError, match="Embedding zero não é permitido"):
        assistant_runtime._ensure_finite_vector([0.0] * assistant_runtime.EMBEDDING_VECTOR_SIZE)

    payload = [1.0] * assistant_runtime.EMBEDDING_VECTOR_SIZE
    payload[3] = float("nan")
    with pytest.raises(ValueError, match="NaN ou Infinity"):
        assistant_runtime._ensure_finite_vector(payload, allow_zero_vector=True)


@pytest.mark.asyncio
async def test_send_assistant_message_clears_dataset_registry_even_when_validation_fails(
    monkeypatch,
) -> None:
    registry = _FakeDatasetRegistry()
    runtime_context = SimpleNamespace(
        request_id="request-1",
        run_id="run-1",
        mode="deterministic",
        graph_version="2026-07-23",
        prompt_version="2026-07-23",
        tool_catalog_version="2026-07-23",
        metric_version="2026-07-23",
        dataset_registry=registry,
    )

    async def fake_ainvoke(state, context):
        assert state["request_id"] == "request-1"
        assert context is runtime_context
        return {"final_response": {"scope": "general", "is_in_scope": True}}

    monkeypatch.setattr(
        assistant_service, "_build_runtime_context", lambda *args, **kwargs: runtime_context
    )
    monkeypatch.setattr(
        assistant_service, "get_assistant_graph", lambda: SimpleNamespace(ainvoke=fake_ainvoke)
    )

    with pytest.raises(ValidationError):
        await assistant_service.send_assistant_message(
            connection=SimpleNamespace(),
            current_user=SimpleNamespace(id="user-1"),
            request=AiAssistantMessageRequestDto(content="Oi"),
            request_id="request-1",
        )

    assert registry.cleared is True


@pytest.mark.asyncio
async def test_send_assistant_message_clears_dataset_registry_on_graph_recursion_error(
    monkeypatch,
) -> None:
    registry = _FakeDatasetRegistry()
    runtime_context = SimpleNamespace(
        request_id="request-1",
        run_id="run-1",
        mode="deterministic",
        graph_version="2026-07-23",
        prompt_version="2026-07-23",
        tool_catalog_version="2026-07-23",
        metric_version="2026-07-23",
        dataset_registry=registry,
    )

    async def fake_ainvoke(state, context):
        assert state["request_id"] == "request-1"
        assert context is runtime_context
        raise GraphRecursionError("recursion limit exceeded")

    monkeypatch.setattr(
        assistant_service, "_build_runtime_context", lambda *args, **kwargs: runtime_context
    )
    monkeypatch.setattr(
        assistant_service, "get_assistant_graph", lambda: SimpleNamespace(ainvoke=fake_ainvoke)
    )

    with pytest.raises(GraphRecursionError):
        await assistant_service.send_assistant_message(
            connection=SimpleNamespace(),
            current_user=SimpleNamespace(id="user-1"),
            request=AiAssistantMessageRequestDto(content="Oi"),
            request_id="request-1",
        )

    assert registry.cleared is True


@pytest.mark.asyncio
async def test_stream_assistant_message_emits_expected_events(monkeypatch) -> None:
    response = _make_response()

    async def fake_send_assistant_message(*args, **kwargs):
        return response

    monkeypatch.setattr(assistant_service, "send_assistant_message", fake_send_assistant_message)

    events = []
    async for event in assistant_service.stream_assistant_message(
        connection=SimpleNamespace(),
        current_user=SimpleNamespace(id="user-1"),
        request=AiAssistantMessageRequestDto(content="Oi"),
    ):
        events.append(event)

    assert [event.event for event in events] == ["thinking", "scope", "result"]
    assert events[0].data == {"content": "Processando solicitação com as tools autorizadas."}
    assert events[1].data == {"scope": "general", "isInScope": True}
    assert events[2].data["answer"] == "Resposta final objetiva."
