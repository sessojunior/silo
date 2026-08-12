from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from dataclasses import asdict
from typing import Any

import httpx

from silo.ai.assistant_runtime import probe_ai_runtime
from silo.config import Settings, load_settings

DEFAULT_WAIT_TIMEOUT_SECONDS = 30 * 60
DEFAULT_POLL_INTERVAL_SECONDS = 2.0
DEFAULT_HTTP_TIMEOUT_SECONDS = 30.0


async def initialize_ollama(
    settings: Settings,
    *,
    wait_timeout_seconds: float = DEFAULT_WAIT_TIMEOUT_SECONDS,
    poll_interval_seconds: float = DEFAULT_POLL_INTERVAL_SECONDS,
    http_timeout_seconds: float = DEFAULT_HTTP_TIMEOUT_SECONDS,
) -> dict[str, Any]:
    started_at = time.perf_counter()
    async with httpx.AsyncClient(timeout=httpx.Timeout(http_timeout_seconds)) as client:
        await _wait_for_server(
            client,
            settings.ollama.url,
            wait_timeout_seconds=wait_timeout_seconds,
            poll_interval_seconds=poll_interval_seconds,
        )
        await _pull_model(
            client,
            settings.ollama.url,
            settings.ollama.model,
            timeout_seconds=wait_timeout_seconds,
        )
        if settings.ollama.embedding_model != settings.ollama.model:
            await _pull_model(
                client,
                settings.ollama.url,
                settings.ollama.embedding_model,
                timeout_seconds=wait_timeout_seconds,
            )

    probe = await probe_ai_runtime(settings)
    if probe.fallback_reason is not None:
        raise RuntimeError(probe.fallback_reason)

    elapsed_ms = int((time.perf_counter() - started_at) * 1000)
    payload = asdict(probe)
    payload["elapsed_ms"] = elapsed_ms
    payload["initialized"] = True
    return payload


async def _wait_for_server(
    client: httpx.AsyncClient,
    base_url: str,
    *,
    wait_timeout_seconds: float,
    poll_interval_seconds: float,
) -> None:
    started_at = time.perf_counter()
    tags_url = f"{base_url.rstrip('/')}/api/tags"

    while True:
        try:
            response = await client.get(tags_url)
            if response.is_success:
                return
        except httpx.HTTPError:
            pass

        elapsed = time.perf_counter() - started_at
        if elapsed >= wait_timeout_seconds:
            raise RuntimeError(
                f"Ollama não respondeu em {wait_timeout_seconds:.0f}s no endereço {base_url}."
            )
        await asyncio.sleep(max(0.1, poll_interval_seconds))


async def _pull_model(
    client: httpx.AsyncClient,
    base_url: str,
    model: str,
    *,
    timeout_seconds: float,
) -> None:
    pull_url = f"{base_url.rstrip('/')}/api/pull"
    response = await client.post(
        pull_url,
        json={"model": model, "stream": False},
        timeout=httpx.Timeout(timeout_seconds),
    )
    if not response.is_success:
        raise RuntimeError(f"Falha ao baixar o modelo {model}: {response.status_code} {response.text}")

    try:
        payload = response.json()
    except ValueError as exc:
        raise RuntimeError(f"Resposta inválida ao baixar o modelo {model}.") from exc

    status = payload.get("status") if isinstance(payload, dict) else None
    digest = payload.get("digest") if isinstance(payload, dict) else None
    if status not in {"success", "already exists"} and not (
        isinstance(digest, str) and digest.strip()
    ):
        raise RuntimeError(f"Pull do modelo {model} retornou status inesperado: {payload!r}")


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Inicializa e aquece o Ollama para o SILO.")
    parser.add_argument("--wait-timeout-seconds", type=float, default=DEFAULT_WAIT_TIMEOUT_SECONDS)
    parser.add_argument("--poll-interval-seconds", type=float, default=DEFAULT_POLL_INTERVAL_SECONDS)
    parser.add_argument("--http-timeout-seconds", type=float, default=DEFAULT_HTTP_TIMEOUT_SECONDS)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(sys.argv[1:] if argv is None else argv)
    settings = load_settings()
    result = asyncio.run(
        initialize_ollama(
            settings,
            wait_timeout_seconds=args.wait_timeout_seconds,
            poll_interval_seconds=args.poll_interval_seconds,
            http_timeout_seconds=args.http_timeout_seconds,
        )
    )
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
