from __future__ import annotations

import json
import re

from fastapi.testclient import TestClient

from silo.testing.fixture_api import app, state


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


def test_preferences_procedure_context_and_triage_fallback_flow() -> None:
    with TestClient(app) as client:
        assert client.post("/__test/reset").status_code == 200
        _login_admin(client)

        saved = client.put(
            "/api/admin/users/preferences",
            json={
                "chatEnabled": True,
                "aiEnabled": True,
            },
        )
        assert saved.status_code == 200
        preferences = client.get("/api/admin/users/preferences").json()["data"]["userPreferences"]
        assert preferences["aiEnabled"] is True
        assert "mcpEnabled" not in preferences
        assert "customModelEnabled" not in preferences
        assert "modelId" not in preferences

        state.knowledge_sources.append(
            {
                "source": "procedure",
                "sourceId": "general-procedure-restart",
                "scope": "general",
                "title": "Procedimento geral de reinicio",
                "text": (
                    "procedimento geral: reiniciar servico; pare o servico, valide os logs "
                    "e reinicie o servico."
                ),
                "embedding": [],
            }
        )
        thread = client.post(
            "/api/admin/ai-assistant/threads", json={"title": "Preferências e triagem"}
        ).json()["data"]["thread"]["id"]
        with client.stream(
            "POST",
            "/api/admin/ai-assistant/messages/stream",
            json={
                "content": "procedimento geral reiniciar servico valide logs",
                "threadId": thread,
            },
            headers={"x-idempotency-key": "preferences-triage-flow"},
        ) as response:
            body = "".join(response.iter_text())

        assert response.status_code == 200
        result = _result_payload(body)
        citations = result["citations"]
        assert isinstance(citations, list)
        assert any(item["source"] == "procedure" for item in citations if isinstance(item, dict))

        runtime_status = client.get("/api/admin/ai-assistant/status").json()["data"]
        assert runtime_status["mode"] == "fallback"


def test_disabled_user_preference_blocks_fixture_assistant_before_stream() -> None:
    with TestClient(app) as client:
        assert client.post("/__test/reset").status_code == 200
        _login_admin(client)
        assert (
            client.put("/api/admin/users/preferences", json={"aiEnabled": False}).status_code == 200
        )

        response = client.post(
            "/api/admin/ai-assistant/messages/stream",
            json={"content": "teste", "threadId": None},
        )

        assert response.status_code == 403
        assert "desabilitado" in response.json()["error"].lower()
