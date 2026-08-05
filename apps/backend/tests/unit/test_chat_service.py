from __future__ import annotations

from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest
from sqlalchemy import Boolean, Column, DateTime, MetaData, String, Table, create_engine, insert, select

from silo.services import chat_service


FIXED_NOW = datetime(2026, 7, 23, 12, 0, 0)


def _build_chat_tables(metadata: MetaData) -> dict[str, Table]:
    return {
        "user": Table(
            "user",
            metadata,
            Column("id", String, primary_key=True),
            Column("name", String, nullable=False),
            Column("email", String, nullable=False),
            Column("image", String, nullable=True),
            Column("is_active", Boolean, nullable=False),
        ),
        "group": Table(
            "group",
            metadata,
            Column("id", String, primary_key=True),
            Column("name", String, nullable=False),
            Column("description", String, nullable=True),
            Column("icon", String, nullable=True),
            Column("color", String, nullable=True),
            Column("active", Boolean, nullable=False),
        ),
        "chat_message": Table(
            "chat_message",
            metadata,
            Column("id", String, primary_key=True),
            Column("content", String, nullable=False),
            Column("sender_user_id", String, nullable=False),
            Column("receiver_group_id", String, nullable=True),
            Column("receiver_user_id", String, nullable=True),
            Column("created_at", DateTime, nullable=False),
            Column("read_at", DateTime, nullable=True),
            Column("deleted_at", DateTime, nullable=True),
            Column("updated_at", DateTime, nullable=False),
        ),
        "chat_user_presence": Table(
            "chat_user_presence",
            metadata,
            Column("user_id", String, primary_key=True),
            Column("status", String, nullable=False),
            Column("last_activity", DateTime, nullable=False),
            Column("updated_at", DateTime, nullable=False),
        ),
    }


def _seed_chat_data(connection, tables: dict[str, Table]) -> None:  # type: ignore[no-untyped-def]
    connection.execute(
        insert(tables["user"]),
        [
            {"id": "user-1", "name": "User One", "email": "user1@example.test", "image": None, "is_active": True},
            {"id": "user-2", "name": "User Two", "email": "user2@example.test", "image": None, "is_active": True},
            {"id": "user-3", "name": "User Three", "email": "user3@example.test", "image": None, "is_active": True},
            {"id": "user-4", "name": "User Four", "email": "user4@example.test", "image": None, "is_active": False},
        ],
    )
    connection.execute(
        insert(tables["group"]),
        [
            {
                "id": "group-1",
                "name": "Group One",
                "description": "Active group",
                "icon": "users",
                "color": "#1d4ed8",
                "active": True,
            },
            {
                "id": "group-2",
                "name": "Group Two",
                "description": "Inactive group",
                "icon": "users",
                "color": "#334155",
                "active": False,
            },
        ],
    )
    connection.execute(
        insert(tables["chat_message"]),
        [
            {
                "id": "group-delete-1",
                "content": "Grupo para excluir",
                "sender_user_id": "user-1",
                "receiver_group_id": "group-1",
                "receiver_user_id": None,
                "created_at": FIXED_NOW - timedelta(minutes=5),
                "read_at": None,
                "deleted_at": None,
                "updated_at": FIXED_NOW - timedelta(minutes=5),
            },
            {
                "id": "group-unread-1",
                "content": "Mensagem de grupo",
                "sender_user_id": "user-2",
                "receiver_group_id": "group-1",
                "receiver_user_id": None,
                "created_at": FIXED_NOW - timedelta(hours=1),
                "read_at": None,
                "deleted_at": None,
                "updated_at": FIXED_NOW - timedelta(hours=1),
            },
            {
                "id": "group-self-1",
                "content": "Minha mensagem de grupo",
                "sender_user_id": "user-1",
                "receiver_group_id": "group-1",
                "receiver_user_id": None,
                "created_at": FIXED_NOW - timedelta(hours=2),
                "read_at": None,
                "deleted_at": None,
                "updated_at": FIXED_NOW - timedelta(hours=2),
            },
            {
                "id": "group-read-1",
                "content": "Grupo lido",
                "sender_user_id": "user-3",
                "receiver_group_id": "group-1",
                "receiver_user_id": None,
                "created_at": FIXED_NOW - timedelta(hours=3),
                "read_at": FIXED_NOW - timedelta(hours=2),
                "deleted_at": None,
                "updated_at": FIXED_NOW - timedelta(hours=2),
            },
            {
                "id": "direct-delete-1",
                "content": "Direto para excluir",
                "sender_user_id": "user-1",
                "receiver_group_id": None,
                "receiver_user_id": "user-2",
                "created_at": FIXED_NOW - timedelta(minutes=10),
                "read_at": None,
                "deleted_at": None,
                "updated_at": FIXED_NOW - timedelta(minutes=10),
            },
            {
                "id": "direct-outbound-1",
                "content": "Saída direta",
                "sender_user_id": "user-1",
                "receiver_group_id": None,
                "receiver_user_id": "user-2",
                "created_at": FIXED_NOW - timedelta(hours=1, minutes=10),
                "read_at": None,
                "deleted_at": None,
                "updated_at": FIXED_NOW - timedelta(hours=1, minutes=10),
            },
            {
                "id": "direct-inbound-1",
                "content": "Entrada direta",
                "sender_user_id": "user-2",
                "receiver_group_id": None,
                "receiver_user_id": "user-1",
                "created_at": FIXED_NOW - timedelta(hours=1, minutes=20),
                "read_at": None,
                "deleted_at": None,
                "updated_at": FIXED_NOW - timedelta(hours=1, minutes=20),
            },
            {
                "id": "direct-read-1",
                "content": "Direto lido",
                "sender_user_id": "user-3",
                "receiver_group_id": None,
                "receiver_user_id": "user-1",
                "created_at": FIXED_NOW - timedelta(hours=5),
                "read_at": FIXED_NOW - timedelta(hours=4),
                "deleted_at": None,
                "updated_at": FIXED_NOW - timedelta(hours=4),
            },
            {
                "id": "direct-old-1",
                "content": "Mensagem antiga",
                "sender_user_id": "user-1",
                "receiver_group_id": None,
                "receiver_user_id": "user-2",
                "created_at": FIXED_NOW - timedelta(hours=30),
                "read_at": None,
                "deleted_at": None,
                "updated_at": FIXED_NOW - timedelta(hours=30),
            },
            {
                "id": "deleted-message-1",
                "content": chat_service.CHAT_MESSAGE_DELETED_LABEL,
                "sender_user_id": "user-1",
                "receiver_group_id": None,
                "receiver_user_id": "user-2",
                "created_at": FIXED_NOW - timedelta(hours=1),
                "read_at": None,
                "deleted_at": FIXED_NOW - timedelta(minutes=30),
                "updated_at": FIXED_NOW - timedelta(minutes=30),
            },
            {
                "id": "invalid-message-1",
                "content": "Mensagem inválida",
                "sender_user_id": "user-2",
                "receiver_group_id": None,
                "receiver_user_id": None,
                "created_at": FIXED_NOW - timedelta(hours=1),
                "read_at": None,
                "deleted_at": None,
                "updated_at": FIXED_NOW - timedelta(hours=1),
            },
        ],
    )
    connection.execute(
        insert(tables["chat_user_presence"]),
        [
            {
                "user_id": "user-1",
                "status": chat_service.CHAT_PRESENCE_VISIBLE,
                "last_activity": FIXED_NOW - timedelta(minutes=5),
                "updated_at": FIXED_NOW - timedelta(minutes=5),
            },
            {
                "user_id": "user-2",
                "status": chat_service.CHAT_PRESENCE_VISIBLE,
                "last_activity": FIXED_NOW - timedelta(minutes=45),
                "updated_at": FIXED_NOW - timedelta(minutes=45),
            },
            {
                "user_id": "user-3",
                "status": chat_service.CHAT_PRESENCE_INVISIBLE,
                "last_activity": FIXED_NOW - timedelta(minutes=10),
                "updated_at": FIXED_NOW - timedelta(minutes=10),
            },
        ],
    )
    connection.commit()


@pytest.fixture()
def chat_db(tmp_path, monkeypatch):
    engine = create_engine(
        f"sqlite+pysqlite:///{tmp_path / 'chat.sqlite3'}",
        future=True,
        connect_args={"check_same_thread": False},
    )
    tables = _build_chat_tables(MetaData())
    tables["user"].metadata.create_all(engine)
    monkeypatch.setattr(chat_service, "legacy_tables", tables)
    monkeypatch.setattr(chat_service, "legacy_local_now", lambda: FIXED_NOW)
    with engine.begin() as connection:
        _seed_chat_data(connection, tables)
    connection = engine.connect()
    try:
        yield connection, tables
    finally:
        connection.close()
        engine.dispose()


def test_chat_service_listing_presence_sidebar_and_timestamp_helpers(chat_db, monkeypatch: pytest.MonkeyPatch) -> None:
    connection, tables = chat_db
    del tables

    with pytest.raises(chat_service.ChatServiceError):
        chat_service.list_messages(connection, "user-1", None, None)

    group_offset = chat_service.list_messages(connection, "user-1", "group-1", None, limit=1, page=2)
    assert group_offset["count"] == 1
    assert group_offset["messages"][0]["id"] == "group-unread-1"

    group_before = chat_service.list_messages(
        connection,
        "user-1",
        "group-1",
        None,
        limit=10,
        page=1,
        before="2026-07-23T11:30:00",
    )
    assert group_before["messages"][0]["id"] == "group-unread-1"

    direct_after = chat_service.list_messages(
        connection,
        "user-1",
        None,
        "user-2",
        limit=10,
        page=1,
        after="2026-07-23T10:00:00",
    )
    assert direct_after["count"] == 3
    assert direct_after["messages"][0]["id"] == "direct-delete-1"

    assert chat_service.get_messages_count(connection, "user-1", group_id="group-1") == 4
    assert chat_service.get_messages_count(connection, "user-1", conversation_user_id="user-2") == 4
    with pytest.raises(chat_service.ChatServiceError):
        chat_service.get_messages_count(connection, "user-1")

    unread_all = chat_service.get_unread_messages(connection, "user-1")
    assert unread_all["count"] == 4
    assert {row["id"] for row in unread_all["messages"]} == {
        "group-unread-1",
        "direct-inbound-1",
        "invalid-message-1",
    }

    unread_group = chat_service.get_unread_messages(connection, "user-1", group_id="group-1")
    assert unread_group["count"] == 1
    assert unread_group["messages"][0]["id"] == "group-unread-1"

    unread_direct = chat_service.get_unread_messages(
        connection,
        "user-1",
        conversation_user_id="user-2",
    )
    assert unread_direct["count"] == 1
    assert unread_direct["messages"][0]["id"] == "direct-inbound-1"

    monkeypatch.setattr(
        chat_service,
        "get_chat_access_state",
        lambda _connection, _user_id: SimpleNamespace(can_view_chat=False),
    )
    no_access_sidebar = chat_service.get_chat_sidebar(connection, "user-1")
    assert no_access_sidebar == {
        "can_view_chat": False,
        "groups": [],
        "users": [],
        "total_unread": 0,
    }

    monkeypatch.setattr(
        chat_service,
        "get_chat_access_state",
        lambda _connection, _user_id: SimpleNamespace(can_view_chat=True),
    )
    sidebar = chat_service.get_chat_sidebar(connection, "user-1")
    assert sidebar["can_view_chat"] is True
    assert sidebar["groups"][0]["unread_count"] == 1
    assert sidebar["total_unread"] == 2
    assert [row["id"] for row in sidebar["users"]] == ["user-2", "user-1", "user-3"]
    assert sidebar["users"][0]["presence_status"] == chat_service.CHAT_PRESENCE_VISIBLE

    assert chat_service.update_presence(connection, "user-4", chat_service.CHAT_PRESENCE_VISIBLE)["status"] == chat_service.CHAT_PRESENCE_VISIBLE
    assert chat_service.update_presence(
        connection,
        "user-4",
        chat_service.CHAT_PRESENCE_INVISIBLE,
    )["status"] == chat_service.CHAT_PRESENCE_INVISIBLE
    with pytest.raises(chat_service.ChatServiceError):
        chat_service.update_presence(connection, "user-4", "away")

    heartbeat_new = chat_service.update_presence_heartbeat(connection, "user-5")
    assert heartbeat_new["status"] == chat_service.CHAT_PRESENCE_VISIBLE
    heartbeat_existing = chat_service.update_presence_heartbeat(connection, "user-2")
    assert heartbeat_existing["status"] == chat_service.CHAT_PRESENCE_VISIBLE

    connect_new = chat_service.touch_presence_on_connect(connection, "user-6")
    assert connect_new["status"] == chat_service.CHAT_PRESENCE_VISIBLE
    connect_existing = chat_service.touch_presence_on_connect(connection, "user-3")
    assert connect_existing["status"] == chat_service.CHAT_PRESENCE_INVISIBLE

    offline_missing = chat_service.mark_presence_offline_on_disconnect(connection, "user-7")
    assert offline_missing is None
    offline_visible = chat_service.mark_presence_offline_on_disconnect(connection, "user-1")
    assert offline_visible is not None
    assert offline_visible["status"] == chat_service.CHAT_PRESENCE_INVISIBLE

    presence_rows = chat_service.get_presence_all(connection)
    assert {row["user_id"] for row in presence_rows} >= {"user-1", "user-2", "user-3"}

    assert chat_service.get_chat_status_response("user-1", "user1@example.test", "enabled")["status"] == "enabled"
    assert chat_service.get_now_timestamp(datetime(2026, 7, 23, 1, 2, 3)) == "7/23/2026, 1:02:03 AM"
    assert chat_service.get_now_timestamp(datetime(2026, 7, 23, 13, 2, 3)) == "7/23/2026, 1:02:03 PM"
    assert chat_service._parse_legacy_timestamp("2026-07-23T12:00:00Z") == datetime(2026, 7, 23, 9, 0)
    assert chat_service._parse_legacy_timestamp("2026-07-23T12:00:00") == datetime(2026, 7, 23, 12, 0)
    sort_key = chat_service._sort_last_message_at(datetime(2026, 7, 23, 12, 0))
    assert sort_key[0] == 0
    assert sort_key[1] < 0
    assert chat_service._sort_last_message_at("bad") == (1, 0.0)
    assert chat_service._resolve_conversation_target(
        current_user_id="user-1",
        sender_user_id="user-1",
        receiver_group_id="group-1",
        receiver_user_id=None,
    ) == {"target_id": "group-1", "target_type": chat_service.CHAT_CONVERSATION_TARGET_GROUP}
    assert chat_service._resolve_conversation_target(
        current_user_id="user-1",
        sender_user_id="user-1",
        receiver_group_id=None,
        receiver_user_id="user-2",
    ) == {"target_id": "user-2", "target_type": chat_service.CHAT_CONVERSATION_TARGET_USER}
    with pytest.raises(chat_service.ChatServiceError):
        chat_service._resolve_conversation_target(
            current_user_id="user-1",
            sender_user_id="user-1",
            receiver_group_id=None,
            receiver_user_id=None,
        )


def test_chat_service_create_message_validation_and_success(chat_db, monkeypatch: pytest.MonkeyPatch) -> None:
    connection, tables = chat_db

    message_ids = iter(["message-created-1", "message-created-2"])
    monkeypatch.setattr(chat_service, "new_id", lambda: next(message_ids))

    with pytest.raises(chat_service.ChatServiceError):
        chat_service.create_message(connection, "user-1", "   ", receiver_group_id="group-1")
    with pytest.raises(chat_service.ChatServiceError):
        chat_service.create_message(connection, "user-1", "X" * (chat_service.CHAT_MESSAGE_MAX_LENGTH + 1), receiver_group_id="group-1")
    with pytest.raises(chat_service.ChatServiceError):
        chat_service.create_message(connection, "user-1", "Olá", receiver_group_id="group-1", receiver_user_id="user-2")
    with pytest.raises(chat_service.ChatServiceError):
        chat_service.create_message(connection, "user-1", "Olá")
    with pytest.raises(chat_service.ChatServiceError):
        chat_service.create_message(connection, "user-1", "Olá", receiver_user_id="user-1")
    with pytest.raises(chat_service.ChatServiceError):
        chat_service.create_message(connection, "user-1", "Olá", receiver_user_id="missing-user")

    created_group = chat_service.create_message(
        connection,
        "user-1",
        "  Mensagem de grupo  ",
        receiver_group_id="group-1",
    )
    created_direct = chat_service.create_message(
        connection,
        "user-1",
        " Mensagem direta ",
        receiver_user_id="user-2",
    )

    assert created_group["id"] == "message-created-1"
    assert created_group["content"] == "Mensagem de grupo"
    assert created_group["receiver_group_id"] == "group-1"
    assert created_direct["id"] == "message-created-2"
    assert created_direct["receiver_user_id"] == "user-2"

    inserted_ids = [
        row[0]
        for row in connection.execute(
            select(tables["chat_message"].c.id).where(
                tables["chat_message"].c.id.in_(["message-created-1", "message-created-2"])
            )
        ).all()
    ]
    assert set(inserted_ids) == {"message-created-1", "message-created-2"}


def test_chat_service_read_and_delete_flows_cover_error_and_update_branches(chat_db) -> None:
    connection, tables = chat_db

    with pytest.raises(chat_service.ChatServiceError):
        chat_service.mark_message_as_read(connection, "user-1", "missing-message")
    with pytest.raises(chat_service.ChatServiceError):
        chat_service.mark_message_as_read(connection, "user-1", "deleted-message-1")
    with pytest.raises(chat_service.ChatServiceError):
        chat_service.mark_message_as_read(connection, "user-1", "group-self-1")
    group_read = chat_service.mark_message_as_read(connection, "user-1", "group-read-1")
    assert group_read["updated_count"] == 0
    with pytest.raises(chat_service.ChatServiceError):
        chat_service.mark_messages_as_read(connection, "user-1", "group-1", "invalid")
    group_batch = chat_service.mark_messages_as_read(
        connection,
        "user-1",
        "group-1",
        chat_service.CHAT_CONVERSATION_TARGET_GROUP,
    )
    assert group_batch["updated_count"] == 1
    group_marked_after_batch = chat_service.mark_message_as_read(connection, "user-1", "group-unread-1")
    assert group_marked_after_batch["updated_count"] == 0

    with pytest.raises(chat_service.ChatServiceError):
        chat_service.mark_message_as_read(connection, "user-2", "direct-inbound-1")
    direct_already = chat_service.mark_message_as_read(connection, "user-1", "direct-read-1")
    assert direct_already["updated_count"] == 0
    direct_marked = chat_service.mark_message_as_read(connection, "user-1", "direct-inbound-1")
    assert direct_marked["updated_count"] == 1
    assert direct_marked["target_type"] == chat_service.CHAT_CONVERSATION_TARGET_USER
    direct_batch = chat_service.mark_messages_as_read(
        connection,
        "user-1",
        "user-2",
        chat_service.CHAT_CONVERSATION_TARGET_USER,
    )
    assert direct_batch["updated_count"] == 0

    with pytest.raises(chat_service.ChatServiceError):
        chat_service.delete_message(connection, "user-2", "group-delete-1")
    with pytest.raises(chat_service.ChatServiceError):
        chat_service.delete_message(connection, "user-1", "direct-old-1")

    group_deleted = chat_service.delete_message(connection, "user-1", "group-delete-1")
    assert group_deleted["target_type"] == chat_service.CHAT_CONVERSATION_TARGET_GROUP
    direct_deleted = chat_service.delete_message(connection, "user-1", "direct-delete-1")
    assert direct_deleted["target_type"] == chat_service.CHAT_CONVERSATION_TARGET_USER
    assert direct_deleted["target_id"] == "user-2"

    deleted_rows = connection.execute(
        select(tables["chat_message"].c.deleted_at, tables["chat_message"].c.content).where(
            tables["chat_message"].c.id.in_(["group-delete-1", "direct-delete-1"])
        )
    ).all()
    assert all(row[0] is not None for row in deleted_rows)
    assert all(row[1] == chat_service.CHAT_MESSAGE_DELETED_LABEL for row in deleted_rows)
