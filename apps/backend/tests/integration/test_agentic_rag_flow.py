from __future__ import annotations

import hashlib
import json
import re

from fastapi.testclient import TestClient

from silo.testing.fixture_api import app


def _login_admin(client: TestClient) -> None:
    response = client.post(
        "/api/auth/login/password",
        json={"email": "admin@inpe.br", "password": "#Admin123"},
    )
    assert response.status_code == 200


def _result_payload(body: str) -> dict[str, object]:
    match = re.search(r"event: result\ndata: (.+?)\n\n", body)
    assert match is not None, body
    payload = json.loads(match.group(1))
    assert isinstance(payload, dict)
    return payload


def _stream(client: TestClient, *, thread_id: str, prompt: str, key: str) -> dict[str, object]:
    with client.stream(
        "POST",
        "/api/admin/ai-assistant/messages/stream",
        json={"content": prompt, "threadId": thread_id},
        headers={"x-idempotency-key": key},
    ) as response:
        body = "".join(response.iter_text())
    assert response.status_code == 200
    return _result_payload(body)


def _assert_grounded_hybrid_payload(payload: dict[str, object]) -> None:
    citations = payload["citations"]
    assert isinstance(citations, list) and citations
    citation = citations[0]
    assert isinstance(citation, dict)
    assert citation["source"] in {"manual", "reports", "projects"}
    assert isinstance(citation["sourceId"], str) and citation["sourceId"]
    assert isinstance(citation["snippet"], str) and citation["snippet"]
    assert isinstance(citation["score"], (int, float))
    assert 0 <= float(citation["score"]) <= 1
    assert "hybrid" in str(payload["contextSummary"]).lower()


def test_agentic_rag_fixture_preserves_grounding_and_all_visual_artifacts() -> None:
    with TestClient(app) as client:
        reset = client.post("/__test/reset")
        assert reset.status_code == 200
        _login_admin(client)

        thread_response = client.post(
            "/api/admin/ai-assistant/threads",
            json={"title": "Fluxo Agentic RAG"},
        )
        assert thread_response.status_code == 200
        thread_id = thread_response.json()["data"]["thread"]["id"]
        assert thread_response.json()["data"]["thread"]["id"]

        chart = _stream(
            client,
            thread_id=thread_id,
            prompt="Quais dados de disponibilidade dos produtos? Quero um chart.",
            key="agentic-flow-chart",
        )
        _assert_grounded_hybrid_payload(chart)
        assert chart["visualization"]["kind"] == "chart"  # type: ignore[index]

        image = _stream(
            client,
            thread_id=thread_id,
            prompt="Mostre um resumo visual dos produtos.",
            key="agentic-flow-image",
        )
        _assert_grounded_hybrid_payload(image)
        assert image["visualization"]["kind"] == "image"  # type: ignore[index]

        mermaid = _stream(
            client,
            thread_id=thread_id,
            prompt="Mostre o fluxo de projetos em mermaid.",
            key="agentic-flow-mermaid",
        )
        _assert_grounded_hybrid_payload(mermaid)
        assert mermaid["visualization"]["kind"] == "mermaid"  # type: ignore[index]

        pdf = _stream(
            client,
            thread_id=thread_id,
            prompt="Gere um PDF Python do relatório.",
            key="agentic-flow-pdf",
        )
        _assert_grounded_hybrid_payload(pdf)
        artifacts = pdf["artifacts"]
        assert isinstance(artifacts, list) and artifacts
        artifact = artifacts[0]
        assert isinstance(artifact, dict)
        assert artifact["kind"] == "pdf"

        served = client.get(str(artifact["url"]))
        assert served.status_code == 200
        assert served.content.startswith(b"%PDF-")
        assert len(served.content) == artifact["byteSize"]
        assert hashlib.sha256(served.content).hexdigest() == artifact["checksum"]

        thread_detail = client.get(f"/api/admin/ai-assistant/threads/{thread_id}")
        assert thread_detail.status_code == 200
        assistant_messages = [
            message
            for message in thread_detail.json()["data"]["messages"]
            if message["senderType"] == "assistant"
        ]
        assert assistant_messages
        assert assistant_messages[-1]["citations"][0]["sourceId"] in {
            "availability-report",
            "manual-visual-summary",
        }
