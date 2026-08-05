from __future__ import annotations

import asyncio
import json
from datetime import datetime, timedelta
from types import SimpleNamespace
from uuid import UUID

from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient
import pytest

from silo.api.dependencies import CurrentUser, get_db, require_chat_access
from silo.api.main import create_app
from silo.api.routers import chat as chat_module
from silo.realtime.chat import ChatRealtimeHub


class _FakeWebSocket:
    def __init__(self) -> None:
        self.sent_json: list[dict[str, object]] = []
        self.closed: list[tuple[int, str]] = []

    async def send_json(self, payload: dict[str, object]) -> None:
        self.sent_json.append(payload)

    async def close(self, code: int = 1000, reason: str = "") -> None:
        self.closed.append((code, reason))


class _FakeConnection:
    def __enter__(self) -> _FakeConnection:
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False


class _FakeEngine:
    def connect(self) -> _FakeConnection:
        return _FakeConnection()


class _FakeQueryParams:
    def __init__(self, items: list[tuple[str, object]]) -> None:
        self._items = items

    def multi_items(self) -> list[tuple[str, object]]:
        return list(self._items)


class _FakeRequest:
    def __init__(
        self,
        *,
        query_items: list[tuple[str, object]] | None = None,
        body: object | None = None,
        request_id: str | None = None,
        app: object | None = None,
    ) -> None:
        self.query_params = _FakeQueryParams(query_items or [])
        self._body = body
        self.state = SimpleNamespace(request_id=request_id)
        self.app = app or SimpleNamespace(state=SimpleNamespace())

    async def json(self) -> object:
        return self._body


class _RouteWebSocket:
    def __init__(
        self,
        *,
        app: object,
        headers: dict[str, str] | None = None,
        cookies: dict[str, str] | None = None,
        messages: list[str] | None = None,
    ) -> None:
        self.app = app
        self.headers = headers or {}
        self.cookies = cookies or {}
        self._messages = list(messages or [])
        self.accepted = False
        self.closed: list[tuple[int, str]] = []
        self.sent_json: list[dict[str, object]] = []

    async def accept(self) -> None:
        self.accepted = True

    async def close(self, code: int = 1000, reason: str = "") -> None:
        self.closed.append((code, reason))

    async def send_json(self, payload: dict[str, object]) -> None:
        self.sent_json.append(payload)

    async def receive_text(self) -> str:
        if not self._messages:
            raise chat_module.WebSocketDisconnect()
        return self._messages.pop(0)


def _db_override() -> object:
    return object()


def asyncio_run(coro):
    return asyncio.run(coro)


def test_post_chat_message_returns_201_and_broadcasts_event(
    monkeypatch,
) -> None:
    app = create_app()
    app.dependency_overrides[require_chat_access] = lambda: CurrentUser(
        id="user-1",
        email="user@example.com",
        name="User One",
    )
    app.dependency_overrides[get_db] = _db_override

    captured_events: list[dict[str, object]] = []

    async def _broadcast_chat_event(_request, event: dict[str, object]) -> None:
        captured_events.append(event)

    monkeypatch.setattr(chat_module, "_broadcast_chat_event", _broadcast_chat_event)
    monkeypatch.setattr(
        chat_module,
        "create_message",
        lambda _db, sender_user_id, content, receiver_group_id=None, receiver_user_id=None: {
            "id": "message-1",
            "content": content.strip(),
            "sender_user_id": sender_user_id,
            "sender_name": "User One",
            "receiver_group_id": receiver_group_id,
            "receiver_user_id": receiver_user_id,
            "created_at": datetime(2026, 7, 23, 12, 0, 0),
            "read_at": None,
            "deleted_at": None,
        },
    )

    with TestClient(app) as client:
        response = client.post(
            "/api/chat/messages",
            json={"content": "  Olá, chat  ", "receiverGroupId": "group-1"},
        )

    assert response.status_code == 201
    payload = response.json()
    assert payload["success"] is True
    assert payload["message"] == "Mensagem enviada com sucesso"
    assert payload["data"]["id"] == "message-1"
    assert payload["data"]["content"] == "Olá, chat"
    assert payload["data"]["senderUserId"] == "user-1"
    assert payload["data"]["receiverGroupId"] == "group-1"
    assert payload["data"]["messageType"] == "groupMessage"
    assert len(captured_events) == 1
    assert captured_events[0]["type"] == "chat.message.created"
    assert captured_events[0]["data"]["message"]["id"] == "message-1"


def test_chat_websocket_emits_presence_then_connected(
    monkeypatch,
) -> None:
    app = create_app()
    monkeypatch.setattr(chat_module, "_get_engine_from_app", lambda _app: _FakeEngine())
    monkeypatch.setattr(
        chat_module,
        "extract_session_token_from_cookies",
        lambda _cookies: "session-token",
    )
    monkeypatch.setattr(
        chat_module,
        "get_session_by_token",
        lambda _db, _token: SimpleNamespace(
            user_id="user-1",
            user_email="user@example.com",
            user_name="User One",
        ),
    )
    monkeypatch.setattr(
        chat_module,
        "get_chat_access_state",
        lambda _db, _user_id: SimpleNamespace(can_view_chat=True),
    )
    monkeypatch.setattr(
        chat_module,
        "touch_presence_on_connect",
        lambda _db, _user_id: {
            "user_id": "user-1",
            "status": "visible",
            "last_activity": datetime(2026, 7, 23, 12, 0, 0),
            "updated_at": datetime(2026, 7, 23, 12, 0, 0),
        },
    )
    monkeypatch.setattr(
        chat_module,
        "mark_presence_offline_on_disconnect",
        lambda _db, _user_id: None,
    )

    with TestClient(app) as client:
        with client.websocket_connect(
            "/api/chat/ws",
            headers={"x-request-id": "req-1"},
        ) as websocket:
            presence_event = websocket.receive_json()
            connected_event = websocket.receive_json()
            websocket.send_json(
                {
                    "type": "chat.pong",
                    "data": {"timestamp": "2026-07-23T15:00:00.000Z"},
                }
            )

    assert presence_event["type"] == "chat.presence.updated"
    assert presence_event["data"]["userId"] == "user-1"
    assert presence_event["data"]["status"] == "visible"
    assert connected_event["type"] == "chat.connected"
    assert connected_event["data"]["userId"] == "user-1"


async def test_chat_realtime_hub_tracks_pongs_and_broadcasts() -> None:
    hub = ChatRealtimeHub(heartbeat_interval_seconds=60, heartbeat_timeout_seconds=60)
    websocket = _FakeWebSocket()

    first_connection = await hub.register(websocket, user_id="user-1", request_id="req-1")
    assert first_connection is True

    state = hub._connections[id(websocket)]
    previous_last_pong_at = state.last_pong_at - timedelta(seconds=10)
    state.last_pong_at = previous_last_pong_at

    await hub.receive_client_message(
        websocket,
        json.dumps(
            {
                "type": "chat.pong",
                "data": {"timestamp": "2026-07-23T15:00:00.000Z"},
            }
        ),
    )

    assert hub._connections[id(websocket)].last_pong_at > previous_last_pong_at

    await hub.broadcast(
        {
            "type": "chat.connected",
            "data": {"userId": "user-1", "timestamp": "2026-07-23T15:00:00.000Z"},
        }
    )

    assert websocket.sent_json == [
        {
            "type": "chat.connected",
            "data": {"userId": "user-1", "timestamp": "2026-07-23T15:00:00.000Z"},
        }
    ]

    remaining = await hub.unregister(websocket)
    assert remaining == 0


async def test_chat_realtime_hub_ignores_invalid_json_and_non_object_messages() -> None:
    hub = ChatRealtimeHub(heartbeat_interval_seconds=60, heartbeat_timeout_seconds=60)
    websocket = _FakeWebSocket()
    pong_calls: list[str] = []

    await hub.register(websocket, user_id="user-1", request_id="req-1")
    hub.record_pong = lambda _websocket: pong_calls.append("pong")  # type: ignore[method-assign]

    await hub.receive_client_message(websocket, "{")
    await hub.receive_client_message(websocket, json.dumps(["chat.pong"]))
    await hub.receive_client_message(websocket, json.dumps({"type": "chat.pong"}))
    await hub.receive_client_message(websocket, json.dumps({"type": "chat.ping"}))

    assert pong_calls == ["pong"]


def test_chat_router_helpers_cover_parsing_engine_and_payload_paths(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    error_response = chat_module._chat_error_response(
        chat_module.ChatServiceError("Falha", 418, field="content")
    )
    assert isinstance(error_response, JSONResponse)
    assert error_response.status_code == 418
    assert json.loads(error_response.body) == {
        "success": False,
        "error": "Falha",
        "field": "content",
    }

    assert chat_module._handle_chat_service_error(chat_module.ChatServiceError("x")) is True
    assert chat_module._handle_chat_service_error(RuntimeError("x")) is False

    explicit_request = _FakeRequest(request_id="req-123")
    assert chat_module._request_request_id(explicit_request) == "req-123"

    monkeypatch.setattr(
        chat_module,
        "uuid4",
        lambda: UUID("11111111-1111-1111-1111-111111111111"),
    )
    generated_request = _FakeRequest()
    assert chat_module._request_request_id(generated_request) == "11111111-1111-1111-1111-111111111111"

    assert chat_module._query_param({"value": "  texto  "}, "value") == "texto"
    assert chat_module._query_param({"value": [" ", "  outro  "]}, "value") == "outro"
    assert chat_module._query_param({}, "missing") is None

    assert chat_module._parse_int(None, default=7, field="limit") == 7
    with pytest.raises(chat_module.ChatServiceError):
        chat_module._parse_int("abc", default=7, field="limit")
    with pytest.raises(chat_module.ChatServiceError):
        chat_module._parse_int("0", default=7, field="limit", minimum=1)
    with pytest.raises(chat_module.ChatServiceError):
        chat_module._parse_int("10", default=7, field="limit", maximum=5)

    valid_uuid = "12345678-1234-5678-1234-567812345678"
    assert chat_module._parse_uuid(valid_uuid, field="messageId") == valid_uuid
    with pytest.raises(chat_module.ChatServiceError):
        chat_module._parse_uuid("invalid", field="messageId")
    with pytest.raises(chat_module.ChatServiceError):
        chat_module._parse_uuid(None, field="messageId")

    with pytest.raises(chat_module.ChatServiceError):
        chat_module._parse_json_body(["invalid"])

    message_payload = chat_module._chat_message_payload(
        {
            "id": "message-1",
            "content": "Mensagem",
            "sender_user_id": "user-1",
            "sender_name": "User One",
            "receiver_group_id": "group-1",
            "receiver_user_id": None,
            "created_at": datetime(2026, 7, 23, 12, 0),
            "read_at": None,
            "deleted_at": None,
        },
        target_type="chat.message.created",
    )
    assert message_payload["messageType"] == "groupMessage"
    assert message_payload["type"] == "chat.message.created"
    assert message_payload["receiverGroupId"] == "group-1"

    presence_payload = chat_module._presence_payload(
        {
            "user_id": "user-1",
            "status": "visible",
            "last_activity": datetime(2026, 7, 23, 12, 0),
        }
    )
    assert presence_payload["userId"] == "user-1"
    assert presence_payload["lastActivity"].endswith("Z")

    response_payload = chat_module._response_with_serialized_data(
        {"created_at": datetime(2026, 7, 23, 12, 0)},
        message="ok",
    )
    assert response_payload["success"] is True
    assert response_payload["message"] == "ok"
    assert response_payload["data"]["createdAt"].endswith("Z")

    app = SimpleNamespace(state=SimpleNamespace())
    hub_first = chat_module._chat_realtime_hub(app)
    hub_second = chat_module._chat_realtime_hub(app)
    assert hub_first is hub_second
    assert app.state.chat_realtime_hub is hub_first

    no_token_socket = SimpleNamespace(cookies={})
    assert chat_module._authenticate_websocket(no_token_socket, object()) is None

    monkeypatch.setattr(
        chat_module,
        "extract_session_token_from_cookies",
        lambda _cookies: "session-token",
    )
    monkeypatch.setattr(
        chat_module,
        "get_session_by_token",
        lambda _db, _token: SimpleNamespace(
            user_id="user-1",
            user_email="user@example.test",
            user_name="User One",
        ),
    )
    current_user = chat_module._authenticate_websocket(SimpleNamespace(cookies={}), object())
    assert current_user is not None
    assert current_user.id == "user-1"
    assert current_user.email == "user@example.test"

    created_urls: list[str] = []
    app_for_engine = SimpleNamespace(state=SimpleNamespace())
    monkeypatch.setattr(
        chat_module,
        "load_settings",
        lambda: SimpleNamespace(
            database_url=SimpleNamespace(get_secret_value=lambda: "sqlite:///test.db")
        ),
    )
    monkeypatch.setattr(
        chat_module,
        "sqlalchemy_database_url",
        lambda url: f"db://{url}",
    )
    engine_sentinel = SimpleNamespace(name="engine")
    monkeypatch.setattr(
        chat_module,
        "create_engine",
        lambda url, pool_pre_ping: created_urls.append(url) or engine_sentinel,
    )
    resolved_engine = chat_module._get_engine_from_app(app_for_engine)
    assert resolved_engine is engine_sentinel
    assert created_urls == ["db://sqlite:///test.db"]
    assert app_for_engine.state.db_engine is engine_sentinel


def test_chat_router_endpoints_cover_success_error_and_websocket_rejections(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    current_user = CurrentUser(
        id="user-1",
        email="user1@example.test",
        name="User One",
    )

    broadcast_events: list[dict[str, object]] = []

    async def _broadcast_chat_event(_request, event: dict[str, object]) -> None:
        broadcast_events.append(event)

    monkeypatch.setattr(chat_module, "_broadcast_chat_event", _broadcast_chat_event)

    monkeypatch.setattr(
        chat_module,
        "list_messages",
        lambda _db, _current_user_id, group_id, user_id, **kwargs: {
            "messages": [
                {
                    "id": "message-1",
                    "content": "Olá",
                    "sender_user_id": "user-2",
                    "sender_name": "User Two",
                    "receiver_group_id": group_id,
                    "receiver_user_id": user_id,
                    "created_at": datetime(2026, 7, 23, 12, 0),
                    "read_at": None,
                    "deleted_at": None,
                }
            ],
            "count": 1,
            "has_more": False,
        },
    )
    messages_response = asyncio_run(
        chat_module.get_messages(
            _FakeRequest(
                query_items=[
                    ("groupId", "group-1"),
                    ("limit", "5"),
                    ("page", "1"),
                ]
            ),
            current_user,
            object(),
        )
    )
    assert messages_response["data"]["count"] == 1
    assert messages_response["data"]["messages"][0]["messageType"] == "groupMessage"

    invalid_messages_response = asyncio_run(
        chat_module.get_messages(
            _FakeRequest(query_items=[("groupId", "group-1"), ("limit", "0")]),
            current_user,
            object(),
        )
    )
    assert invalid_messages_response.status_code == 400
    assert json.loads(invalid_messages_response.body)["field"] == "limit"

    monkeypatch.setattr(chat_module, "get_messages_count", lambda _db, _user_id, group_id, user_id: 4)
    count_response = asyncio_run(
        chat_module.get_messages_count_route(
            _FakeRequest(query_items=[("groupId", "group-1")]),
            current_user,
            object(),
        )
    )
    assert count_response["data"]["totalCount"] == 4

    count_error_response = asyncio_run(
        chat_module.get_messages_count_route(_FakeRequest(), current_user, object())
    )
    assert count_error_response.status_code == 400

    created_messages: list[dict[str, object]] = []

    def _create_message(_db, sender_user_id, content, receiver_group_id=None, receiver_user_id=None):
        created_messages.append(
            {
                "sender_user_id": sender_user_id,
                "content": content,
                "receiver_group_id": receiver_group_id,
                "receiver_user_id": receiver_user_id,
            }
        )
        return {
            "id": "created-1",
            "content": content.strip(),
            "sender_user_id": sender_user_id,
            "sender_name": "User One",
            "receiver_group_id": receiver_group_id,
            "receiver_user_id": receiver_user_id,
            "created_at": datetime(2026, 7, 23, 12, 0),
            "read_at": None,
            "deleted_at": None,
        }

    monkeypatch.setattr(chat_module, "create_message", _create_message)
    post_message_response = asyncio_run(
        chat_module.post_message(
            _FakeRequest(
                body={
                    "content": "  Olá, chat  ",
                    "receiverGroupId": "group-1",
                },
                request_id="req-message",
            ),
            current_user,
            object(),
        )
    )
    assert post_message_response.status_code == 201
    post_message_body = json.loads(post_message_response.body)
    assert post_message_body["success"] is True
    assert post_message_body["data"]["messageType"] == "groupMessage"
    assert broadcast_events[-1]["type"] == "chat.message.created"
    assert created_messages[-1]["receiver_group_id"] == "group-1"

    invalid_post_message_response = asyncio_run(
        chat_module.post_message(
            _FakeRequest(body={"content": 1}),
            current_user,
            object(),
        )
    )
    assert invalid_post_message_response.status_code == 400

    monkeypatch.setattr(
        chat_module,
        "mark_messages_as_read",
        lambda _db, _user_id, target_id, target_type: {
            "updated_count": 2,
            "read_at": datetime(2026, 7, 23, 12, 1),
            "target_id": target_id,
            "target_type": target_type,
        },
    )
    read_response = asyncio_run(
        chat_module.post_messages_read(
            _FakeRequest(
                body={"targetId": "group-1", "type": "group"},
                request_id="req-read",
            ),
            current_user,
            object(),
        )
    )
    assert read_response["data"]["updatedCount"] == 2
    assert broadcast_events[-1]["type"] == "chat.messages.read"

    invalid_read_response = asyncio_run(
        chat_module.post_messages_read(
            _FakeRequest(body={"targetId": 1}),
            current_user,
            object(),
        )
    )
    assert invalid_read_response.status_code == 400

    monkeypatch.setattr(
        chat_module,
        "mark_message_as_read",
        lambda _db, _user_id, message_id: {
            "updated_count": 1,
            "read_at": datetime(2026, 7, 23, 12, 2),
            "message_id": message_id,
            "target_id": "group-1",
            "target_type": "group",
        },
    )
    single_read_response = asyncio_run(
        chat_module.post_message_read(
            "12345678-1234-5678-1234-567812345678",
            _FakeRequest(request_id="req-single-read"),
            current_user,
            object(),
        )
    )
    assert single_read_response["data"]["message"] == "Mensagem marcada como lida"

    invalid_single_read_response = asyncio_run(
        chat_module.post_message_read(
            "invalid-message-id",
            _FakeRequest(),
            current_user,
            object(),
        )
    )
    assert invalid_single_read_response.status_code == 400

    patch_read_response = asyncio_run(
        chat_module.patch_message_read(
            "12345678-1234-5678-1234-567812345678",
            _FakeRequest(request_id="req-patch-read"),
            current_user,
            object(),
        )
    )
    assert patch_read_response["data"]["message"] == "Mensagem marcada como lida"

    monkeypatch.setattr(
        chat_module,
        "delete_message",
        lambda _db, _user_id, message_id: {
            "message_id": message_id,
            "target_id": "user-2",
            "target_type": "user",
            "deleted_at": datetime(2026, 7, 23, 12, 3),
        },
    )
    delete_response = asyncio_run(
        chat_module.delete_message_route(
            "12345678-1234-5678-1234-567812345678",
            _FakeRequest(request_id="req-delete"),
            current_user,
            object(),
        )
    )
    assert delete_response["success"] is True
    assert broadcast_events[-1]["type"] == "chat.message.deleted"

    invalid_delete_response = asyncio_run(
        chat_module.delete_message_route(
            "invalid-message-id",
            _FakeRequest(),
            current_user,
            object(),
        )
    )
    assert invalid_delete_response.status_code == 400

    monkeypatch.setattr(
        chat_module,
        "get_presence_all",
        lambda _db: [
            {
                "user_id": "user-1",
                "user_name": "User One",
                "status": "visible",
                "last_activity": datetime(2026, 7, 23, 11, 0),
                "updated_at": datetime(2026, 7, 23, 11, 0),
            },
            {
                "user_id": "user-2",
                "user_name": "User Two",
                "status": "visible",
                "last_activity": datetime(2026, 7, 23, 11, 59),
                "updated_at": datetime(2026, 7, 23, 11, 59),
            },
        ],
    )
    monkeypatch.setattr(chat_module, "legacy_local_now", lambda: datetime(2026, 7, 23, 12, 0))
    presence_response = asyncio_run(
        chat_module.get_presence(
            _FakeRequest(request_id="req-presence"),
            current_user,
            object(),
        )
    )
    assert presence_response["data"]["currentUserPresence"]["status"] == "invisible"
    assert presence_response["data"]["presence"][0]["status"] == "visible"

    monkeypatch.setattr(
        chat_module,
        "update_presence",
        lambda _db, user_id, status: {
            "user_id": user_id,
            "status": status,
            "last_activity": datetime(2026, 7, 23, 12, 4),
            "updated_at": datetime(2026, 7, 23, 12, 4),
        },
    )
    presence_post_response = asyncio_run(
        chat_module.post_presence(
            _FakeRequest(body={"status": "visible"}, request_id="req-post-presence"),
            current_user,
            object(),
        )
    )
    assert presence_post_response["message"] == "Status atualizado com sucesso"
    assert broadcast_events[-1]["type"] == "chat.presence.updated"

    invalid_presence_post_response = asyncio_run(
        chat_module.post_presence(
            _FakeRequest(body={"status": 123}),
            current_user,
            object(),
        )
    )
    assert invalid_presence_post_response.status_code == 400

    monkeypatch.setattr(
        chat_module,
        "update_presence_heartbeat",
        lambda _db, user_id: {
            "user_id": user_id,
            "status": "visible",
            "last_activity": datetime(2026, 7, 23, 12, 5),
            "updated_at": datetime(2026, 7, 23, 12, 5),
        },
    )
    presence_patch_response = asyncio_run(
        chat_module.patch_presence(
            _FakeRequest(request_id="req-patch-presence"),
            current_user,
            object(),
        )
    )
    assert presence_patch_response["data"]["success"] is True

    unread_calls: list[tuple[str | None, str | None, int]] = []

    def _get_unread_messages(_db, user_id, group_id=None, conversation_user_id=None, *, limit=15):
        unread_calls.append((group_id, conversation_user_id, limit))
        if group_id is None and conversation_user_id is None:
            return {
                "messages": [
                    {
                        "id": "group-unread-1",
                        "content": "Grupo 1",
                        "sender_user_id": "user-2",
                        "sender_name": "User Two",
                        "receiver_group_id": "group-1",
                        "receiver_user_id": None,
                        "created_at": datetime(2026, 7, 23, 12, 6),
                        "read_at": None,
                        "deleted_at": None,
                    },
                    {
                        "id": "group-read-1",
                        "content": "Grupo lido",
                        "sender_user_id": "user-2",
                        "sender_name": "User Two",
                        "receiver_group_id": "group-1",
                        "receiver_user_id": None,
                        "created_at": datetime(2026, 7, 23, 12, 4),
                        "read_at": datetime(2026, 7, 23, 12, 5),
                        "deleted_at": None,
                    },
                    {
                        "id": "direct-read-1",
                        "content": "Direta lida",
                        "sender_user_id": "user-3",
                        "sender_name": "User Three",
                        "receiver_group_id": None,
                        "receiver_user_id": "user-1",
                        "created_at": datetime(2026, 7, 23, 12, 3),
                        "read_at": datetime(2026, 7, 23, 12, 4),
                        "deleted_at": None,
                    },
                ],
                "count": 3,
            }
        return {
            "messages": [
                {
                    "id": "filtered-1",
                    "content": "Filtrada",
                    "sender_user_id": "user-2",
                    "sender_name": "User Two",
                    "receiver_group_id": group_id,
                    "receiver_user_id": conversation_user_id,
                    "created_at": datetime(2026, 7, 23, 12, 7),
                    "read_at": None,
                    "deleted_at": None,
                }
            ],
            "count": 1,
        }

    monkeypatch.setattr(chat_module, "get_unread_messages", _get_unread_messages)
    unread_all_response = asyncio_run(
        chat_module.get_unread_messages_route(
            _FakeRequest(request_id="req-unread"),
            current_user,
            object(),
        )
    )
    assert unread_all_response["data"]["count"] == 3
    assert list(unread_all_response["data"]["unreadMessages"]) == ["group-1"]
    assert unread_all_response["data"]["unreadMessages"]["group-1"]["messages"][0]["id"] == "group-unread-1"

    unread_group_response = asyncio_run(
        chat_module.get_unread_messages_route(
            _FakeRequest(query_items=[("groupId", "group-1")]),
            current_user,
            object(),
        )
    )
    assert unread_group_response["data"]["messages"][0]["type"] == "group"

    unread_user_response = asyncio_run(
        chat_module.get_unread_messages_route(
            _FakeRequest(query_items=[("userId", "user-2")]),
            current_user,
            object(),
        )
    )
    assert unread_user_response["data"]["messages"][0]["type"] == "user"
    assert unread_calls[0] == (None, None, 15)
    assert unread_calls[1][0] == "group-1"
    assert unread_calls[2][1] == "user-2"

    monkeypatch.setattr(
        chat_module,
        "get_chat_sidebar",
        lambda _db, _user_id: {
            "can_view_chat": True,
            "groups": [{"id": "group-1", "name": "Group One"}],
            "users": [{"id": "user-2", "name": "User Two"}],
            "total_unread": 5,
        },
    )
    sidebar_response = asyncio_run(
        chat_module.get_sidebar(
            _FakeRequest(request_id="req-sidebar"),
            current_user,
            object(),
        )
    )
    assert sidebar_response["data"]["totalUnread"] == 5

    monkeypatch.setattr(
        chat_module,
        "get_chat_sidebar",
        lambda _db, _user_id: {
            "can_view_chat": False,
            "groups": [],
            "users": [],
            "total_unread": 0,
        },
    )
    forbidden_sidebar_response = asyncio_run(
        chat_module.get_sidebar(
            _FakeRequest(request_id="req-sidebar-forbidden"),
            current_user,
            object(),
        )
    )
    assert forbidden_sidebar_response.status_code == 403

    monkeypatch.setattr(
        chat_module,
        "get_chat_status_response",
        lambda user_id, email, status: {
            "user_id": user_id,
            "email": email,
            "status": status,
        },
    )
    status_response = asyncio_run(
        chat_module.post_status(
            _FakeRequest(body={"status": "enabled"}, request_id="req-status"),
            current_user,
        )
    )
    assert status_response["data"]["status"] == "enabled"

    invalid_status_response = asyncio_run(
        chat_module.post_status(
            _FakeRequest(body={"status": "paused"}),
            current_user,
        )
    )
    assert invalid_status_response.status_code == 400


def test_chat_websocket_rejects_invalid_auth_and_reports_runtime_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = SimpleNamespace(state=SimpleNamespace())

    monkeypatch.setattr(chat_module, "_get_engine_from_app", lambda _app: _FakeEngine())
    monkeypatch.setattr(chat_module, "get_chat_access_state", lambda _db, _user_id: SimpleNamespace(can_view_chat=True))
    monkeypatch.setattr(
        chat_module,
        "touch_presence_on_connect",
        lambda _db, _user_id: {
            "user_id": "user-1",
            "status": "visible",
            "last_activity": datetime(2026, 7, 23, 12, 0),
            "updated_at": datetime(2026, 7, 23, 12, 0),
        },
    )
    monkeypatch.setattr(chat_module, "mark_presence_offline_on_disconnect", lambda _db, _user_id: None)
    monkeypatch.setattr(
        chat_module,
        "extract_session_token_from_cookies",
        lambda _cookies: None,
    )
    monkeypatch.setattr(chat_module, "get_session_by_token", lambda _db, _token: None)

    unauthenticated_socket = _RouteWebSocket(app=app, cookies={}, headers={"x-request-id": "req-unauth"})
    asyncio_run(chat_module.websocket_chat(unauthenticated_socket))
    assert unauthenticated_socket.accepted is False
    assert unauthenticated_socket.closed == [(1008, "Usuário não autenticado.")]

    monkeypatch.setattr(
        chat_module,
        "extract_session_token_from_cookies",
        lambda _cookies: "token-1",
    )
    monkeypatch.setattr(
        chat_module,
        "get_session_by_token",
        lambda _db, _token: SimpleNamespace(
            user_id="user-1",
            user_email="user@example.test",
            user_name="User One",
        ),
    )
    monkeypatch.setattr(
        chat_module,
        "get_chat_access_state",
        lambda _db, _user_id: SimpleNamespace(can_view_chat=False),
    )

    denied_socket = _RouteWebSocket(app=app, cookies={}, headers={"x-request-id": "req-denied"})
    asyncio_run(chat_module.websocket_chat(denied_socket))
    assert denied_socket.accepted is False
    assert denied_socket.closed == [(1008, "Acesso ao chat negado.")]

    monkeypatch.setattr(
        chat_module,
        "get_chat_access_state",
        lambda _db, _user_id: SimpleNamespace(can_view_chat=True),
    )

    class _RuntimeErrorHub:
        def __init__(self) -> None:
            self.broadcasts: list[dict[str, object]] = []
            self.unregistered: list[object] = []
            self.shutting_down = False

        async def register(self, websocket, user_id: str, request_id: str) -> bool:
            return True

        async def broadcast(self, payload: dict[str, object], request_id: str | None = None) -> None:
            self.broadcasts.append(payload)

        async def receive_client_message(self, websocket, raw_message: str) -> None:
            raise RuntimeError("boom")

        async def unregister(self, websocket) -> int:
            self.unregistered.append(websocket)
            return 0

    runtime_hub = _RuntimeErrorHub()
    monkeypatch.setattr(chat_module, "_chat_realtime_hub", lambda _app: runtime_hub)
    runtime_socket = _RouteWebSocket(
        app=app,
        cookies={"session": "token"},
        headers={"x-request-id": "req-runtime"},
        messages=[json.dumps({"type": "chat.ping"})],
    )
    asyncio_run(chat_module.websocket_chat(runtime_socket))
    assert runtime_socket.accepted is True
    assert runtime_socket.closed == []
    assert runtime_hub.unregistered == [runtime_socket]


def test_chat_router_cover_additional_error_branches_and_engine_creation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    current_user = CurrentUser(
        id="user-1",
        email="user1@example.test",
        name="User One",
    )

    def _body(response):
        if isinstance(response, JSONResponse):
            return json.loads(response.body)
        return response

    monkeypatch.setattr(
        chat_module,
        "get_messages_count",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("boom")),
    )
    messages_count_error = asyncio_run(
        chat_module.get_messages_count_route(
            _FakeRequest(query_items=[("groupId", "group-1")]),
            current_user,
            object(),
        )
    )
    assert messages_count_error.status_code == 500

    monkeypatch.setattr(
        chat_module,
        "create_message",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("boom")),
    )
    invalid_receiver_group = asyncio_run(
        chat_module.post_message(
            _FakeRequest(body={"content": "Olá", "receiverGroupId": 1}),
            current_user,
            object(),
        )
    )
    assert invalid_receiver_group.status_code == 400

    message_error = asyncio_run(
        chat_module.post_message(
            _FakeRequest(body={"content": "Olá", "receiverUserId": "user-2"}),
            current_user,
            object(),
        )
    )
    assert message_error.status_code == 500

    monkeypatch.setattr(
        chat_module,
        "mark_messages_as_read",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("boom")),
    )
    messages_read_error = asyncio_run(
        chat_module.post_messages_read(
            _FakeRequest(body={"targetId": "group-1", "type": "group"}),
            current_user,
            object(),
        )
    )
    assert messages_read_error.status_code == 500

    monkeypatch.setattr(
        chat_module,
        "mark_message_as_read",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("boom")),
    )
    message_read_error = asyncio_run(
        chat_module.post_message_read(
            "12345678-1234-5678-1234-567812345678",
            _FakeRequest(),
            current_user,
            object(),
        )
    )
    assert message_read_error.status_code == 500

    patch_message_read_error = asyncio_run(
        chat_module.patch_message_read(
            "12345678-1234-5678-1234-567812345678",
            _FakeRequest(),
            current_user,
            object(),
        )
    )
    assert patch_message_read_error.status_code == 500

    monkeypatch.setattr(
        chat_module,
        "delete_message",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("boom")),
    )
    delete_message_error = asyncio_run(
        chat_module.delete_message_route(
            "12345678-1234-5678-1234-567812345678",
            _FakeRequest(),
            current_user,
            object(),
        )
    )
    assert delete_message_error.status_code == 500

    monkeypatch.setattr(
        chat_module,
        "get_presence_all",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("boom")),
    )
    presence_error = asyncio_run(chat_module.get_presence(_FakeRequest(), current_user, object()))
    assert presence_error.status_code == 500

    monkeypatch.setattr(
        chat_module,
        "update_presence",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("boom")),
    )
    presence_post_error = asyncio_run(
        chat_module.post_presence(
            _FakeRequest(body={"status": "visible"}),
            current_user,
            object(),
        )
    )
    assert presence_post_error.status_code == 500

    monkeypatch.setattr(
        chat_module,
        "update_presence_heartbeat",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("boom")),
    )
    presence_patch_error = asyncio_run(chat_module.patch_presence(_FakeRequest(), current_user, object()))
    assert presence_patch_error.status_code == 500

    monkeypatch.setattr(
        chat_module,
        "get_unread_messages",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("boom")),
    )
    unread_error = asyncio_run(
        chat_module.get_unread_messages_route(
            _FakeRequest(query_items=[("limit", "5")]),
            current_user,
            object(),
        )
    )
    assert unread_error.status_code == 500

    monkeypatch.setattr(
        chat_module,
        "get_chat_sidebar",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("boom")),
    )
    sidebar_error = asyncio_run(chat_module.get_sidebar(_FakeRequest(), current_user, object()))
    assert sidebar_error.status_code == 500

    monkeypatch.setattr(
        chat_module,
        "get_chat_status_response",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("boom")),
    )
    status_error = asyncio_run(
        chat_module.post_status(_FakeRequest(body={"status": "enabled"}), current_user)
    )
    assert status_error.status_code == 500

    monkeypatch.setattr(chat_module, "sqlalchemy_database_url", lambda url: url)
    monkeypatch.setattr(
        chat_module,
        "load_settings",
        lambda: SimpleNamespace(
            database_url=SimpleNamespace(get_secret_value=lambda: "sqlite+pysqlite:///:memory:")
        ),
    )
    monkeypatch.setattr(
        chat_module,
        "create_engine",
        lambda _url, pool_pre_ping=True: _FakeEngine(),
    )
    app = SimpleNamespace(state=SimpleNamespace())
    engine = chat_module._get_engine_from_app(app)  # noqa: SLF001
    assert isinstance(engine, _FakeEngine)
    assert app.state.db_engine is engine
