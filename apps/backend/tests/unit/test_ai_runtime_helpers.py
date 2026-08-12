from __future__ import annotations

from types import SimpleNamespace

import pytest
from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage, SystemMessage

from silo.ai import assistant_runtime
from silo.ai.ports import ChatMessage
from silo.config import VLLMSettings


class _FakeChatOpenAI:
    def __init__(self, **kwargs) -> None:
        self.kwargs = kwargs
        self.bound_tools: list[object] | None = None
        self.last_ainvoke_messages = None
        self.last_stream_messages = None

    async def ainvoke(self, messages):
        self.last_ainvoke_messages = list(messages)
        return AIMessage(
            content="resposta sintetica",
            usage_metadata={"input_tokens": 7, "output_tokens": 13, "total_tokens": 20},
            response_metadata={"prompt_eval_count": 11, "eval_count": 13},
        )

    async def astream(self, messages):
        self.last_stream_messages = list(messages)
        yield AIMessageChunk(content="par")
        yield SimpleNamespace(content="cial")

    def bind_tools(self, tools):
        self.bound_tools = list(tools)
        return {"tools": self.bound_tools}


class _FakeEmbeddings:
    def __init__(self, **kwargs) -> None:
        self.kwargs = kwargs
        self.calls: list[str] = []

    async def aembed_query(self, text: str):
        self.calls.append(text)
        return [0.5 for _ in range(assistant_runtime.EMBEDDING_VECTOR_SIZE)]


def test_message_and_token_helpers_cover_core_branches(monkeypatch: pytest.MonkeyPatch) -> None:
    assistant_message = assistant_runtime._message_to_langchain(
        ChatMessage(role="assistant", content="oi")
    )
    system_message = assistant_runtime._message_to_langchain(
        ChatMessage(role=" system ", content="boas-vindas")
    )
    human_message = assistant_runtime._message_to_langchain(
        ChatMessage(role="user", content="pergunta")
    )

    assert isinstance(assistant_message, AIMessage)
    assert isinstance(system_message, SystemMessage)
    assert isinstance(human_message, HumanMessage)

    assert assistant_runtime._coerce_text("texto") == "texto"
    assert assistant_runtime._coerce_text(["a", {"text": "b"}, {"content": "c"}, 1]) == "abc"
    assert assistant_runtime._coerce_text(123) == "123"

    monkeypatch.setattr(assistant_runtime, "ChatOpenAI", _FakeChatOpenAI)
    settings = VLLMSettings(
        url="http://vllm.local:8000/v1",
        api_key="k",
        model="chat-model",
        embedding_model="embed-model",
        timeout_ms=500,
        max_concurrent_requests=2,
    )
    runtime = assistant_runtime.VLLMModelRuntime(settings)

    assert runtime._timeout_seconds(30.0) == 1.0

    slower_runtime = assistant_runtime.VLLMModelRuntime(
        VLLMSettings(
            url="http://vllm.local:8000/v1",
            api_key="k",
            model="chat-model",
            embedding_model="embed-model",
            timeout_ms=70_000,
            max_concurrent_requests=2,
        )
    )
    assert slower_runtime._timeout_seconds(30.0) == 30.0

    message = AIMessage(
        content="ok",
        usage_metadata={"input_tokens": 9, "output_tokens": 4, "total_tokens": 13},
    )
    assert assistant_runtime._extract_token_count(message) == 4
    assert assistant_runtime._extract_prompt_eval_count(message) == 9

    metadata_message = AIMessage(
        content="ok",
        response_metadata={"eval_count": 6, "prompt_eval_count": 5},
    )
    assert assistant_runtime._extract_token_count(metadata_message) == 6
    assert assistant_runtime._extract_prompt_eval_count(metadata_message) == 5


@pytest.mark.asyncio
async def test_model_and_embedding_runtimes_cover_stream_and_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(assistant_runtime, "ChatOpenAI", _FakeChatOpenAI)
    monkeypatch.setattr(assistant_runtime, "OpenAIEmbeddings", _FakeEmbeddings)

    settings = VLLMSettings(
        url="http://vllm.local:8000/v1",
        api_key="k",
        model="chat-model",
        embedding_model="embed-model",
        timeout_ms=2_000,
        max_concurrent_requests=1,
    )

    model_runtime = assistant_runtime.VLLMModelRuntime(settings)
    response, telemetry = await model_runtime.complete_with_metadata(
        [ChatMessage(role="user", content="resuma")]
    )

    assert response.content == "resposta sintetica"
    assert telemetry.output_token_count == 13
    assert telemetry.prompt_eval_count == 7
    assert model_runtime.bind_tools(["tool-a"]) == {"tools": ["tool-a"]}

    streamed = []
    async for chunk in model_runtime.stream([ChatMessage(role="user", content="resuma")]):
        streamed.append(chunk)

    assert streamed == ["par", "cial"]
    assert isinstance(model_runtime._model.last_ainvoke_messages[0], HumanMessage)
    assert isinstance(model_runtime._model.last_stream_messages[0], HumanMessage)

    embedding_runtime = assistant_runtime.VLLMEmbeddingRuntime(settings)
    zero_vector = await embedding_runtime.embed("   ")
    assert zero_vector == tuple(0.0 for _ in range(assistant_runtime.EMBEDDING_VECTOR_SIZE))

    first_vector = await embedding_runtime.embed("  texto de teste  ")
    second_vector = await embedding_runtime.embed("texto de teste")

    assert first_vector == second_vector
    assert embedding_runtime._embeddings.calls == ["texto de teste"]
