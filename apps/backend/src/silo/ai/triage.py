from __future__ import annotations

from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass
from enum import StrEnum
from typing import Any, Protocol

import httpx


class TriageRoute(StrEnum):
    SIMPLE = "simple"
    KNOWLEDGE = "knowledge"
    AGENT = "agent"
    MCP = "mcp"
    LLM = "llm"
    OUT_OF_SCOPE = "out_of_scope"


@dataclass(frozen=True, slots=True)
class TriageDecision:
    route: TriageRoute
    confidence: float
    source: str
    reason: str | None = None

    @classmethod
    def from_payload(cls, payload: Mapping[str, Any], *, source: str) -> TriageDecision:
        if not isinstance(payload, Mapping):
            raise ValueError("Resposta de triagem invalida.")
        try:
            route = TriageRoute(str(payload["route"]).strip())
            confidence = float(payload["confidence"])
        except (KeyError, TypeError, ValueError) as exc:
            raise ValueError("Resposta de triagem invalida.") from exc
        if confidence != confidence or confidence in {float("inf"), float("-inf")}:
            raise ValueError("Confianca de triagem invalida.")
        return cls(
            route=route,
            confidence=max(0.0, min(1.0, confidence)),
            source=source,
            reason=_optional_text(payload.get("reason")),
        )


class TriagePort(Protocol):
    async def classify(self, content: str) -> TriageDecision: ...


RequestJson = Callable[[str, Mapping[str, str], float], Awaitable[object]]


@dataclass(slots=True)
class NcmTriageRuntime:
    url: str
    timeout_ms: int = 250
    min_confidence: float = 0.6
    request_json: RequestJson | None = None

    async def classify(self, content: str) -> TriageDecision:
        if not self.url.strip():
            return _fallback("disabled")
        try:
            payload = await self._request(content)
            if not isinstance(payload, Mapping):
                raise ValueError("malformed_response")
            decision = TriageDecision.from_payload(payload, source="ncm")
            if decision.confidence < self.min_confidence:
                return _fallback("low_confidence")
            return decision
        except (TimeoutError, httpx.TimeoutException):
            return _fallback("timeout")
        except Exception:
            return _fallback("malformed_response")

    async def _request(self, content: str) -> object:
        headers = {"Content-Type": "application/json"}
        timeout_seconds = max(0.05, self.timeout_ms / 1000)
        if self.request_json is not None:
            return await self.request_json(
                self.url,
                {"content": content, **headers},
                timeout_seconds,
            )
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.post(self.url, json={"content": content}, headers=headers)
            response.raise_for_status()
            return response.json()

    @classmethod
    def from_settings(cls, settings: object) -> NcmTriageRuntime | None:
        if not bool(getattr(settings, "ncm_triage_enabled", False)):
            return None
        url = str(getattr(settings, "ncm_triage_url", "")).strip()
        if not url:
            return None
        return cls(
            url=url,
            timeout_ms=int(getattr(settings, "ncm_triage_timeout_ms", 250)),
            min_confidence=float(getattr(settings, "ncm_triage_min_confidence", 0.6)),
        )


def disabled_triage() -> TriageDecision:
    return _fallback("disabled")


def _fallback(reason: str) -> TriageDecision:
    return TriageDecision(
        route=TriageRoute.LLM,
        confidence=0.0,
        source="disabled" if reason == "disabled" else "fallback",
        reason=reason,
    )


def _optional_text(value: object) -> str | None:
    if isinstance(value, str) and value.strip():
        return value.strip()[:120]
    return None
