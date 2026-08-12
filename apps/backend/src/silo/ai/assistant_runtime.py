from __future__ import annotations

import asyncio
import hashlib
import time
from collections import OrderedDict
from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

import httpx
from langchain_core.messages import AIMessage, AIMessageChunk, BaseMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

from silo.ai.ports import AiRuntimeProbe, ChatMessage, ChatModelRuntime, ChatPort, ChatResponse, EmbeddingPort, RuntimeMode
from silo.config import VLLMSettings, Settings
from silo.clock import SYSTEM_CLOCK, Clock

DEFAULT_CHAT_TIMEOUT_SECONDS = 30.0
DEFAULT_EMBEDDING_TIMEOUT_SECONDS = 30.0
EMBEDDING_VECTOR_SIZE = 768
EMBEDDING_CACHE_MAX_SIZE = 256


def _message_to_langchain(message: ChatMessage) -> BaseMessage:
    role = message.role.strip().lower()
    if role == "assistant":
        return AIMessage(content=message.content)
    if role == "system":
        return SystemMessage(content=message.content)
    return HumanMessage(content=message.content)


def _coerce_text(value: object) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        parts: list[str] = []
        for item in value:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                text = item.get("text") or item.get("content")
                if isinstance(text, str):
                    parts.append(text)
        return "".join(parts)
    return str(value)


def _ensure_finite_vector(values: Sequence[float], *, allow_zero_vector: bool = False) -> tuple[float, ...]:
    if len(values) != EMBEDDING_VECTOR_SIZE:
        raise ValueError(
            f"Embedding deve ter exatamente {EMBEDDING_VECTOR_SIZE} dimensões; "
            f"recebido {len(values)}."
        )

    vector = tuple(float(value) for value in values)
    if any(not (value == value and value not in (float("inf"), float("-inf"))) for value in vector):
        raise ValueError("Embedding contém NaN ou Infinity.")

    if not allow_zero_vector and not any(value != 0.0 for value in vector):
        raise ValueError("Embedding zero não é permitido para este texto.")

    return vector


def _extract_token_count(message: AIMessage) -> int | None:
    usage = getattr(message, "usage_metadata", None)
    if isinstance(usage, dict):
        for key in ("output_tokens", "completion_tokens", "generated_tokens"):
            value = usage.get(key)
            if isinstance(value, int) and value >= 0:
                return value

    metadata = getattr(message, "response_metadata", None)
    if isinstance(metadata, dict):
        for key in ("eval_count", "output_tokens", "completion_tokens"):
            value = metadata.get(key)
            if isinstance(value, int) and value >= 0:
                return value

    return None


def _extract_prompt_eval_count(message: AIMessage) -> int | None:
    usage = getattr(message, "usage_metadata", None)
    if isinstance(usage, dict):
        for key in ("input_tokens", "prompt_tokens", "prompt_eval_count"):
            value = usage.get(key)
            if isinstance(value, int) and value >= 0:
                return value

    metadata = getattr(message, "response_metadata", None)
    if isinstance(metadata, dict):
        for key in ("prompt_eval_count", "input_tokens", "prompt_tokens"):
            value = metadata.get(key)
            if isinstance(value, int) and value >= 0:
                return value

    return None


@dataclass(slots=True)
class VLLMModelRuntime(ChatModelRuntime):
    settings: VLLMSettings
    semaphore: asyncio.Semaphore = field(init=False)
    _model: ChatOpenAI = field(init=False, repr=False)

    def __post_init__(self) -> None:
        self.semaphore = asyncio.Semaphore(max(1, int(self.settings.max_concurrent_requests)))
        self._model = ChatOpenAI(
            model=self.settings.model,
            base_url=self.settings.url,
            api_key=self.settings.api_key,
            temperature=0,
            max_tokens=768,
        )

    async def complete(self, messages: Sequence[ChatMessage]) -> ChatResponse:
        response, _telemetry = await self.complete_with_metadata(messages)
        return response

    async def stream(self, messages: Sequence[ChatMessage]) -> AsyncIterator[str]:
        async with self.semaphore:
            stream = self._model.astream([_message_to_langchain(message) for message in messages])
            async for chunk in stream:
                if isinstance(chunk, AIMessageChunk):
                    yield _coerce_text(chunk.content)
                else:
                    yield _coerce_text(getattr(chunk, "content", chunk))

    async def complete_with_metadata(self, messages: Sequence[ChatMessage]) -> tuple[ChatResponse, ChatCompletionTelemetry]:
        async with self.semaphore:
            started_at = time.perf_counter()
            ai_message = await asyncio.wait_for(
                self._model.ainvoke([_message_to_langchain(message) for message in messages]),
                timeout=self._timeout_seconds(DEFAULT_CHAT_TIMEOUT_SECONDS),
            )
            elapsed_ms = int((time.perf_counter() - started_at) * 1000)
        response = ChatResponse(content=_coerce_text(ai_message.content))
        telemetry = ChatCompletionTelemetry(
            prompt_eval_count=_extract_prompt_eval_count(ai_message),
            output_token_count=_extract_token_count(ai_message),
            latency_ms=elapsed_ms,
        )
        return response, telemetry

    def bind_tools(self, tools: Sequence[object]) -> Any:
        return self._model.bind_tools(list(tools))

    def _timeout_seconds(self, default_timeout: float) -> float:
        timeout_ms = max(1, int(self.settings.timeout_ms))
        return max(1.0, min(default_timeout, timeout_ms / 1000.0))


@dataclass(slots=True)
class VLLMEmbeddingRuntime(EmbeddingPort):
    settings: VLLMSettings
    semaphore: asyncio.Semaphore = field(init=False)
    _cache: OrderedDict[str, tuple[float, ...]] = field(init=False, repr=False)
    _embeddings: OpenAIEmbeddings = field(init=False, repr=False)

    def __post_init__(self) -> None:
        self.semaphore = asyncio.Semaphore(max(1, int(self.settings.max_concurrent_requests)))
        self._cache = OrderedDict()
        self._embeddings = OpenAIEmbeddings(
            model=self.settings.embedding_model,
            base_url=self.settings.url,
            api_key=self.settings.api_key,
        )

    async def embed(self, text: str) -> tuple[float, ...]:
        key = text.strip()
        if not key:
            return tuple(0.0 for _ in range(EMBEDDING_VECTOR_SIZE))

        cached = self._cache.get(key)
        if cached is not None:
            self._cache.move_to_end(key)
            return cached

        async with self.semaphore:
            values = await asyncio.wait_for(
                self._embeddings.aembed_query(key),
                timeout=self._timeout_seconds(DEFAULT_EMBEDDING_TIMEOUT_SECONDS),
            )

        vector = _ensure_finite_vector(values, allow_zero_vector=False)
        self._cache[key] = vector
        self._cache.move_to_end(key)
        while len(self._cache) > EMBEDDING_CACHE_MAX_SIZE:
            self._cache.popitem(last=False)
        return vector

    def _timeout_seconds(self, default_timeout: float) -> float:
        timeout_ms = max(1, int(self.settings.timeout_ms))
        return max(1.0, min(default_timeout, timeout_ms / 1000.0))


@dataclass(frozen=True, slots=True)
class ProbeDetails:
    chat_digest: str | None = None
    embedding_digest: str | None = None


@dataclass(frozen=True, slots=True)
class ChatCompletionTelemetry:
    prompt_eval_count: int | None = None
    output_token_count: int | None = None
    latency_ms: int | None = None


# ── Factory functions ────────────────────────────────────────────────────────


def create_model_runtime(settings: Settings) -> ChatModelRuntime:
    return VLLMModelRuntime(settings=settings.vllm)


def create_embedding_runtime(settings: Settings) -> EmbeddingPort:
    return VLLMEmbeddingRuntime(settings=settings.vllm)


async def probe_ai_runtime(
    settings: Settings,
    *,
    clock: Clock = SYSTEM_CLOCK,
) -> AiRuntimeProbe:
    return await probe_vllm_runtime(settings, clock=clock)


async def probe_vllm_runtime(
    settings: Settings,
    *,
    clock: Clock = SYSTEM_CLOCK,
    chat_runtime: VLLMModelRuntime | None = None,
    embedding_runtime: VLLMEmbeddingRuntime | None = None,
) -> AiRuntimeProbe:
    started_at = time.perf_counter()
    checked_at = clock.now().astimezone(UTC).isoformat().replace("+00:00", "Z")
    fallback_reason: str | None = None

    chat_runtime_value = chat_runtime or VLLMModelRuntime(settings.vllm)
    embedding_runtime_value = embedding_runtime or VLLMEmbeddingRuntime(settings.vllm)

    try:
        available_models = await _fetch_vllm_models(settings.vllm.url)
        if settings.vllm.model not in available_models:
            fallback_reason = f"Modelo de chat ausente: {settings.vllm.model}."
        elif settings.vllm.embedding_model not in available_models:
            fallback_reason = f"Modelo de embedding ausente: {settings.vllm.embedding_model}."

        if fallback_reason is None:
            await chat_runtime_value.complete(
                [
                    ChatMessage(role="system", content="Responda apenas com a palavra ok."),
                    ChatMessage(role="user", content="ok"),
                ]
            )
            await embedding_runtime_value.embed("probe")
    except Exception as exc:  # pragma: no cover - probe fallback is environment dependent
        fallback_reason = str(exc)

    elapsed_ms = int((time.perf_counter() - started_at) * 1000)
    mode = RuntimeMode.VLLM if fallback_reason is None else RuntimeMode.FALLBACK
    return AiRuntimeProbe(
        provider="vllm",
        model=settings.vllm.model,
        mode=mode,
        latency_ms=elapsed_ms,
        checked_at=checked_at,
        fallback_reason=fallback_reason,
        embedding_model=settings.vllm.embedding_model,
        embedding_mode=mode,
        embedding_latency_ms=elapsed_ms if fallback_reason is None else None,
        chat_digest=None,
        embedding_digest=None,
    )


async def _fetch_vllm_models(base_url: str) -> list[str]:
    url = base_url.rstrip("/") + "/models"
    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        payload = response.json()

    models: list[str] = []
    for item in payload.get("data", []) if isinstance(payload, dict) else []:
        if isinstance(item, dict):
            model_id = item.get("id")
            if isinstance(model_id, str) and model_id.strip():
                models.append(model_id.strip())
    return models
