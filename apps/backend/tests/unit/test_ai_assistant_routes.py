from __future__ import annotations

import asyncio
import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from starlette.requests import Request

import silo.api.dependencies as dependencies_module
import silo.api.routers.ai_assistant as ai_assistant_router
from silo.ai.assistant_contracts import (
    AiAssistantArtifactDto,
    AiAssistantCitationDto,
    AiAssistantCreateThreadResponseDto,
    AiAssistantExampleDto,
    AiAssistantExamplesResponseDto,
    AiAssistantGenerationDto,
    AiAssistantMessageResponseDto,
    AiAssistantRuntimeStatusDto,
    AiAssistantThreadDetailResponseDto,
    AiAssistantThreadMessageDto,
    AiAssistantThreadsResponseDto,
    AiAssistantThreadSummaryDto,
)
from silo.ai.assistant_service import AssistantStreamEvent
from silo.api.dependencies import (
    CurrentUser,
    UserGroupInfo,
    get_current_user,
    get_db,
    get_snapshot_db,
)
from silo.api.main import create_app

THREAD_ID = "11111111-1111-1111-1111-111111111111"
MESSAGE_ID = "22222222-2222-2222-2222-222222222222"
NOW = "2026-07-23T12:00:00Z"


def _admin_user() -> CurrentUser:
    return CurrentUser(
        id="33333333-3333-3333-3333-333333333333", email="admin@example.com", name="Admin"
    )


def _thread_summary() -> AiAssistantThreadSummaryDto:
    return AiAssistantThreadSummaryDto(
        id=THREAD_ID,
        title="Conversa de teste",
        last_message_preview="Resumo final",
        message_count=2,
        last_message_at=NOW,
        created_at=NOW,
        updated_at=NOW,
    )


def _assistant_response() -> AiAssistantMessageResponseDto:
    return AiAssistantMessageResponseDto(
        thread_id=THREAD_ID,
        thread=_thread_summary(),
        message_content="Resumo final",
        scope="reports",
        is_in_scope=True,
        refusal_reason=None,
        answer="Resumo final",
        thinking="Planejando resposta",
        suggested_questions=["Quais relatórios devo abrir agora?"],
        citations=[AiAssistantCitationDto(label="Relatório executivo", detail="2026-07-23")],
        visualization=None,
        artifacts=[
            AiAssistantArtifactDto(
                kind="pdf",
                url="/api/upload/serve/reports/ai-executive-test.pdf",
                filename="ai-executive-test.pdf",
                title="Relatório executive",
                report_type="executive",
                checksum="abc123",
                byte_size=1024,
            )
        ],
        generation=AiAssistantGenerationDto(
            provider="ollama",
            model="mistral",
            status="success",
            latency_ms=42,
            generated_tokens=128,
            thinking_time_ms=12,
            error_message=None,
        ),
        context_summary="scope=reports; range=2026-07-01..2026-07-23; sources=executive_report",
    )


def _configure_admin_access(app):
    admin_user = _admin_user()
    app.dependency_overrides[get_current_user] = lambda: admin_user
    app.dependency_overrides[get_db] = lambda: object()
    app.dependency_overrides[get_snapshot_db] = lambda: object()
    return admin_user


def _mock_admin_groups(monkeypatch) -> None:
    monkeypatch.setattr(
        dependencies_module,
        "get_user_groups",
        lambda _db, _user_id: (UserGroupInfo(id="group-1", name="Administradores", role="admin"),),
    )


def test_ai_assistant_metadata_and_thread_routes(monkeypatch) -> None:
    app = create_app()
    _configure_admin_access(app)
    _mock_admin_groups(monkeypatch)

    async def _fake_runtime_status() -> AiAssistantRuntimeStatusDto:
        return AiAssistantRuntimeStatusDto(
            provider="ollama",
            model="mistral",
            mode="ollama",
            latency_ms=15,
            checked_at=NOW,
            fallback_reason=None,
        )

    monkeypatch.setattr(ai_assistant_router, "get_assistant_runtime_status", _fake_runtime_status)
    monkeypatch.setattr(
        ai_assistant_router,
        "get_assistant_examples",
        lambda: AiAssistantExamplesResponseDto(
            guidance="Use o assistente apenas com dados autorizados.",
            scope_policy="Responda de forma grounded.",
            examples=[
                AiAssistantExampleDto(
                    id="example-1",
                    title="Relatórios",
                    prompt="O que mudou nos relatórios?",
                    description="Mostra resumo e pontos de atenção.",
                    scope="reports",
                )
            ],
        ),
    )
    monkeypatch.setattr(
        ai_assistant_router,
        "create_assistant_thread",
        lambda _db, _user_id, title=None: AiAssistantCreateThreadResponseDto(
            thread=_thread_summary()
        ),
    )
    monkeypatch.setattr(
        ai_assistant_router,
        "list_assistant_threads",
        lambda _db, _user_id: AiAssistantThreadsResponseDto(threads=[_thread_summary()]),
    )
    monkeypatch.setattr(
        ai_assistant_router,
        "get_assistant_thread_details",
        lambda _db, _user_id, _thread_id: AiAssistantThreadDetailResponseDto(
            thread=_thread_summary(),
            messages=[
                AiAssistantThreadMessageDto(
                    id=MESSAGE_ID,
                    thread_id=THREAD_ID,
                    sender_type="assistant",
                    sender_user_id="ai-assistant",
                    sender_name="Assistente de IA",
                    content="Resumo final",
                    thinking="Planejando resposta",
                    generation=AiAssistantGenerationDto(
                        provider="ollama",
                        model="mistral",
                        status="success",
                        latency_ms=42,
                        generated_tokens=128,
                        thinking_time_ms=12,
                        error_message=None,
                    ),
                    visualization=None,
                    artifacts=[
                        AiAssistantArtifactDto(
                            kind="pdf",
                            url="/api/upload/serve/reports/ai-executive-test.pdf",
                            filename="ai-executive-test.pdf",
                            title="Relatório executivo",
                            report_type="executive",
                            checksum="abc123",
                            byte_size=1024,
                        )
                    ],
                    created_at=NOW,
                )
            ],
        ),
    )
    deleted_messages: list[tuple[str, str, str]] = []
    deleted_threads: list[tuple[str, str]] = []
    monkeypatch.setattr(
        ai_assistant_router,
        "delete_assistant_message",
        lambda _db, user_id, thread_id, message_id: deleted_messages.append(
            (user_id, thread_id, message_id)
        ),
    )
    monkeypatch.setattr(
        ai_assistant_router,
        "delete_assistant_thread",
        lambda _db, user_id, thread_id: deleted_threads.append((user_id, thread_id)),
    )

    with TestClient(app) as client:
        status_response = client.get("/api/ai-assistant/status")
        examples_response = client.get("/api/ai-assistant/examples")
        create_thread_response = client.post("/api/ai-assistant/threads", json={})
        threads_response = client.get("/api/ai-assistant/threads")
        detail_response = client.get(f"/api/ai-assistant/threads/{THREAD_ID}")
        delete_message_response = client.delete(
            f"/api/ai-assistant/threads/{THREAD_ID}/messages/{MESSAGE_ID}"
        )
        delete_thread_response = client.delete(f"/api/ai-assistant/threads/{THREAD_ID}")

    assert status_response.status_code == 200
    assert status_response.json()["data"]["model"] == "mistral"

    assert examples_response.status_code == 200
    assert examples_response.json()["data"]["examples"][0]["scope"] == "reports"

    assert create_thread_response.status_code == 200
    assert create_thread_response.json()["data"]["thread"]["id"] == THREAD_ID

    assert threads_response.status_code == 200
    assert threads_response.json()["data"]["threads"][0]["id"] == THREAD_ID

    assert detail_response.status_code == 200
    assert detail_response.json()["data"]["messages"][0]["id"] == MESSAGE_ID
    assert (
        detail_response.json()["data"]["messages"][0]["artifacts"][0]["filename"]
        == "ai-executive-test.pdf"
    )

    assert delete_message_response.status_code == 200
    assert delete_message_response.json()["data"]["deleted"] is True
    assert deleted_messages == [(_admin_user().id, THREAD_ID, MESSAGE_ID)]

    assert delete_thread_response.status_code == 200
    assert delete_thread_response.json()["data"]["deleted"] is True
    assert deleted_threads == [(_admin_user().id, THREAD_ID)]


def test_ai_assistant_message_routes_return_json_and_sse(monkeypatch) -> None:
    app = create_app()
    _configure_admin_access(app)
    _mock_admin_groups(monkeypatch)

    response_model = _assistant_response()

    async def _fake_send_assistant_message(*_args, **_kwargs):
        return response_model

    async def _fake_stream_assistant_message(*_args, **_kwargs):
        yield AssistantStreamEvent(event="connected", data={"status": "processing"})
        yield AssistantStreamEvent(event="thinking", data={"content": "Planejando resposta"})
        yield AssistantStreamEvent(event="result", data=response_model.model_dump(mode="json"))
        yield AssistantStreamEvent(event="complete", data={"ok": True})

    monkeypatch.setattr(ai_assistant_router, "send_assistant_message", _fake_send_assistant_message)
    monkeypatch.setattr(
        ai_assistant_router, "stream_assistant_message", _fake_stream_assistant_message
    )

    with TestClient(app) as client:
        message_response = client.post(
            "/api/ai-assistant/messages",
            json={"content": "Quais relatórios devo olhar?", "threadId": THREAD_ID},
        )

    async def _collect_stream_body() -> tuple[object, str]:
        payload = json.dumps(
            {
                "content": "Quais relatórios devo olhar?",
                "threadId": THREAD_ID,
            },
            ensure_ascii=False,
        ).encode("utf-8")
        consumed = False

        async def _receive() -> dict[str, object]:
            nonlocal consumed
            if consumed:
                return {"type": "http.disconnect"}
            consumed = True
            return {"type": "http.request", "body": payload, "more_body": False}

        request = Request(
            {
                "type": "http",
                "method": "POST",
                "path": "/api/ai-assistant/messages/stream",
                "headers": [(b"content-type", b"application/json")],
                "query_string": b"",
                "state": {},
            },
            _receive,
        )
        response = await ai_assistant_router.post_message_stream(
            request,
            _admin_user(),
            object(),
        )
        chunks: list[str] = []
        async for chunk in response.body_iterator:
            if isinstance(chunk, bytes):
                chunks.append(chunk.decode("utf-8"))
            else:
                chunks.append(str(chunk))
        return response, "".join(chunks)

    stream_response, stream_body = asyncio.run(_collect_stream_body())

    assert message_response.status_code == 200
    assert message_response.json()["data"]["threadId"] == THREAD_ID
    assert message_response.json()["data"]["artifacts"][0]["filename"] == "ai-executive-test.pdf"

    assert getattr(stream_response, "media_type", None) == "text/event-stream"
    assert "event: connected" in stream_body
    assert "event: thinking" in stream_body
    assert "event: result" in stream_body
    assert "event: complete" in stream_body


@pytest.mark.asyncio
async def test_ai_assistant_message_stream_emits_heartbeats_while_service_is_slow(monkeypatch) -> None:
    response_model = _assistant_response()

    async def slow_stream(*_args, **_kwargs):
        yield AssistantStreamEvent(event="result", data=response_model.model_dump(mode="json"))

    calls = 0

    async def fake_wait_for(awaitable, timeout=None):
        nonlocal calls
        calls += 1
        if calls <= 2:
            # Simula servico demorando: gera heartbeats antes do resultado.
            raise TimeoutError()
        return await awaitable

    monkeypatch.setattr(ai_assistant_router, "stream_assistant_message", slow_stream)
    monkeypatch.setattr(ai_assistant_router.asyncio, "wait_for", fake_wait_for)

    payload = json.dumps(
        {
            "content": "Quais relatórios devo olhar?",
            "threadId": THREAD_ID,
        },
        ensure_ascii=False,
    ).encode("utf-8")
    consumed = False

    async def _receive() -> dict[str, object]:
        nonlocal consumed
        if consumed:
            return {"type": "http.disconnect"}
        consumed = True
        return {"type": "http.request", "body": payload, "more_body": False}

    request = Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/ai-assistant/messages/stream",
            "headers": [(b"content-type", b"application/json")],
            "query_string": b"",
            "state": {},
        },
        _receive,
    )
    response = await ai_assistant_router.post_message_stream(
        request,
        _admin_user(),
        object(),
    )
    chunks: list[str] = []
    async for chunk in response.body_iterator:
        if isinstance(chunk, bytes):
            chunks.append(chunk.decode("utf-8"))
        else:
            chunks.append(str(chunk))

    body = "".join(chunks)
    assert "event: connected" in body
    assert body.count(": heartbeat") >= 2
    assert "event: result" in body


def _json_response_body(response):
    return json.loads(response.body)


@pytest.mark.asyncio
async def test_ai_assistant_routes_cover_error_paths_and_helper_branches(monkeypatch) -> None:
    class _FakeRequest:
        def __init__(self, body: object | None = None, *, request_id: str | None = None, raise_json: bool = False) -> None:
            self.state = SimpleNamespace(request_id=request_id)
            self._body = body
            self._raise_json = raise_json
            self.app = SimpleNamespace(state=SimpleNamespace())

        async def json(self) -> object:
            if self._raise_json:
                raise RuntimeError("request json failed")
            return self._body

        async def is_disconnected(self) -> bool:
            return False

    explicit_request = _FakeRequest(request_id="req-123")
    assert ai_assistant_router._request_request_id(explicit_request) == "req-123"  # noqa: SLF001

    generated_request = _FakeRequest()
    monkeypatch.setattr(ai_assistant_router, "uuid4", lambda: "11111111-1111-1111-1111-111111111111")
    assert ai_assistant_router._request_request_id(generated_request) == "11111111-1111-1111-1111-111111111111"  # noqa: SLF001
    assert ai_assistant_router._heartbeat_event() == ": heartbeat\n\n"  # noqa: SLF001
    assert "event: result" in ai_assistant_router._stream_event("result", {"ok": True})  # noqa: SLF001
    invalid_response = ai_assistant_router._invalid_request_response("content")  # noqa: SLF001
    assert invalid_response.status_code == 400
    assert _json_response_body(invalid_response)["field"] == "content"

    monkeypatch.setattr(
        ai_assistant_router,
        "create_assistant_thread",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("boom")),
    )
    thread_error = await ai_assistant_router.post_thread(_FakeRequest({"title": "  Título  "}), _admin_user(), object())
    assert thread_error.status_code == 500

    monkeypatch.setattr(ai_assistant_router, "get_assistant_thread_details", lambda *_args, **_kwargs: None)
    missing_thread = await ai_assistant_router.get_thread("missing-thread", _admin_user(), object())
    assert missing_thread.status_code == 404

    invalid_message = await ai_assistant_router.post_message(_FakeRequest({}), _admin_user(), object())
    assert invalid_message.status_code == 400

    monkeypatch.setattr(
        ai_assistant_router,
        "send_assistant_message",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            ai_assistant_router.AssistantThreadNotFoundError("Conversa não encontrada.")
        ),
    )
    missing_message_thread = await ai_assistant_router.post_message(
        _FakeRequest({"content": "Olá"}),
        _admin_user(),
        object(),
    )
    assert missing_message_thread.status_code == 404

    monkeypatch.setattr(
        ai_assistant_router,
        "send_assistant_message",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            ai_assistant_router.AssistantMessageConflictError("Conflito de mensagem.")
        ),
    )
    conflict_message = await ai_assistant_router.post_message(
        _FakeRequest({"content": "Olá"}),
        _admin_user(),
        object(),
    )
    assert conflict_message.status_code == 409

    monkeypatch.setattr(
        ai_assistant_router,
        "send_assistant_message",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("boom")),
    )
    generic_message_error = await ai_assistant_router.post_message(
        _FakeRequest({"content": "Olá"}),
        _admin_user(),
        object(),
    )
    assert generic_message_error.status_code == 500

    invalid_stream = await ai_assistant_router.post_message_stream(_FakeRequest({}), _admin_user(), object())
    assert invalid_stream.status_code == 400

    async def _thread_not_found_stream(*_args, **_kwargs):
        raise ai_assistant_router.AssistantThreadNotFoundError("Conversa não encontrada.")
        if False:
            yield None

    monkeypatch.setattr(ai_assistant_router, "stream_assistant_message", _thread_not_found_stream)
    thread_not_found_stream = await ai_assistant_router.post_message_stream(
        _FakeRequest({"content": "Olá"}),
        _admin_user(),
        object(),
    )
    stream_chunks: list[str] = []
    async for chunk in thread_not_found_stream.body_iterator:
        stream_chunks.append(chunk.decode("utf-8") if isinstance(chunk, bytes) else str(chunk))
    assert "event: error" in "".join(stream_chunks)

    async def _generic_stream_error(*_args, **_kwargs):
        if False:
            yield None
        raise RuntimeError("boom")

    monkeypatch.setattr(ai_assistant_router, "stream_assistant_message", _generic_stream_error)
    generic_stream = await ai_assistant_router.post_message_stream(
        _FakeRequest({"content": "Olá"}),
        _admin_user(),
        object(),
    )
    generic_stream_chunks: list[str] = []
    async for chunk in generic_stream.body_iterator:
        generic_stream_chunks.append(chunk.decode("utf-8") if isinstance(chunk, bytes) else str(chunk))
    assert "event: error" in "".join(generic_stream_chunks)

    monkeypatch.setattr(
        ai_assistant_router,
        "delete_assistant_message",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            ai_assistant_router.AssistantThreadNotFoundError("Mensagem não encontrada.")
        ),
    )
    missing_message_delete = await ai_assistant_router.delete_message(
        _FakeRequest(request_id="req-delete"),
        THREAD_ID,
        MESSAGE_ID,
        _admin_user(),
        object(),
    )
    assert missing_message_delete.status_code == 404

    monkeypatch.setattr(
        ai_assistant_router,
        "delete_assistant_message",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("boom")),
    )
    generic_message_delete = await ai_assistant_router.delete_message(
        _FakeRequest(request_id="req-delete"),
        THREAD_ID,
        MESSAGE_ID,
        _admin_user(),
        object(),
    )
    assert generic_message_delete.status_code == 500

    monkeypatch.setattr(
        ai_assistant_router,
        "delete_assistant_thread",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            ai_assistant_router.AssistantThreadNotFoundError("Conversa não encontrada.")
        ),
    )
    missing_thread_delete = await ai_assistant_router.delete_thread(
        _FakeRequest(request_id="req-delete"),
        THREAD_ID,
        _admin_user(),
        object(),
    )
    assert missing_thread_delete.status_code == 404

    monkeypatch.setattr(
        ai_assistant_router,
        "delete_assistant_thread",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("boom")),
    )
    generic_thread_delete = await ai_assistant_router.delete_thread(
        _FakeRequest(request_id="req-delete"),
        THREAD_ID,
        _admin_user(),
        object(),
    )
    assert generic_thread_delete.status_code == 500
