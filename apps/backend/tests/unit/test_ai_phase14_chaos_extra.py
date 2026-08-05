from __future__ import annotations

from types import SimpleNamespace

import pytest

from silo.ai import assistant_service


@pytest.mark.asyncio
async def test_presentation_router_captures_pdf_failure(monkeypatch) -> None:
    state = {
        "artifact_intent": {"kind": "pdf", "reportType": "executive"},
        "scope": "reports",
        "required_results": {"executiveReport": {}},
        "progress": [],
        "errors": [],
        "final_response": {},
    }
    runtime = SimpleNamespace(context=SimpleNamespace())

    async def fake_build_pdf_artifact(*_args, **_kwargs):
        raise RuntimeError("pdf volume read-only")

    monkeypatch.setattr(assistant_service, "_build_pdf_artifact", fake_build_pdf_artifact)

    await assistant_service._node_presentation_router(state, runtime)

    assert state["progress"][-1] == "presentation_router"
    assert state["errors"] == ["pdf volume read-only"]
    assert state.get("artifact_result") is None
