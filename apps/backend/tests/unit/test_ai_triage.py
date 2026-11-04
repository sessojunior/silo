from __future__ import annotations

import pytest

from silo.ai.triage import (
    NcmTriageRuntime,
    TriageDecision,
    TriageRoute,
)
from silo.config import load_settings


def test_decision_normalizes_route_and_bounds_confidence() -> None:
    decision = TriageDecision.from_payload(
        {"route": "knowledge", "confidence": 1.4, "reason": "procedure"},
        source="ncm",
    )

    assert decision.route is TriageRoute.KNOWLEDGE
    assert decision.confidence == 1.0
    assert decision.source == "ncm"
    assert decision.reason == "procedure"


def test_malformed_decision_payload_is_rejected() -> None:
    with pytest.raises(ValueError):
        TriageDecision.from_payload({"route": "unknown", "confidence": 0.9}, source="ncm")


@pytest.mark.asyncio
async def test_disabled_ncm_uses_existing_llm_path() -> None:
    runtime = NcmTriageRuntime(url="", timeout_ms=100)

    decision = await runtime.classify("qual a situação do silo?")

    assert decision.route is TriageRoute.LLM
    assert decision.source == "disabled"


@pytest.mark.asyncio
async def test_malformed_adapter_response_falls_back() -> None:
    async def request_json(*_args, **_kwargs):
        return {"route": "not-a-route", "confidence": 0.9}

    runtime = NcmTriageRuntime(
        url="http://ncm.internal/classify",
        timeout_ms=100,
        request_json=request_json,
    )

    decision = await runtime.classify("qual a situação do silo?")

    assert decision.route is TriageRoute.LLM
    assert decision.source == "fallback"
    assert decision.reason == "malformed_response"


@pytest.mark.asyncio
async def test_low_confidence_falls_back_before_agent_or_mcp() -> None:
    async def request_json(*_args, **_kwargs):
        return {"route": "mcp", "confidence": 0.2}

    runtime = NcmTriageRuntime(
        url="http://ncm.internal/classify",
        timeout_ms=100,
        min_confidence=0.6,
        request_json=request_json,
    )

    decision = await runtime.classify("use uma ferramenta externa")

    assert decision.route is TriageRoute.LLM
    assert decision.source == "fallback"
    assert decision.reason == "low_confidence"


@pytest.mark.asyncio
async def test_adapter_timeout_falls_back_to_llm() -> None:
    async def request_json(*_args, **_kwargs):
        raise TimeoutError()

    runtime = NcmTriageRuntime(
        url="http://ncm.internal/classify",
        timeout_ms=100,
        request_json=request_json,
    )

    decision = await runtime.classify("qual a situação do silo?")

    assert decision.route is TriageRoute.LLM
    assert decision.source == "fallback"
    assert decision.reason == "timeout"


def test_ncm_settings_are_disabled_by_default_and_configurable() -> None:
    defaults = load_settings(
        {
            "SILO_ENV": "test",
            "DATABASE_URL": "postgresql://test-user:test-pass@localhost:5432/silo",
        }
    )
    configured = load_settings(
        {
            "SILO_ENV": "test",
            "DATABASE_URL": "postgresql://test-user:test-pass@localhost:5432/silo",
            "NCM_TRIAGE_ENABLED": "true",
            "NCM_TRIAGE_URL": "http://ncm.internal/classify",
            "NCM_TRIAGE_TIMEOUT_MS": "150",
        }
    )

    assert defaults.ncm_triage_enabled is False
    assert defaults.ncm_triage_url == ""
    assert configured.ncm_triage_enabled is True
    assert configured.ncm_triage_url == "http://ncm.internal/classify"
    assert configured.ncm_triage_timeout_ms == 150
