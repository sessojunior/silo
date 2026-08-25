from __future__ import annotations

import time
from typing import Annotated, Protocol

import httpx
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.engine import Connection

from silo.api.dependencies import CurrentUser, get_current_user, get_db, get_user_groups, is_admin
from silo.api.responses import build_success_payload
from silo.clock import SYSTEM_CLOCK, Clock, ensure_utc
from silo.config import Settings, load_settings

router = APIRouter(tags=["system"])

VLLM_WARMUP_TIMEOUT_SECONDS = 60.0
WARMUP_PROMPT = "oi"


class LlmWarmupClient(Protocol):
    async def warmup(self, *, base_url: str, model: str, timeout_seconds: float) -> None: ...


class HttpxVllmWarmupClient:
    async def warmup(self, *, base_url: str, model: str, timeout_seconds: float) -> None:
        # vLLM expoe API compativel com OpenAI em {base}/chat/completions
        # (base ja pode incluir o sufixo /v1).
        normalized_base = base_url.rstrip("/")
        endpoint = (
            normalized_base + "/chat/completions"
            if normalized_base.endswith("/v1")
            else normalized_base + "/v1/chat/completions"
        )
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.post(
                endpoint,
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": WARMUP_PROMPT}],
                    "max_tokens": 1,
                },
            )
            response.raise_for_status()


@router.get("/api/server-time")
def get_server_time() -> dict[str, object]:
    return build_server_time_payload(SYSTEM_CLOCK)


def build_server_time_payload(clock: Clock) -> dict[str, object]:
    return build_success_payload(
        {"time": _legacy_iso_timestamp(clock)},
        message="Hora do servidor",
    )


@router.get("/api/check-admin")
def check_admin(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Connection, Depends(get_db)],
) -> dict[str, object]:
    return build_success_payload({"isAdmin": is_admin(get_user_groups(db, current_user.id))})


@router.post("/api/warmup")
async def warmup_model() -> JSONResponse:
    payload, status_code = await warmup_llm_model(settings=load_settings(), clock=SYSTEM_CLOCK)
    return JSONResponse(status_code=status_code, content=payload)


async def warmup_llm_model(
    *,
    settings: Settings,
    clock: Clock = SYSTEM_CLOCK,
    client: LlmWarmupClient | None = None,
) -> tuple[dict[str, object], int]:
    started_at = time.perf_counter()
    warmup_client = HttpxVllmWarmupClient() if client is None else client
    try:
        await warmup_client.warmup(
            base_url=settings.vllm.url,
            model=settings.vllm.model,
            timeout_seconds=VLLM_WARMUP_TIMEOUT_SECONDS,
        )
    except Exception:
        return {"success": False, "error": "Falha ao carregar modelo de IA."}, 500

    latency_ms = max(0, round((time.perf_counter() - started_at) * 1000))
    return (
        build_success_payload(
            {
                "model": settings.vllm.model,
                "latencyMs": latency_ms,
                "warmedAt": _legacy_iso_timestamp(clock),
            }
        ),
        200,
    )


def _legacy_iso_timestamp(clock: Clock) -> str:
    return ensure_utc(clock.now()).isoformat(timespec="milliseconds").replace("+00:00", "Z")
