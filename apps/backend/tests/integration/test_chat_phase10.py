from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import pytest
from fastapi import Request
from fastapi.testclient import TestClient
from sqlalchemy import Boolean, Column, DateTime, MetaData, String, Table, create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.pool import QueuePool

from silo.api.dependencies import ChatAccessState, CurrentUser, require_chat_access
from silo.api.main import create_app
from silo.api.routers import chat as chat_module
from silo.services import chat_service

FIXED_NOW = datetime(2026, 7, 23, 12, 0, 0)

ADMIN_ID = "fixture-user-admin"
PARTIAL_ID = "fixture-user-partial"
GROUP_ID = "group-partial"


@dataclass(frozen=True, slots=True)
class _ChatTables:
    user: Table
    group: Table
    chat_message: Table
    chat_user_presence: Table

    def as_mapping(self) -> dict[str, Table]:
        return {
            "user": self.user,
            "group": self.group,
            "chat_message": self.chat_message,
            "chat_user_presence": self.chat_user_presence,
        }


def _make_chat_tables(metadata: MetaData) -> _ChatTables:
    user = Table(
        "user",
        metadata,
        Column("id", String, primary_key=True),
        Column("name", String, nullable=False),
        Column("email", String, nullable=False),
        Column("image", String, nullable=True),
        Column("is_active", Boolean, nullable=False),
    )
    group = Table(
        "group",
        metadata,
        Column("id", String, primary_key=True),
        Column("name", String, nullable=False),
        Column("description", String, nullable=True),
        Column("icon", String, nullable=True),
        Column("color", String, nullable=True),
        Column("active", Boolean, nullable=False),
    )
    chat_message = Table(
        "chat_message",
        metadata,
        Column("id", String, primary_key=True),
        Column("content", String, nullable=False),
        Column("sender_user_id", String, nullable=False),
        Column("receiver_group_id", String, nullable=True),
        Column("receiver_user_id", String, nullable=True),
        Column("created_at", DateTime, nullable=False),
        Column("updated_at", DateTime, nullable=False),
        Column("read_at", DateTime, nullable=True),
        Column("deleted_at", DateTime, nullable=True),
    )
    chat_user_presence = Table(
        "chat_user_presence",
        metadata,
        Column("user_id", String, primary_key=True),
        Column("status", String, nullable=False),
        Column("last_activity", DateTime, nullable=False),
        Column("updated_at", DateTime, nullable=False),
    )
    return _ChatTables(
        user=user,
        group=group,
        chat_message=chat_message,
        chat_user_presence=chat_user_presence,
    )


def _build_chat_integration_app(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> tuple[Any, Engine, _ChatTables]:
    database_path = tmp_path / "chat-phase10.sqlite3"
    engine = create_engine(
        f"sqlite+pysqlite:///{database_path}",
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=QueuePool,
        pool_size=5,
        max_overflow=0,
    )

    metadata = MetaData()
    tables = _make_chat_tables(metadata)
    metadata.create_all(engine)

    with engine.begin() as connection:
        connection.execute(
            tables.user.insert(),
            [
                {
                    "id": ADMIN_ID,
                    "name": "Fixture Admin",
                    "email": "admin@fixture.local",
                    "image": None,
                    "is_active": True,
                },
                {
                    "id": PARTIAL_ID,
                    "name": "Fixture Partial",
                    "email": "partial@fixture.local",
                    "image": None,
                    "is_active": True,
                },
            ],
        )
        connection.execute(
            tables.group.insert(),
            [
                {
                    "id": GROUP_ID,
                    "name": "Grupo Parcial",
                    "description": "Grupo de testes do chat",
                    "icon": None,
                    "color": "#334155",
                    "active": True,
                }
            ],
        )

    app = create_app()
    app.state.db_engine = engine

    allow_all_access = ChatAccessState(groups=(), chat_enabled=True, can_view_chat=True)

    def _require_chat_access_override(request: Request) -> CurrentUser:
        user_id = request.headers.get("x-test-user-id")
        if not isinstance(user_id, str) or not user_id:
            raise AssertionError("x-test-user-id ausente no teste de chat.")
        if user_id == ADMIN_ID:
            return CurrentUser(id=ADMIN_ID, email="admin@fixture.local", name="Fixture Admin")
        if user_id == PARTIAL_ID:
            return CurrentUser(id=PARTIAL_ID, email="partial@fixture.local", name="Fixture Partial")
        raise AssertionError(f"Usuário inesperado no teste de chat: {user_id}")

    def _authenticate_websocket_override(websocket, _db):
        user_id = websocket.headers.get("x-test-user-id")
        if user_id == ADMIN_ID:
            return CurrentUser(id=ADMIN_ID, email="admin@fixture.local", name="Fixture Admin")
        if user_id == PARTIAL_ID:
            return CurrentUser(id=PARTIAL_ID, email="partial@fixture.local", name="Fixture Partial")
        return None

    monkeypatch.setattr(chat_service, "legacy_tables", tables.as_mapping())
    monkeypatch.setattr(chat_service, "get_chat_access_state", lambda _db, _user_id: allow_all_access)
    monkeypatch.setattr(chat_service, "legacy_local_now", lambda: FIXED_NOW)
    monkeypatch.setattr(chat_module, "get_chat_access_state", lambda _db, _user_id: allow_all_access)
    monkeypatch.setattr(chat_module, "_authenticate_websocket", _authenticate_websocket_override)
    monkeypatch.setattr(chat_module, "legacy_local_now", lambda: FIXED_NOW)

    app.dependency_overrides[require_chat_access] = _require_chat_access_override
    return app, engine, tables


def _headers(user_id: str) -> dict[str, str]:
    return {
        "x-test-user-id": user_id,
        "x-request-id": f"test-{user_id}",
    }


def _assert_event(websocket, expected_type: str) -> dict[str, Any]:
    payload = websocket.receive_json()
    assert payload["type"] == expected_type
    return payload


def _post_message(
    client: TestClient,
    *,
    user_id: str,
    content: str,
    receiver_group_id: str | None = None,
    receiver_user_id: str | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {"content": content}
    if receiver_group_id is not None:
        payload["receiverGroupId"] = receiver_group_id
    if receiver_user_id is not None:
        payload["receiverUserId"] = receiver_user_id

    response = client.post("/api/chat/messages", headers=_headers(user_id), json=payload)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["success"] is True
    return body["data"]


def _get_payload(client: TestClient, path: str, *, user_id: str) -> dict[str, Any]:
    response = client.get(path, headers=_headers(user_id))
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["success"] is True
    return body["data"]


def _get_presence_row(payload: dict[str, Any], user_id: str) -> dict[str, Any] | None:
    if payload.get("currentUserPresence") and payload["currentUserPresence"]["userId"] == user_id:
        return payload["currentUserPresence"]
    for row in payload.get("presence", []):
        if row["userId"] == user_id:
            return row
    return None


def test_chat_phase10_end_to_end_flow_with_two_tabs_and_receipts(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    app, engine, _tables = _build_chat_integration_app(monkeypatch, tmp_path)

    with TestClient(app) as client:
        partial_headers = _headers(PARTIAL_ID)
        admin_headers = _headers(ADMIN_ID)

        with client.websocket_connect("/api/chat/ws", headers=partial_headers) as partial_ws:
            partial_presence = _assert_event(partial_ws, "chat.presence.updated")
            partial_connected = _assert_event(partial_ws, "chat.connected")
            assert partial_presence["data"]["userId"] == PARTIAL_ID
            assert partial_presence["data"]["status"] == "visible"
            assert partial_connected["data"]["userId"] == PARTIAL_ID

            with client.websocket_connect("/api/chat/ws", headers=admin_headers) as admin_a_ws:
                admin_a_presence = _assert_event(admin_a_ws, "chat.presence.updated")
                admin_a_connected = _assert_event(admin_a_ws, "chat.connected")
                assert admin_a_presence["data"]["userId"] == ADMIN_ID
                assert admin_a_presence["data"]["status"] == "visible"
                assert admin_a_connected["data"]["userId"] == ADMIN_ID

                partial_admin_visible = _assert_event(partial_ws, "chat.presence.updated")
                assert partial_admin_visible["data"]["userId"] == ADMIN_ID
                assert partial_admin_visible["data"]["status"] == "visible"

                with client.websocket_connect("/api/chat/ws", headers=admin_headers) as admin_b_ws:
                    admin_b_connected = _assert_event(admin_b_ws, "chat.connected")
                    assert admin_b_connected["data"]["userId"] == ADMIN_ID

                    sidebar_partial = _get_payload(client, "/api/chat/sidebar", user_id=PARTIAL_ID)
                    assert sidebar_partial["totalUnread"] == 0
                    assert _get_presence_row(_get_payload(client, "/api/chat/presence", user_id=PARTIAL_ID), ADMIN_ID)[
                        "status"
                    ] == "visible"

                sidebar_after_first_tab_close = _get_payload(client, "/api/chat/sidebar", user_id=PARTIAL_ID)
                assert sidebar_after_first_tab_close["totalUnread"] == 0
                presence_after_first_tab_close = _get_payload(client, "/api/chat/presence", user_id=PARTIAL_ID)
                assert _get_presence_row(presence_after_first_tab_close, ADMIN_ID)["status"] == "visible"

            partial_admin_offline = _assert_event(partial_ws, "chat.presence.updated")
            assert partial_admin_offline["data"]["userId"] == ADMIN_ID
            assert partial_admin_offline["data"]["status"] == "invisible"

            presence_after_admin_b_close = _get_payload(client, "/api/chat/presence", user_id=PARTIAL_ID)
            assert _get_presence_row(presence_after_admin_b_close, ADMIN_ID)["status"] == "invisible"

            group_message = _post_message(
                client,
                user_id=ADMIN_ID,
                content="Phase 10 group message",
                receiver_group_id=GROUP_ID,
            )
            partial_group_event = _assert_event(partial_ws, "chat.message.created")
            assert partial_group_event["data"]["message"]["id"] == group_message["id"]
            assert partial_group_event["data"]["message"]["receiverGroupId"] == GROUP_ID

            sidebar_after_group_message = _get_payload(client, "/api/chat/sidebar", user_id=PARTIAL_ID)
            assert sidebar_after_group_message["totalUnread"] == 1

            group_messages = _get_payload(client, f"/api/chat/messages?groupId={GROUP_ID}", user_id=PARTIAL_ID)
            assert group_messages["count"] == 1

            unread_after_group_message = _get_payload(client, "/api/chat/unread-messages", user_id=PARTIAL_ID)
            assert unread_after_group_message["count"] == 1

            private_message = _post_message(
                client,
                user_id=ADMIN_ID,
                content="Phase 10 private message",
                receiver_user_id=PARTIAL_ID,
            )
            partial_private_event = _assert_event(partial_ws, "chat.message.created")
            assert partial_private_event["data"]["message"]["id"] == private_message["id"]
            assert partial_private_event["data"]["message"]["receiverUserId"] == PARTIAL_ID

            sidebar_after_private_message = _get_payload(client, "/api/chat/sidebar", user_id=PARTIAL_ID)
            assert sidebar_after_private_message["totalUnread"] == 2

            private_messages = _get_payload(client, f"/api/chat/messages?userId={ADMIN_ID}", user_id=PARTIAL_ID)
            assert private_messages["count"] == 1

            unread_after_private_message = _get_payload(client, "/api/chat/unread-messages", user_id=PARTIAL_ID)
            assert unread_after_private_message["count"] == 3

            read_group = client.post(
                "/api/chat/messages/read",
                headers=partial_headers,
                json={"targetId": GROUP_ID, "type": "group"},
            )
            assert read_group.status_code == 200, read_group.text
            assert read_group.json()["success"] is True
            group_read_event = _assert_event(partial_ws, "chat.messages.read")
            assert group_read_event["data"]["targetId"] == GROUP_ID
            assert group_read_event["data"]["updatedCount"] == 1

            sidebar_after_group_read = _get_payload(client, "/api/chat/sidebar", user_id=PARTIAL_ID)
            assert sidebar_after_group_read["totalUnread"] == 1

            read_private = client.post(
                f"/api/chat/messages/{private_message['id']}/read",
                headers=partial_headers,
            )
            assert read_private.status_code == 200, read_private.text
            assert read_private.json()["success"] is True
            private_read_event = _assert_event(partial_ws, "chat.message.read")
            assert private_read_event["data"]["messageId"] == private_message["id"]

            sidebar_after_private_read = _get_payload(client, "/api/chat/sidebar", user_id=PARTIAL_ID)
            assert sidebar_after_private_read["totalUnread"] == 0

            delete_group = client.delete(
                f"/api/chat/messages/{group_message['id']}",
                headers=admin_headers,
            )
            assert delete_group.status_code == 200, delete_group.text
            assert delete_group.json()["success"] is True
            deleted_event = _assert_event(partial_ws, "chat.message.deleted")
            assert deleted_event["data"]["messageId"] == group_message["id"]

            deleted_group_messages = _get_payload(client, f"/api/chat/messages?groupId={GROUP_ID}", user_id=PARTIAL_ID)
            assert deleted_group_messages["count"] == 0

            unread_after_delete = _get_payload(client, "/api/chat/unread-messages", user_id=PARTIAL_ID)
            assert unread_after_delete["count"] == 0

            sidebar_after_delete = _get_payload(client, "/api/chat/sidebar", user_id=PARTIAL_ID)
            assert sidebar_after_delete["totalUnread"] == 0

            partial_ws.__exit__(None, None, None)

    client.app.state.chat_realtime_hub._connections.clear()
    client.app.state.chat_realtime_hub._connection_counts.clear()
    time.sleep(0.2)
    with client.websocket_connect("/api/chat/ws", headers=admin_headers) as admin_reconnect_ws:
        reconnect_event = admin_reconnect_ws.receive_json()
        assert reconnect_event["type"] in {"chat.presence.updated", "chat.connected"}
        if reconnect_event["type"] == "chat.presence.updated":
            assert reconnect_event["data"]["userId"] == ADMIN_ID
            assert reconnect_event["data"]["status"] == "visible"
        else:
            assert reconnect_event["data"]["userId"] == ADMIN_ID

        reconnect_presence = client.post(
            "/api/chat/presence",
            headers=admin_headers,
            json={"status": "visible"},
        )
        assert reconnect_presence.status_code == 200, reconnect_presence.text
        assert reconnect_presence.json()["success"] is True

        admin_presence_payload = _get_payload(client, "/api/chat/presence", user_id=ADMIN_ID)
        assert _get_presence_row(admin_presence_payload, ADMIN_ID)["status"] == "visible"

        admin_sidebar_payload = _get_payload(client, "/api/chat/sidebar", user_id=ADMIN_ID)
        assert admin_sidebar_payload["totalUnread"] == 0

    assert len(client.app.state.chat_realtime_hub._connections) == 0
    assert engine.pool.checkedout() == 0


def test_chat_phase10_soak_repeated_connect_disconnect_keeps_hub_and_pool_empty(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    app, engine, _tables = _build_chat_integration_app(monkeypatch, tmp_path)

    with TestClient(app) as client:
        user_headers = _headers(ADMIN_ID)

        for index in range(25):
            with client.websocket_connect("/api/chat/ws", headers=user_headers) as websocket:
                presence_event = _assert_event(websocket, "chat.presence.updated")
                connected_event = _assert_event(websocket, "chat.connected")
                assert presence_event["data"]["userId"] == ADMIN_ID
                assert connected_event["data"]["userId"] == ADMIN_ID

                sidebar = _get_payload(client, "/api/chat/sidebar", user_id=ADMIN_ID)
                assert sidebar["totalUnread"] == 0

            time.sleep(0.02)
            assert len(client.app.state.chat_realtime_hub._connections) == 0
            assert engine.pool.checkedout() == 0

    assert len(app.state.chat_realtime_hub._connections) == 0
    assert engine.pool.checkedout() == 0


def test_chat_phase10_rejects_invalid_query_strings_and_uuid_inputs(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    app, _engine, _tables = _build_chat_integration_app(monkeypatch, tmp_path)

    with TestClient(app) as client:
        invalid_limit = client.get(
            f"/api/chat/messages?groupId={GROUP_ID}&limit=abc",
            headers=_headers(ADMIN_ID),
        )
        assert invalid_limit.status_code == 400, invalid_limit.text
        assert invalid_limit.json()["field"] == "limit"

        invalid_message_read = client.post(
            "/api/chat/messages/not-a-uuid/read",
            headers=_headers(ADMIN_ID),
        )
        assert invalid_message_read.status_code == 400, invalid_message_read.text
        assert invalid_message_read.json()["field"] == "messageId"

        invalid_message_delete = client.delete(
            "/api/chat/messages/not-a-uuid",
            headers=_headers(ADMIN_ID),
        )
        assert invalid_message_delete.status_code == 400, invalid_message_delete.text
        assert invalid_message_delete.json()["field"] == "messageId"
