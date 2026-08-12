from __future__ import annotations

from dataclasses import dataclass

import httpx
import pytest
import respx
from httpx import Response

from silo.ai import ollama_init
from silo.ai.ollama_init import initialize_ollama
from silo.ai.ports import AiRuntimeProbe, RuntimeMode
from silo.config import load_settings


@dataclass(frozen=True, slots=True)
class _ProbeConfig:
    chat_digest: str = "sha-chat"
    embedding_digest: str = "sha-embed"


@pytest.mark.asyncio
async def test_initialize_ollama_waits_pulls_and_returns_probe_result(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = load_settings(
        {
            "DATABASE_URL": "postgresql://test-user:test-pass@localhost:5432/silo",
            "OLLAMA_URL": "http://ollama.local:11434",
            "OLLAMA_MODEL": "qwen2.5:1.5b-instruct-q4_K_M",
            "OLLAMA_EMBEDDING_MODEL": "nomic-embed-text:v1.5",
        }
    )

    async def _fake_probe(_settings):
        return AiRuntimeProbe(
            provider="ollama",
            model=settings.ollama.model,
            mode=RuntimeMode.OLLAMA,
            latency_ms=12,
            checked_at="2026-07-23T15:00:00Z",
            fallback_reason=None,
            embedding_model=settings.ollama.embedding_model,
            embedding_mode=RuntimeMode.OLLAMA,
            embedding_latency_ms=12,
            chat_digest="sha-chat",
            embedding_digest="sha-embed",
        )

    monkeypatch.setattr("silo.ai.ollama_init.probe_ai_runtime", _fake_probe)

    with respx.mock(assert_all_called=True) as mock:
        mock.get("http://ollama.local:11434/api/tags").mock(
            return_value=Response(
                200,
                json={
                    "models": [
                        {"name": settings.ollama.model, "digest": "sha-chat"},
                        {"name": settings.ollama.embedding_model, "digest": "sha-embed"},
                    ]
                },
            )
        )
        pull_route = mock.post("http://ollama.local:11434/api/pull")
        pull_route.side_effect = [
            Response(200, json={"status": "success", "digest": "sha-chat"}),
            Response(200, json={"status": "success", "digest": "sha-embed"}),
        ]

        result = await initialize_ollama(
            settings,
            wait_timeout_seconds=1.0,
            poll_interval_seconds=0.01,
            http_timeout_seconds=1.0,
        )

    assert result["initialized"] is True
    assert result["chat_digest"] == "sha-chat"
    assert result["embedding_digest"] == "sha-embed"
    assert result["provider"] == "ollama"


@pytest.mark.asyncio
async def test_initialize_ollama_and_helpers_cover_error_branches(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = load_settings(
        {
            "DATABASE_URL": "postgresql://test-user:test-pass@localhost:5432/silo",
            "OLLAMA_URL": "http://ollama.local:11434",
            "OLLAMA_MODEL": "qwen2.5:1.5b-instruct-q4_K_M",
            "OLLAMA_EMBEDDING_MODEL": "nomic-embed-text:v1.5",
        }
    )

    async def _fallback_probe(_settings):
        return AiRuntimeProbe(
            provider="ollama",
            model=settings.ollama.model,
            mode=RuntimeMode.OLLAMA,
            latency_ms=12,
            checked_at="2026-07-23T15:00:00Z",
            fallback_reason="fallback",
            embedding_model=settings.ollama.embedding_model,
            embedding_mode=RuntimeMode.OLLAMA,
            embedding_latency_ms=12,
            chat_digest="sha-chat",
            embedding_digest="sha-embed",
        )

    monkeypatch.setattr("silo.ai.ollama_init.probe_ai_runtime", _fallback_probe)

    with monkeypatch.context() as local_monkeypatch:
        perf_values = [0.0, 0.5, 1.1]
        perf_index = {"value": 0}

        def _fake_perf_counter() -> float:
            index = perf_index["value"]
            perf_index["value"] = index + 1
            if index < len(perf_values):
                return perf_values[index]
            return 2.0

        local_monkeypatch.setattr("silo.ai.ollama_init.time.perf_counter", _fake_perf_counter)

        async def _no_sleep(_seconds):
            return None

        local_monkeypatch.setattr("silo.ai.ollama_init.asyncio.sleep", _no_sleep)
        with respx.mock(assert_all_called=True) as mock:
            mock.get("http://ollama.local:11434/api/tags").mock(return_value=Response(500, text="boom"))
            async with httpx.AsyncClient(timeout=1.0) as client:
                with pytest.raises(RuntimeError, match="Ollama não respondeu"):
                    await ollama_init._wait_for_server(
                        client,
                        "http://ollama.local:11434",
                        wait_timeout_seconds=1.0,
                        poll_interval_seconds=0.01,
                    )

    with respx.mock(assert_all_called=True) as mock:
        mock.post("http://ollama.local:11434/api/pull").mock(return_value=Response(500, content=b"boom"))
        async with httpx.AsyncClient(timeout=1.0) as client:
            with pytest.raises(RuntimeError, match="Falha ao baixar o modelo"):
                await ollama_init._pull_model(
                    client,
                    "http://ollama.local:11434",
                    "qwen2.5:1.5b-instruct-q4_K_M",
                    timeout_seconds=1.0,
                )

    with respx.mock(assert_all_called=True) as mock:
        mock.post("http://ollama.local:11434/api/pull").mock(return_value=Response(200, content=b"not-json"))
        async with httpx.AsyncClient(timeout=1.0) as client:
            with pytest.raises(RuntimeError, match="Resposta inválida ao baixar o modelo"):
                await ollama_init._pull_model(
                    client,
                    "http://ollama.local:11434",
                    "qwen2.5:1.5b-instruct-q4_K_M",
                    timeout_seconds=1.0,
                )

    with respx.mock(assert_all_called=True) as mock:
        mock.post("http://ollama.local:11434/api/pull").mock(
            return_value=Response(200, json={"status": "loading"})
        )
        async with httpx.AsyncClient(timeout=1.0) as client:
            with pytest.raises(RuntimeError, match="status inesperado"):
                await ollama_init._pull_model(
                    client,
                    "http://ollama.local:11434",
                    "qwen2.5:1.5b-instruct-q4_K_M",
                    timeout_seconds=1.0,
                )

    with respx.mock(assert_all_called=True) as mock:
        mock.get("http://ollama.local:11434/api/tags").mock(
            return_value=Response(
                200,
                json={
                    "models": [
                        {"name": settings.ollama.model, "digest": "sha-chat"},
                        {"name": settings.ollama.embedding_model, "digest": "sha-embed"},
                    ]
                },
            )
        )
        pull_route = mock.post("http://ollama.local:11434/api/pull")
        pull_route.side_effect = [
            Response(200, json={"status": "success", "digest": "sha-chat"}),
            Response(200, json={"status": "success", "digest": "sha-embed"}),
        ]

        with pytest.raises(RuntimeError, match="fallback"):
            await ollama_init.initialize_ollama(
                settings,
                wait_timeout_seconds=1.0,
                poll_interval_seconds=0.01,
                http_timeout_seconds=1.0,
            )
