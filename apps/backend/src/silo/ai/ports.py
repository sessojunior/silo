from __future__ import annotations

from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Protocol


@dataclass(frozen=True)
class ChatMessage:
    role: str
    content: str


@dataclass(frozen=True)
class ChatResponse:
    content: str


class ChatPort(Protocol):
    async def complete(self, messages: Sequence[ChatMessage]) -> ChatResponse: ...


class ChatModelRuntime(ChatPort, Protocol):
    async def stream(self, messages: Sequence[ChatMessage]) -> AsyncIterator[str]: ...


class EmbeddingPort(Protocol):
    async def embed(self, text: str) -> tuple[float, ...]: ...


class RuntimeMode(StrEnum):
    VLLM = "vllm"
    FALLBACK = "fallback"


@dataclass(frozen=True, slots=True)
class AiRuntimeProbe:
    provider: str
    model: str
    mode: RuntimeMode
    latency_ms: int
    checked_at: str
    fallback_reason: str | None = None
    embedding_model: str | None = None
    embedding_mode: RuntimeMode = RuntimeMode.FALLBACK
    embedding_latency_ms: int | None = None
    chat_digest: str | None = None
    embedding_digest: str | None = None


@dataclass
class FakeChatPort:
    response: str = "ok"
    calls: list[tuple[ChatMessage, ...]] = field(default_factory=list)

    async def complete(self, messages: Sequence[ChatMessage]) -> ChatResponse:
        self.calls.append(tuple(messages))
        return ChatResponse(content=self.response)

    async def stream(self, messages: Sequence[ChatMessage]) -> AsyncIterator[str]:
        self.calls.append(tuple(messages))
        yield self.response


@dataclass
class FakeEmbeddingPort:
    vector: tuple[float, ...] = (0.0,)
    calls: list[str] = field(default_factory=list)

    async def embed(self, text: str) -> tuple[float, ...]:
        self.calls.append(text)
        return self.vector
