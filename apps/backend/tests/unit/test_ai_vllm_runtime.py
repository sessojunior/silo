from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

import pytest
from langchain_core.messages import AIMessage, AIMessageChunk

from silo.ai import assistant_runtime
from silo.ai.ports import ChatMessage, RuntimeMode
from silo.config import (
    GoogleSettings,
    KafkaSettings,
    Settings,
    SmtpSettings,
    VLLMSettings,
)


# ── Fake ChatOpenAI ──────────────────────────────────────────────────────────


class _FakeChatOpenAI:
    def __init__(self, **kwargs) -> None:
        self.kwargs = kwargs
        self.bound_tools: list[object] | None = None
        self.last_ainvoke_messages = None
        self.last_stream_messages = None

    async def ainvoke(self, messages):
        self.last_ainvoke_messages = list(messages)
        return AIMessage(
            content="resposta vllm",
            usage_metadata={"input_tokens": 5, "output_tokens": 10, "total_tokens": 15},
            response_metadata={"prompt_eval_count": 8, "eval_count": 10},
        )

    async def astream(self, messages):
        self.last_stream_messages = list(messages)
        yield AIMessageChunk(content="vllm-par")
        yield SimpleNamespace(content="cial")

    def bind_tools(self, tools):
        self.bound_tools = list(tools)
        return {"tools": self.bound_tools}


class _FakeOpenAIEmbeddings:
    def __init__(self, **kwargs) -> None:
        self.kwargs = kwargs
        self.calls: list[str] = []

    async def aembed_query(self, text: str):
        self.calls.append(text)
        return [0.75 for _ in range(assistant_runtime.EMBEDDING_VECTOR_SIZE)]


# ── Tests: VLLMModelRuntime ─────────────────────────────────────────────────


def test_vllm_model_runtime_construction() -> None:
    settings = VLLMSettings(
        url="http://vllm.local:8000/v1",
        api_key="test-key",
        model="test-model",
        embedding_model="test-embed",
        timeout_ms=500,
        max_concurrent_requests=3,
    )
    with patch.object(assistant_runtime, "ChatOpenAI", _FakeChatOpenAI):
        runtime = assistant_runtime.VLLMModelRuntime(settings)

    assert runtime.settings == settings
    assert isinstance(runtime._model, _FakeChatOpenAI)
    assert runtime._model.kwargs["model"] == "test-model"
    assert runtime._model.kwargs["base_url"] == "http://vllm.local:8000/v1"
    assert runtime._model.kwargs["api_key"] == "test-key"
    assert runtime._model.kwargs["temperature"] == 0
    assert runtime._model.kwargs["max_tokens"] == 768


def test_vllm_timeout_seconds() -> None:
    settings = VLLMSettings(timeout_ms=500)
    with patch.object(assistant_runtime, "ChatOpenAI", _FakeChatOpenAI):
        runtime = assistant_runtime.VLLMModelRuntime(settings)

    # timeout_ms=500 → 0.5s, bounded by default 30.0 → min(30.0, 0.5) = 0.5, max(1.0, 0.5) = 1.0
    assert runtime._timeout_seconds(30.0) == 1.0

    slow_settings = VLLMSettings(timeout_ms=70_000)
    with patch.object(assistant_runtime, "ChatOpenAI", _FakeChatOpenAI):
        slow_runtime = assistant_runtime.VLLMModelRuntime(slow_settings)

    # timeout_ms=70000 → 70s, bounded by default 30.0 → min(30.0, 70.0) = 30.0
    assert slow_runtime._timeout_seconds(30.0) == 30.0


@pytest.mark.asyncio
async def test_vllm_model_runtime_complete() -> None:
    settings = VLLMSettings(
        url="http://vllm.local:8000/v1",
        api_key="k",
        model="m",
        embedding_model="emb",
    )
    with patch.object(assistant_runtime, "ChatOpenAI", _FakeChatOpenAI):
        runtime = assistant_runtime.VLLMModelRuntime(settings)

    response, telemetry = await runtime.complete_with_metadata(
        [ChatMessage(role="user", content="pergunta")]
    )

    assert response.content == "resposta vllm"
    assert telemetry.output_token_count == 10
    assert telemetry.prompt_eval_count == 5
    assert telemetry.latency_ms is not None
    assert telemetry.latency_ms >= 0


@pytest.mark.asyncio
async def test_vllm_model_runtime_stream() -> None:
    settings = VLLMSettings(
        url="http://vllm.local:8000/v1",
        api_key="k",
        model="m",
        embedding_model="emb",
    )
    with patch.object(assistant_runtime, "ChatOpenAI", _FakeChatOpenAI):
        runtime = assistant_runtime.VLLMModelRuntime(settings)

    chunks: list[str] = []
    async for chunk in runtime.stream([ChatMessage(role="user", content="pergunta")]):
        chunks.append(chunk)

    assert chunks == ["vllm-par", "cial"]


def test_vllm_model_runtime_bind_tools() -> None:
    settings = VLLMSettings(
        url="http://vllm.local:8000/v1",
        api_key="k",
        model="m",
        embedding_model="emb",
    )
    with patch.object(assistant_runtime, "ChatOpenAI", _FakeChatOpenAI):
        runtime = assistant_runtime.VLLMModelRuntime(settings)

    result = runtime.bind_tools(["tool-a", "tool-b"])
    assert result == {"tools": ["tool-a", "tool-b"]}


# ── Tests: VLLMEmbeddingRuntime ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_vllm_embedding_runtime_zero_text() -> None:
    settings = VLLMSettings(
        url="http://vllm.local:8000/v1",
        model="m",
        embedding_model="emb",
    )
    with patch.object(assistant_runtime, "OpenAIEmbeddings", _FakeOpenAIEmbeddings):
        runtime = assistant_runtime.VLLMEmbeddingRuntime(settings)

    vector = await runtime.embed("   ")
    assert vector == tuple(0.0 for _ in range(assistant_runtime.EMBEDDING_VECTOR_SIZE))


@pytest.mark.asyncio
async def test_vllm_embedding_runtime_cache() -> None:
    settings = VLLMSettings(
        url="http://vllm.local:8000/v1",
        model="m",
        embedding_model="emb",
    )
    with patch.object(assistant_runtime, "OpenAIEmbeddings", _FakeOpenAIEmbeddings):
        runtime = assistant_runtime.VLLMEmbeddingRuntime(settings)

    first = await runtime.embed("  texto unico  ")
    second = await runtime.embed("texto unico")

    assert first == second
    # Deve ter chamado a API apenas uma vez (cache hit na segunda)
    assert runtime._embeddings.calls == ["texto unico"]


@pytest.mark.asyncio
async def test_vllm_embedding_runtime_vector_size() -> None:
    settings = VLLMSettings(
        url="http://vllm.local:8000/v1",
        model="m",
        embedding_model="emb",
    )
    with patch.object(assistant_runtime, "OpenAIEmbeddings", _FakeOpenAIEmbeddings):
        runtime = assistant_runtime.VLLMEmbeddingRuntime(settings)

    vector = await runtime.embed("teste")
    assert len(vector) == assistant_runtime.EMBEDDING_VECTOR_SIZE
    assert all(v == 0.75 for v in vector)


# ── Tests: Factory functions ────────────────────────────────────────────────


def _minimal_settings() -> Settings:
    return Settings(
        database_url="postgresql://u:p@localhost:5432/db",
        uploads_dir="/tmp",
        session_secret="s",
        smtp=SmtpSettings(),
        google=GoogleSettings(),
        kafka=KafkaSettings(),
        vllm=VLLMSettings(url="http://localhost:8000/v1"),
    )


def test_create_model_runtime_vllm() -> None:
    settings = _minimal_settings()
    with patch.object(assistant_runtime, "ChatOpenAI", _FakeChatOpenAI):
        runtime = assistant_runtime.create_model_runtime(settings)
    assert isinstance(runtime, assistant_runtime.VLLMModelRuntime)


def test_create_embedding_runtime_vllm() -> None:
    settings = _minimal_settings()
    with patch.object(assistant_runtime, "OpenAIEmbeddings", _FakeOpenAIEmbeddings):
        runtime = assistant_runtime.create_embedding_runtime(settings)
    assert isinstance(runtime, assistant_runtime.VLLMEmbeddingRuntime)
