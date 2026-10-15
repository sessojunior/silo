from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from types import SimpleNamespace

import httpx
import pytest
from langgraph.errors import GraphRecursionError
from pydantic import ValidationError

from silo.ai import assistant_runtime, assistant_service
from silo.ai.assistant_contracts import AiAssistantMessageRequestDto, AiAssistantMessageResponseDto
from silo.ai.assistant_registry import DatasetManifest
from silo.ai.observability_contract import (
    RUNTIME_METRICS,
    RuntimeMetricStore,
    record_runtime_metric,
)
from silo.ai.ports import ChatMessage, ChatResponse, RuntimeMode
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
    assert probe.fallback_reason == f"Modelo de embedding ausente: {settings.vllm.embedding_model}."
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


@pytest.mark.asyncio
async def test_probe_vllm_runtime_records_safe_fallback_metric_when_unavailable(
    tmp_path, monkeypatch
) -> None:
    settings = _make_settings(tmp_path)
    RUNTIME_METRICS.reset()

    async def fake_models(_url: str) -> list[str]:
        raise httpx.ConnectError("vllm unavailable at http://secret.internal")

    monkeypatch.setattr(assistant_runtime, "_fetch_vllm_models", fake_models)

    probe = await assistant_runtime.probe_vllm_runtime(settings)

    assert probe.mode == RuntimeMode.FALLBACK
    metrics = RUNTIME_METRICS.snapshot()["counters"]
    assert any(
        metric["name"] == "ai_graph_model_calls_total"
        and metric["labels"] == {"scope": "runtime_probe", "status": "fallback"}
        and metric["value"] == 1
        for metric in metrics
    )


@pytest.mark.asyncio
async def test_vllm_runtime_rejects_waiting_request_after_concurrency_budget(tmp_path) -> None:
    settings = _make_settings(tmp_path)
    runtime = assistant_runtime.VLLMModelRuntime(
        settings.vllm.model_copy(
            update={
                "max_concurrent_requests": 1,
                "concurrency_acquire_timeout_ms": 20,
                "timeout_ms": 1000,
            }
        )
    )
    release = __import__("asyncio").Event()

    class BlockingModel:
        async def ainvoke(self, _messages):
            await release.wait()
            return SimpleNamespace(content="ok")

    runtime._model = BlockingModel()
    first = __import__("asyncio").create_task(
        runtime.complete_with_metadata([ChatMessage(role="user", content="one")])
    )
    await __import__("asyncio").sleep(0)

    with pytest.raises(assistant_runtime.VLLMRuntimeBusyError):
        await runtime.complete_with_metadata([ChatMessage(role="user", content="two")])

    release.set()
    await first


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


def test_runtime_metrics_redact_unapproved_and_high_cardinality_labels() -> None:
    RUNTIME_METRICS.reset()

    record_runtime_metric(
        "ai_graph_fallback_total",
        {
            "scope": "reports",
            "reason": "user secret with spaces and prompt",
            "question": "private question",
        },
    )

    metrics = RUNTIME_METRICS.snapshot()["counters"]
    assert metrics == [
        {
            "name": "ai_graph_fallback_total",
            "labels": {"reason": "unknown", "scope": "reports"},
            "value": 1.0,
        }
    ]


def test_runtime_metric_store_uses_bounded_histogram_state() -> None:
    metrics = RuntimeMetricStore()

    metrics.observe("ai_graph_duration_seconds", {"scope": "reports"}, 1.0)
    metrics.observe("ai_graph_duration_seconds", {"scope": "reports"}, 2.0)
    metrics.observe("ai_graph_duration_seconds", {"scope": "reports"}, 3.0)

    key = ("ai_graph_duration_seconds", (("scope", "reports"),))
    assert metrics._observations[key].count == 3
    observation = metrics.snapshot()["observations"][0]
    assert observation["count"] == 3
    assert observation["sum"] == 6.0
    assert observation["last"] == 3.0
    assert observation["buckets"]["2"] == 2
    assert observation["buckets"]["5"] == 3


def test_runtime_metric_store_caps_label_series_with_overflow_bucket() -> None:
    metrics = RuntimeMetricStore(max_series_per_metric=2)

    metrics.increment("ai_graph_runs_total", {"scope": "reports"})
    metrics.increment("ai_graph_runs_total", {"scope": "projects"})
    metrics.increment("ai_graph_runs_total", {"scope": "products"})
    metrics.increment("ai_graph_runs_total", {"scope": "products"})

    counters = metrics.snapshot()["counters"]
    assert len(counters) == 3
    assert {
        tuple(sorted(metric["labels"].items())) for metric in counters
    } == {
        (("scope", "reports"),),
        (("scope", "projects"),),
        (("reason", "cardinality_limit"),),
    }
    overflow = next(
        metric for metric in counters if metric["labels"] == {"reason": "cardinality_limit"}
    )
    assert overflow["value"] == 2.0


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
    assert events[0].data == {
        "content": (
            "Estou consultando os dados autorizados do SILO e preparando a resposta "
            "com o modelo de IA..."
        )
    }
    assert events[1].data == {"scope": "general", "isInScope": True}
    assert events[2].data["answer"] == "Resposta final objetiva."


def test_dataset_registration_records_success_and_error_status(monkeypatch) -> None:
    metric_calls: list[tuple[str, dict[str, str]]] = []
    monkeypatch.setattr(
        assistant_service,
        "record_runtime_metric",
        lambda name, labels: metric_calls.append((name, dict(labels))),
    )
    monkeypatch.setattr(
        assistant_service,
        "_iter_dataset_registration_candidates",
        lambda _state, _results: [
            ("available", {"items": [1]}, "general.available.v1", "report"),
            ("broken", {"items": [2]}, "general.broken.v1", "report"),
        ],
    )

    class _Registry:
        def register(self, name, data, *, schema_id, source_kind, row_count, clock):
            del data, schema_id, row_count, clock
            if name == "broken":
                raise RuntimeError("dataset unavailable")
            return DatasetManifest(
                dataset_id="available-id",
                name=name,
                schema_id="general.available.v1",
                source_kind=source_kind,
                checksum="checksum",
                byte_size=10,
                row_count=1,
                created_at="2026-10-01T00:00:00Z",
            )

    runtime_context = SimpleNamespace(
        dataset_registry=_Registry(),
        clock=FrozenClock(datetime(2026, 10, 1, tzinfo=UTC)),
    )
    manifests = assistant_service._register_datasets(
        runtime_context,
        {"scope": "general"},
        {"available": {"items": [1]}},
    )

    assert len(manifests) == 1
    assert (
        "ai_graph_dataset_status_total",
        {"source_kind": "report", "status": "success"},
    ) in metric_calls
    assert (
        "ai_graph_dataset_status_total",
        {"source_kind": "report", "status": "error"},
    ) in metric_calls


@pytest.mark.asyncio
async def test_presentation_router_records_artifact_success_and_error(monkeypatch) -> None:
    metric_calls: list[tuple[str, dict[str, str]]] = []
    monkeypatch.setattr(
        assistant_service,
        "record_runtime_metric",
        lambda name, labels: metric_calls.append((name, dict(labels))),
    )

    class _Visualization:
        def model_dump(self, mode="json"):
            del mode
            return {"kind": "image"}

    async def successful_pdf(*_args):
        return {"kind": "pdf", "filename": "report.pdf"}, _Visualization()

    monkeypatch.setattr(assistant_service, "_build_pdf_artifact", successful_pdf)
    runtime = SimpleNamespace(context=SimpleNamespace())
    state = {
        "progress": [],
        "scope": "reports",
        "artifact_intent": {"kind": "pdf"},
        "required_results": {},
    }
    await assistant_service._node_presentation_router(state, runtime)

    async def failed_pdf(*_args):
        raise RuntimeError("pdf unavailable")

    monkeypatch.setattr(assistant_service, "_build_pdf_artifact", failed_pdf)
    await assistant_service._node_presentation_router(
        {
            "progress": [],
            "scope": "reports",
            "artifact_intent": {"kind": "pdf"},
            "required_results": {},
        },
        runtime,
    )

    async def skipped_pdf(*_args):
        return None, None

    monkeypatch.setattr(assistant_service, "_build_pdf_artifact", skipped_pdf)
    await assistant_service._node_presentation_router(
        {
            "progress": [],
            "scope": "reports",
            "artifact_intent": {"kind": "pdf"},
            "required_results": {},
        },
        runtime,
    )

    assert (
        "ai_graph_artifact_status_total",
        {"result_kind": "pdf", "status": "success"},
    ) in metric_calls
    assert (
        "ai_graph_artifact_status_total",
        {"result_kind": "pdf", "status": "error"},
    ) in metric_calls
    assert (
        "ai_graph_artifact_status_total",
        {"result_kind": "pdf", "status": "skipped"},
    ) in metric_calls


@pytest.mark.asyncio
async def test_stream_assistant_message_records_client_disconnect(monkeypatch) -> None:
    metric_calls: list[tuple[str, dict[str, str]]] = []
    monkeypatch.setattr(
        assistant_service,
        "record_runtime_metric",
        lambda name, labels: metric_calls.append((name, dict(labels))),
    )
    release = asyncio.Event()

    async def blocked_send(*_args, **_kwargs):
        await release.wait()
        return _make_response()

    monkeypatch.setattr(assistant_service, "send_assistant_message", blocked_send)
    stream = assistant_service.stream_assistant_message(
        connection=SimpleNamespace(),
        current_user=SimpleNamespace(id="user-1"),
        request=AiAssistantMessageRequestDto(content="Oi"),
    )
    assert (await stream.__anext__()).event == "thinking"
    pending = asyncio.create_task(stream.__anext__())
    await asyncio.sleep(0)
    pending.cancel()

    with pytest.raises(asyncio.CancelledError):
        await pending

    assert (
        "ai_graph_sse_disconnect_total",
        {"reason": "client_disconnect", "scope": "unknown"},
    ) in metric_calls
