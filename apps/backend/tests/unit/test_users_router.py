from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    MetaData,
    String,
    Table,
    create_engine,
    delete,
    insert,
    select,
)

from silo.api.dependencies import UserGroupInfo
from silo.api.routers import users as users_router


@dataclass(frozen=True, slots=True)
class _UsersIds:
    admin_1: str = "user-admin-1"
    admin_2: str = "user-admin-2"
    member_1: str = "user-member-1"
    member_2: str = "user-member-2"
    dormant_1: str = "user-dormant-1"
    group_admin: str = "group-admin"
    group_users: str = "group-users"
    group_ops: str = "group-ops"


FIXED_NOW = datetime(2026, 8, 3, 12, 0)


def _build_tables() -> dict[str, Table]:
    metadata = MetaData()
    return {
        "user": Table(
            "user",
            metadata,
            Column("id", String, primary_key=True),
            Column("name", String, nullable=False),
            Column("email", String, nullable=False),
            Column("email_verified", Boolean, nullable=False),
            Column("image", String, nullable=True),
            Column("created_at", DateTime, nullable=False),
            Column("updated_at", DateTime, nullable=False),
            Column("is_active", Boolean, nullable=False),
            Column("last_login", DateTime, nullable=True),
        ),
        "group": Table(
            "group",
            metadata,
            Column("id", String, primary_key=True),
            Column("name", String, nullable=False),
            Column("icon", String, nullable=True),
            Column("color", String, nullable=True),
            Column("role", String, nullable=False),
            Column("is_default", Boolean, nullable=False),
            Column("created_at", DateTime, nullable=False),
            Column("updated_at", DateTime, nullable=False),
        ),
        "user_group": Table(
            "user_group",
            metadata,
            Column("id", String, primary_key=True),
            Column("user_id", String, nullable=False),
            Column("group_id", String, nullable=False),
            Column("joined_at", DateTime, nullable=False),
            Column("created_at", DateTime, nullable=False),
        ),
        "account": Table(
            "account",
            metadata,
            Column("id", String, primary_key=True),
            Column("account_id", String, nullable=False),
            Column("provider_id", String, nullable=False),
            Column("user_id", String, nullable=False),
            Column("access_token", String, nullable=True),
            Column("refresh_token", String, nullable=True),
            Column("id_token", String, nullable=True),
            Column("access_token_expires_at", DateTime, nullable=True),
            Column("refresh_token_expires_at", DateTime, nullable=True),
            Column("scope", String, nullable=True),
            Column("password", String, nullable=True),
            Column("created_at", DateTime, nullable=False),
            Column("updated_at", DateTime, nullable=False),
        ),
        "session": Table(
            "session",
            metadata,
            Column("id", String, primary_key=True),
            Column("expires_at", DateTime, nullable=False),
            Column("token", String, nullable=False),
            Column("created_at", DateTime, nullable=False),
            Column("updated_at", DateTime, nullable=False),
            Column("ip_address", String, nullable=True),
            Column("user_agent", String, nullable=True),
            Column("user_id", String, nullable=False),
        ),
        "user_preferences": Table(
            "user_preferences",
            metadata,
            Column("id", String, primary_key=True),
            Column("user_id", String, nullable=False),
            Column("chat_enabled", Boolean, nullable=False),
        ),
        "user_profile": Table(
            "user_profile",
            metadata,
            Column("id", String, primary_key=True),
            Column("user_id", String, nullable=False),
            Column("genre", String, nullable=False),
            Column("phone", String, nullable=False),
            Column("role", String, nullable=False),
            Column("company", String, nullable=False),
            Column("location", String, nullable=False),
            Column("team", String, nullable=False),
        ),
        "verification": Table(
            "verification",
            metadata,
            Column("id", String, primary_key=True),
            Column("identifier", String, nullable=False),
            Column("value", String, nullable=False),
            Column("expires_at", DateTime, nullable=False),
            Column("created_at", DateTime, nullable=False),
            Column("updated_at", DateTime, nullable=False),
        ),
        "chat_message": Table(
            "chat_message",
            metadata,
            Column("id", String, primary_key=True),
            Column("sender_user_id", String, nullable=True),
            Column("receiver_user_id", String, nullable=True),
        ),
        "chat_user_presence": Table(
            "chat_user_presence",
            metadata,
            Column("user_id", String, primary_key=True),
        ),
    }


def _seed_users_data(connection, tables: dict[str, Table]) -> _UsersIds:  # type: ignore[no-untyped-def]
    ids = _UsersIds()

    connection.execute(
        insert(tables["group"]),
        [
            {
                "id": ids.group_admin,
                "name": "Administradores",
                "icon": "shield",
                "color": "#ff0000",
                "role": "admin",
                "is_default": False,
                "created_at": FIXED_NOW,
                "updated_at": FIXED_NOW,
            },
            {
                "id": ids.group_users,
                "name": "Usuários",
                "icon": "users",
                "color": "#00ff00",
                "role": "user",
                "is_default": True,
                "created_at": FIXED_NOW,
                "updated_at": FIXED_NOW,
            },
            {
                "id": ids.group_ops,
                "name": "Operações",
                "icon": "gear",
                "color": "#0000ff",
                "role": "user",
                "is_default": False,
                "created_at": FIXED_NOW,
                "updated_at": FIXED_NOW,
            },
        ],
    )
    connection.execute(
        insert(tables["user"]),
        [
            {
                "id": ids.admin_1,
                "name": "Admin One",
                "email": "admin.one@example.test",
                "email_verified": True,
                "image": "/uploads/avatars/admin-one.png",
                "created_at": FIXED_NOW,
                "updated_at": FIXED_NOW,
                "is_active": True,
                "last_login": FIXED_NOW,
            },
            {
                "id": ids.admin_2,
                "name": "Admin Two",
                "email": "admin.two@example.test",
                "email_verified": True,
                "image": None,
                "created_at": FIXED_NOW,
                "updated_at": FIXED_NOW,
                "is_active": True,
                "last_login": FIXED_NOW,
            },
            {
                "id": ids.member_1,
                "name": "Member One",
                "email": "member.one@example.test",
                "email_verified": False,
                "image": "/uploads/avatars/member-one.png",
                "created_at": FIXED_NOW,
                "updated_at": FIXED_NOW,
                "is_active": True,
                "last_login": None,
            },
            {
                "id": ids.member_2,
                "name": "Member Two",
                "email": "member.two@example.test",
                "email_verified": False,
                "image": None,
                "created_at": FIXED_NOW,
                "updated_at": FIXED_NOW,
                "is_active": False,
                "last_login": None,
            },
            {
                "id": ids.dormant_1,
                "name": "Dormant User",
                "email": "dormant@example.test",
                "email_verified": False,
                "image": "/uploads/avatars/dormant.png",
                "created_at": FIXED_NOW,
                "updated_at": FIXED_NOW,
                "is_active": True,
                "last_login": None,
            },
        ],
    )
    connection.execute(
        insert(tables["user_group"]),
        [
            {
                "id": "user-group-1",
                "user_id": ids.admin_1,
                "group_id": ids.group_admin,
                "joined_at": FIXED_NOW,
                "created_at": FIXED_NOW,
            },
            {
                "id": "user-group-2",
                "user_id": ids.admin_2,
                "group_id": ids.group_admin,
                "joined_at": FIXED_NOW,
                "created_at": FIXED_NOW,
            },
            {
                "id": "user-group-3",
                "user_id": ids.member_1,
                "group_id": ids.group_users,
                "joined_at": FIXED_NOW,
                "created_at": FIXED_NOW,
            },
            {
                "id": "user-group-4",
                "user_id": ids.member_1,
                "group_id": ids.group_ops,
                "joined_at": FIXED_NOW,
                "created_at": FIXED_NOW,
            },
            {
                "id": "user-group-5",
                "user_id": ids.member_2,
                "group_id": ids.group_users,
                "joined_at": FIXED_NOW,
                "created_at": FIXED_NOW,
            },
            {
                "id": "user-group-6",
                "user_id": ids.dormant_1,
                "group_id": ids.group_users,
                "joined_at": FIXED_NOW,
                "created_at": FIXED_NOW,
            },
        ],
    )
    connection.execute(
        insert(tables["account"]),
        [
            {
                "id": "account-1",
                "account_id": ids.admin_1,
                "provider_id": "credential",
                "user_id": ids.admin_1,
                "access_token": None,
                "refresh_token": None,
                "id_token": None,
                "access_token_expires_at": None,
                "refresh_token_expires_at": None,
                "scope": None,
                "password": "hash:admin-pass",
                "created_at": FIXED_NOW,
                "updated_at": FIXED_NOW,
            },
            {
                "id": "account-2",
                "account_id": ids.admin_2,
                "provider_id": "credential",
                "user_id": ids.admin_2,
                "access_token": None,
                "refresh_token": None,
                "id_token": None,
                "access_token_expires_at": None,
                "refresh_token_expires_at": None,
                "scope": None,
                "password": "hash:admin-pass",
                "created_at": FIXED_NOW,
                "updated_at": FIXED_NOW,
            },
            {
                "id": "account-3",
                "account_id": ids.member_1,
                "provider_id": "credential",
                "user_id": ids.member_1,
                "access_token": None,
                "refresh_token": None,
                "id_token": None,
                "access_token_expires_at": None,
                "refresh_token_expires_at": None,
                "scope": None,
                "password": None,
                "created_at": FIXED_NOW,
                "updated_at": FIXED_NOW,
            },
            {
                "id": "account-4",
                "account_id": "google-member-1",
                "provider_id": "google",
                "user_id": ids.member_1,
                "access_token": None,
                "refresh_token": None,
                "id_token": None,
                "access_token_expires_at": None,
                "refresh_token_expires_at": None,
                "scope": None,
                "password": None,
                "created_at": FIXED_NOW,
                "updated_at": FIXED_NOW,
            },
        ],
    )
    connection.execute(
        insert(tables["user_preferences"]),
        [
            {
                "id": "prefs-1",
                "user_id": ids.member_1,
                "chat_enabled": False,
            }
        ],
    )
    connection.execute(
        insert(tables["user_profile"]),
        [
            {
                "id": "profile-1",
                "user_id": ids.member_1,
                "genre": "F",
                "phone": "5511999999999",
                "role": "analyst",
                "company": "Silo",
                "location": "São Paulo",
                "team": "Produto",
            }
        ],
    )
    connection.execute(
        insert(tables["chat_message"]),
        [
            {
                "id": "chat-message-1",
                "sender_user_id": ids.dormant_1,
                "receiver_user_id": ids.member_1,
            }
        ],
    )
    connection.execute(
        insert(tables["chat_user_presence"]),
        [
            {
                "user_id": ids.dormant_1,
            }
        ],
    )
    connection.commit()
    return ids


@pytest.fixture()
def users_connection(tmp_path, monkeypatch):
    engine = create_engine(
        f"sqlite+pysqlite:///{tmp_path / 'users.sqlite3'}",
        future=True,
        connect_args={"check_same_thread": False},
    )
    tables = _build_tables()
    tables["user"].metadata.create_all(engine)
    monkeypatch.setattr(users_router, "legacy_tables", tables)
    monkeypatch.setattr(users_router, "_now_naive", lambda: FIXED_NOW)

    counter = iter(range(1, 10_000))
    monkeypatch.setattr(users_router, "_new_uuid", lambda: f"uuid-{next(counter)}")

    with engine.begin() as connection:
        ids = _seed_users_data(connection, tables)

    connection = engine.connect()
    try:
        yield connection, ids, tables
    finally:
        connection.close()
        engine.dispose()


def _payload(response: object) -> dict[str, object]:
    if isinstance(response, dict):
        return response
    body = getattr(response, "body", None)
    if body is None:
        raise TypeError(f"Unsupported response type: {type(response)!r}")
    return json.loads(body)


@pytest.mark.asyncio
async def test_users_routes_cover_happy_paths(users_connection, monkeypatch) -> None:
    connection, ids, tables = users_connection

    admin_groups = (
        UserGroupInfo(id=ids.group_admin, name="Administradores", role="admin"),
    )
    member_groups = (
        UserGroupInfo(id=ids.group_users, name="Usuários", role="user"),
        UserGroupInfo(id=ids.group_ops, name="Operações", role="user"),
    )
    groups_by_user = {
        ids.admin_1: admin_groups,
        ids.admin_2: admin_groups,
        ids.member_1: member_groups,
        ids.member_2: (UserGroupInfo(id=ids.group_users, name="Usuários", role="user"),),
        ids.dormant_1: (UserGroupInfo(id=ids.group_users, name="Usuários", role="user"),),
    }
    permissions_by_user = {
        ids.admin_1: {"users": {"view", "manage"}, "chat": {"view_private"}},
        ids.admin_2: {"users": {"view", "manage"}, "chat": {"view_private"}},
        ids.member_1: {"users": {"view"}, "chat": {"view_private"}},
        ids.member_2: {"users": {"view"}, "chat": {"view_private"}},
        ids.dormant_1: {"users": {"view"}, "chat": {"view_private"}},
    }
    monkeypatch.setattr(users_router, "get_user_groups", lambda _db, user_id: groups_by_user[user_id])
    monkeypatch.setattr(
        users_router,
        "get_permissions",
        lambda _db, groups: permissions_by_user[
            ids.admin_1 if any(group.role == "admin" for group in groups) else ids.member_1
        ],
    )
    monkeypatch.setattr(
        users_router,
        "is_admin",
        lambda groups: any(group.role == "admin" for group in groups),
    )

    sent_emails: list[tuple[str, str, str]] = []
    monkeypatch.setattr(
        users_router,
        "send_plain_email",
        lambda *, to, subject, text: sent_emails.append((to, subject, text)),
    )

    setup_calls: list[tuple[str, str]] = []

    class _FakeAuthService:
        def __init__(self, *args, **kwargs) -> None:
            del args, kwargs

        def send_forget_password_otp(self, *, email: str, ip_address: str) -> None:
            setup_calls.append((email, ip_address))

    monkeypatch.setattr(users_router, "AuthService", _FakeAuthService)
    monkeypatch.setattr(users_router, "load_settings", lambda: SimpleNamespace())
    monkeypatch.setattr(users_router, "SmtpOtpEmailSender", lambda _settings: object())
    monkeypatch.setattr(users_router, "hash_legacy_bcrypt", lambda password: f"hash:{password}")
    monkeypatch.setattr(users_router.secrets, "randbelow", lambda _limit: 123456)

    deleted_uploads: list[tuple[str, str]] = []
    monkeypatch.setattr(
        users_router,
        "delete_upload_file",
        lambda kind, filename: deleted_uploads.append((kind, filename)),
    )

    class _StoredImage:
        def __init__(self, url: str) -> None:
            self.url = url

    monkeypatch.setattr(
        users_router,
        "store_buffer_as_webp",
        lambda kind, filename, buffer, mode, size: _StoredImage(
            f"/uploads/{kind}/{filename}-stored.webp"
        ),
    )
    monkeypatch.setattr(users_router, "is_multipart_content_type", lambda _value: True)

    async def _fake_read_upload_bytes(*_args, **_kwargs):
        return b"image-bytes"

    async def _fake_parse_multipart_form(_request, max_files=1):
        del max_files
        return {}

    monkeypatch.setattr(users_router, "parse_multipart_form", _fake_parse_multipart_form)
    monkeypatch.setattr(
        users_router,
        "select_upload_from_form",
        lambda _form, _names: SimpleNamespace(filename="avatar.png"),
    )
    monkeypatch.setattr(users_router, "read_upload_bytes", _fake_read_upload_bytes)

    listed = await users_router.list_users(
        search=None,
        status="active",
        groupId=ids.group_users,
        _current_user=object(),
        db=connection,
    )
    assert listed["success"] is True
    assert listed["data"]["total"] == 2
    assert {item["id"] for item in listed["data"]["items"]} == {ids.member_1, ids.dormant_1}
    assert all(item["groupId"] == ids.group_users for item in listed["data"]["items"])
    assert any(item["id"] == ids.member_1 and item["needsPasswordSetup"] is True for item in listed["data"]["items"])

    create_response = await users_router.create_user(
        {
            "name": "New User",
            "email": "new.user@example.test",
            "password": "new-password-123",
            "groupId": ids.group_users,
            "isActive": True,
        },
        SimpleNamespace(client=SimpleNamespace(host="127.0.0.1")),
        object(),
        connection,
    )
    created_user = _payload(create_response)
    assert create_response.status_code == 201
    assert created_user["success"] is True
    created_user_id = created_user["data"]["id"]
    assert (
        connection.execute(
            select(tables["account"].c.password).where(
                tables["account"].c.user_id == created_user_id,
                tables["account"].c.provider_id == "credential",
            )
        ).scalar_one()
        == "hash:new-password-123"
    )

    setup_response = await users_router.create_user(
        {
            "name": "Setup User",
            "email": "setup.user@example.test",
            "groupId": ids.group_users,
        },
        SimpleNamespace(client=SimpleNamespace(host="10.0.0.1")),
        object(),
        connection,
    )
    setup_payload = _payload(setup_response)
    assert setup_response.status_code == 201
    setup_user_id = setup_payload["data"]["id"]
    assert setup_calls == [("setup.user@example.test", "10.0.0.1")]
    assert setup_user_id != created_user_id

    updated = await users_router.update_user(
        {
            "id": created_user_id,
            "name": "New User Updated",
            "email": "new.user.updated@example.test",
            "groupId": ids.group_users,
            "groups": [{"groupId": ids.group_ops}],
            "emailVerified": True,
            "isActive": False,
        },
        object(),
        connection,
    )
    assert updated["success"] is True
    assert updated["data"]["email"] == "new.user.updated@example.test"

    profile_response = await users_router.get_profile(
        SimpleNamespace(id=ids.member_1),
        connection,
    )
    assert profile_response["success"] is True
    assert profile_response["data"]["googleId"] == "google-member-1"
    assert profile_response["data"]["isAdmin"] is False
    assert [group["id"] for group in profile_response["data"]["groups"]] == [
        ids.group_users,
        ids.group_ops,
    ]

    profile_update = await users_router.update_profile(
        {
            "name": "Member One Updated",
            "genre": "M",
            "role": "lead",
            "phone": "5511988887777",
            "company": "Silo",
            "location": "São Paulo",
            "team": "Produto",
        },
        SimpleNamespace(id=ids.member_1),
        connection,
    )
    assert profile_update["success"] is True
    profile_row = connection.execute(
        select(tables["user_profile"].c.genre, tables["user_profile"].c.role).where(
            tables["user_profile"].c.user_id == ids.member_1
        )
    ).mappings().first()
    assert profile_row == {"genre": "M", "role": "lead"}

    prefs_response = await users_router.get_preferences(SimpleNamespace(id=ids.member_1), connection)
    assert prefs_response["data"]["userPreferences"]["chatEnabled"] is False

    prefs_update = await users_router.update_preferences(
        {"chatEnabled": True},
        SimpleNamespace(id=ids.member_1),
        connection,
    )
    assert prefs_update["success"] is True
    assert (
        connection.execute(
            select(tables["user_preferences"].c.chat_enabled).where(
                tables["user_preferences"].c.user_id == ids.member_1
            )
        ).scalar_one()
        is True
    )

    email_update = await users_router.update_email(
        {"email": "member.one.updated@example.test"},
        SimpleNamespace(id=ids.member_1),
        connection,
    )
    assert email_update["success"] is True
    assert ("member.one@example.test", "E-mail alterado para member.one.updated@example.test") in [
        (to, subject) for to, subject, _ in sent_emails
    ]
    assert ("member.one.updated@example.test", "E-mail alterado para member.one.updated@example.test") in [
        (to, subject) for to, subject, _ in sent_emails
    ]

    request_email_change = await users_router.request_email_change(
        {"email": "member.one.pending@example.test"},
        SimpleNamespace(id=ids.member_1),
        connection,
    )
    assert request_email_change["success"] is True
    verification_row = connection.execute(
        select(tables["verification"].c.value).where(
            tables["verification"].c.identifier
            == f"email-change-otp-{ids.member_1}-member.one.pending@example.test"
        )
    ).scalar_one()
    otp_code = verification_row.split(":", maxsplit=1)[0]
    confirm_email = await users_router.confirm_email_change(
        {"newEmail": "member.one.pending@example.test", "code": otp_code},
        SimpleNamespace(id=ids.member_1),
        connection,
    )
    assert confirm_email["success"] is True

    password_change = await users_router.change_password(
        {"password": "super-secret-123"},
        SimpleNamespace(id=ids.admin_1),
        connection,
    )
    assert password_change["success"] is True
    assert any(call[0] == "admin.one@example.test" for call in sent_emails)

    image_url_update = await users_router.update_profile_image_url(
        {"imageUrl": "/uploads/avatars/member-new.webp"},
        SimpleNamespace(id=ids.member_1),
        connection,
    )
    assert image_url_update["success"] is True
    assert (
        connection.execute(
            select(tables["user"].c.image).where(tables["user"].c.id == ids.member_1)
        ).scalar_one()
        == "/uploads/avatars/member-new.webp"
    )

    uploaded = await users_router.upload_profile_image(
        SimpleNamespace(
            headers={"content-type": "multipart/form-data"},
            client=SimpleNamespace(host="127.0.0.1"),
        ),
        SimpleNamespace(id=ids.member_1),
        connection,
    )
    assert uploaded["success"] is True
    assert uploaded["data"]["imageUrl"].endswith("-stored.webp")
    assert ("avatars", "member-new.webp") in deleted_uploads

    resend = await users_router.resend_password_setup(
        ids.member_2,
        SimpleNamespace(client=SimpleNamespace(host="10.0.0.2")),
        object(),
        connection,
    )
    assert resend["success"] is True
    assert setup_calls[-1] == ("member.two@example.test", "10.0.0.2")

    delete_result = await users_router.delete_user(ids.dormant_1, object(), connection)
    assert delete_result["success"] is True
    assert (
        connection.execute(
            select(tables["user"].c.id).where(tables["user"].c.id == ids.dormant_1)
        ).first()
        is None
    )

    connection.execute(delete(tables["user_group"]).where(tables["user_group"].c.user_id == ids.admin_2))
    connection.commit()
    last_admin_failure = _payload(await users_router.delete_user(ids.admin_1, object(), connection))
    assert last_admin_failure["success"] is False


@pytest.mark.asyncio
async def test_users_routes_cover_validation_and_conflict_paths(users_connection, monkeypatch) -> None:
    connection, ids, _tables = users_connection

    sent_emails: list[tuple[str, str, str]] = []
    monkeypatch.setattr(
        users_router,
        "send_plain_email",
        lambda *, to, subject, text: sent_emails.append((to, subject, text)),
    )

    invalid_create = _payload(
        await users_router.create_user(
            {
                "name": "Missing Groups",
                "email": "missing.groups@example.test",
            },
            SimpleNamespace(client=SimpleNamespace(host="127.0.0.1")),
            object(),
            connection,
        )
    )
    assert invalid_create["success"] is False
    assert invalid_create["field"] == "groups"

    duplicate_create = _payload(
        await users_router.create_user(
            {
                "name": "Duplicate Email",
                "email": "admin.one@example.test",
                "groupId": ids.group_users,
            },
            SimpleNamespace(client=SimpleNamespace(host="127.0.0.1")),
            object(),
            connection,
        )
    )
    assert duplicate_create["success"] is False
    assert duplicate_create["field"] == "email"

    invalid_update = _payload(await users_router.update_user({"id": ids.member_1}, object(), connection))
    assert invalid_update["success"] is False

    delete_missing = _payload(await users_router.delete_user(None, object(), connection))
    assert delete_missing["success"] is False

    resend_password = _payload(
        await users_router.resend_password_setup(
            ids.admin_1,
            SimpleNamespace(client=SimpleNamespace(host="127.0.0.1")),
            object(),
            connection,
        )
    )
    assert resend_password["success"] is False

    missing_profile = _payload(await users_router.get_profile(SimpleNamespace(id="missing-user"), connection))
    assert missing_profile["success"] is False

    invalid_profile_update = _payload(
        await users_router.update_profile(
            {"name": "Only Name"},
            SimpleNamespace(id=ids.member_1),
            connection,
        )
    )
    assert invalid_profile_update["success"] is False

    invalid_upload = _payload(
        await users_router.upload_profile_image(
            SimpleNamespace(headers={"content-type": "application/json"}, client=SimpleNamespace(host="127.0.0.1")),
            SimpleNamespace(id=ids.member_1),
            connection,
        )
    )
    assert invalid_upload["success"] is False

    invalid_preferences = _payload(
        await users_router.update_preferences(
            {"chatEnabled": "yes"},
            SimpleNamespace(id=ids.member_1),
            connection,
        )
    )
    assert invalid_preferences["success"] is False

    same_email = _payload(
        await users_router.update_email(
            {"email": "member.one@example.test"},
            SimpleNamespace(id=ids.member_1),
            connection,
        )
    )
    assert same_email["success"] is False

    request_same_email = _payload(
        await users_router.request_email_change(
            {"email": "member.one@example.test"},
            SimpleNamespace(id=ids.member_1),
            connection,
        )
    )
    assert request_same_email["success"] is False

    requested = _payload(
        await users_router.request_email_change(
            {"email": "member.one.pending@example.test"},
            SimpleNamespace(id=ids.member_1),
            connection,
        )
    )
    assert requested["success"] is True

    invalid_confirm = _payload(
        await users_router.confirm_email_change(
            {"newEmail": "member.one.pending@example.test", "code": "000000"},
            SimpleNamespace(id=ids.member_1),
            connection,
        )
    )
    assert invalid_confirm["success"] is False

    invalid_password = _payload(
        await users_router.change_password(
            {"password": "short"},
            SimpleNamespace(id=ids.member_1),
            connection,
        )
    )
    assert invalid_password["success"] is False

    missing_image_url = _payload(
        await users_router.update_profile_image_url(
            {},
            SimpleNamespace(id=ids.member_1),
            connection,
        )
    )
    assert missing_image_url["success"] is False

    assert sent_emails  # request_email_change should have emitted at least one email


@pytest.mark.asyncio
async def test_users_router_helpers_cover_profile_email_password_and_upload_branches(
    users_connection,
    monkeypatch,
) -> None:
    connection, ids, tables = users_connection

    deleted_uploads: list[tuple[str, str]] = []
    sent_emails: list[tuple[str, str, str]] = []

    monkeypatch.setattr(
        users_router,
        "delete_upload_file",
        lambda kind, filename: deleted_uploads.append((kind, filename)),
    )
    monkeypatch.setattr(users_router, "is_upload_kind", lambda kind: kind == "avatars")
    monkeypatch.setattr(users_router, "is_safe_filename", lambda filename: filename != "bad.webp")
    monkeypatch.setattr(
        users_router,
        "send_plain_email",
        lambda *, to, subject, text: sent_emails.append((to, subject, text)),
    )
    monkeypatch.setattr(
        users_router,
        "get_user_groups",
        lambda _db, user_id: (
            UserGroupInfo(id=ids.group_users, name="Usuários", role="user"),
            UserGroupInfo(id=ids.group_ops, name="Operações", role="user"),
        )
        if user_id == ids.member_1
        else (UserGroupInfo(id=ids.group_admin, name="Administradores", role="admin"),),
    )
    monkeypatch.setattr(
        users_router,
        "get_permissions",
        lambda _db, groups: {"users": {"view"}, "chat": {"view_private"}} if groups else {},
    )
    monkeypatch.setattr(users_router, "is_admin", lambda groups: any(group.role == "admin" for group in groups))
    monkeypatch.setattr(users_router, "hash_legacy_bcrypt", lambda password: f"hash:{password}")

    class _StoredImage:
        def __init__(self, url: str) -> None:
            self.url = url

    monkeypatch.setattr(
        users_router,
        "store_buffer_as_webp",
        lambda kind, filename, buffer, mode, size: _StoredImage(
            f"/uploads/{kind}/{filename}-stored.webp"
        ),
    )

    assert users_router._extract_group_ids(  # noqa: SLF001
        {
            "groupId": ids.group_admin,
            "groups": [{"groupId": ids.group_users}, {"groupId": ids.group_ops}, {"groupId": ids.group_users}],
        }
    ) == [ids.group_admin, ids.group_users, ids.group_ops]
    assert users_router._normalize_email("  MEMBER.ONE@EXAMPLE.TEST  ") == "member.one@example.test"  # noqa: SLF001
    assert users_router._normalize_email(123) is None  # noqa: SLF001
    assert users_router._require_text("  texto  ") == "texto"  # noqa: SLF001
    assert users_router._require_text("   ") is None  # noqa: SLF001
    assert users_router._optional_str("texto") == "texto"  # noqa: SLF001
    assert users_router._optional_str(123) is None  # noqa: SLF001
    assert users_router._request_ip(SimpleNamespace(client=SimpleNamespace(host="10.0.0.1"))) == "10.0.0.1"  # noqa: SLF001
    assert users_router._request_ip(SimpleNamespace(client=None)) == "127.0.0.1"  # noqa: SLF001
    assert users_router._new_uuid().startswith("uuid-")  # noqa: SLF001
    assert users_router._now_naive() == FIXED_NOW  # noqa: SLF001

    users_router._delete_profile_image("/uploads/avatars/member-one.webp?download=1#fragment")  # noqa: SLF001
    users_router._delete_profile_image("/uploads/avatars/bad.webp")  # noqa: SLF001
    users_router._delete_profile_image("https://example.test/avatars/member-one.webp")  # noqa: SLF001
    assert deleted_uploads == [("avatars", "member-one.webp")]

    profile = users_router._get_current_user_profile(connection, ids.member_1)  # noqa: SLF001
    assert profile["ok"] is True
    assert profile["data"]["googleId"] == "google-member-1"

    missing_profile = users_router._get_current_user_profile(connection, "missing-user")  # noqa: SLF001
    assert missing_profile["ok"] is False

    profile_payload = {
        "name": "Member Two",
        "genre": "M",
        "role": "analyst",
        "phone": "5511988888888",
        "company": "Silo",
        "location": "São Paulo",
        "team": "Produto",
    }
    profile_insert = users_router._update_current_user_profile(connection, ids.member_2, profile_payload)  # noqa: SLF001
    assert profile_insert["ok"] is True
    profile_update = users_router._update_current_user_profile(connection, ids.member_1, profile_payload)  # noqa: SLF001
    assert profile_update["ok"] is True

    prefs_insert = users_router._update_current_user_preferences(connection, ids.member_2, True)  # noqa: SLF001
    assert prefs_insert["ok"] is True
    prefs_update = users_router._update_current_user_preferences(connection, ids.member_2, False)  # noqa: SLF001
    assert prefs_update["ok"] is True

    missing_email_update = users_router._update_current_user_email(connection, "missing-user", "missing@example.test")  # noqa: SLF001
    assert missing_email_update["ok"] is False
    same_email_update = users_router._update_current_user_email(connection, ids.member_1, "member.one@example.test")  # noqa: SLF001
    assert same_email_update["ok"] is False
    conflict_email_update = users_router._update_current_user_email(connection, ids.member_1, "admin.one@example.test")  # noqa: SLF001
    assert conflict_email_update["ok"] is False
    updated_email = users_router._update_current_user_email(connection, ids.dormant_1, "dormant.updated@example.test")  # noqa: SLF001
    assert updated_email["ok"] is True

    same_change_request = users_router._request_current_user_email_change(  # noqa: SLF001
        connection,
        ids.member_1,
        "member.one@example.test",
    )
    assert same_change_request["ok"] is False

    conflict_change_request = users_router._request_current_user_email_change(  # noqa: SLF001
        connection,
        ids.member_1,
        "admin.one@example.test",
    )
    assert conflict_change_request["ok"] is False

    monkeypatch.setattr(
        users_router,
        "send_plain_email",
        lambda *, to, subject, text: (
            (_ for _ in ()).throw(RuntimeError("smtp down"))
            if to == "member.one.pending@example.test"
            else sent_emails.append((to, subject, text))
        ),
    )
    failed_change_request = users_router._request_current_user_email_change(  # noqa: SLF001
        connection,
        ids.member_1,
        "member.one.pending@example.test",
    )
    assert failed_change_request["ok"] is False
    verification_table = tables["verification"]
    assert (
        connection.execute(
            select(verification_table.c.id).where(
                verification_table.c.identifier == f"email-change-otp-{ids.member_1}-member.one.pending@example.test"
            )
        ).first()
        is None
    )

    verification_table = tables["verification"]
    connection.execute(
        insert(verification_table).values(
            id="verification-expired",
            identifier=f"email-change-otp-{ids.member_1}-member.one.confirm@example.test",
            value="123456:0",
            expires_at=FIXED_NOW.replace(year=2025),
            created_at=FIXED_NOW,
            updated_at=FIXED_NOW,
        )
    )
    expired_confirmation = users_router._confirm_current_user_email_change(  # noqa: SLF001
        connection,
        ids.member_1,
        "member.one.confirm@example.test",
        "123456",
    )
    assert expired_confirmation["ok"] is False

    connection.execute(delete(verification_table))
    connection.execute(
        insert(verification_table).values(
            id="verification-conflict",
            identifier=f"email-change-otp-{ids.member_1}-admin.one@example.test",
            value="654321:0",
            expires_at=FIXED_NOW.replace(year=2027),
            created_at=FIXED_NOW,
            updated_at=FIXED_NOW,
        )
    )
    conflict_confirmation = users_router._confirm_current_user_email_change(  # noqa: SLF001
        connection,
        ids.member_1,
        "admin.one@example.test",
        "654321",
    )
    assert conflict_confirmation["ok"] is False

    connection.execute(delete(verification_table))
    connection.execute(
        insert(verification_table).values(
            id="verification-success",
            identifier=f"email-change-otp-{ids.member_1}-member.one.confirmed@example.test",
            value="777777:0",
            expires_at=FIXED_NOW.replace(year=2027),
            created_at=FIXED_NOW,
            updated_at=FIXED_NOW,
        )
    )
    confirmed = users_router._confirm_current_user_email_change(  # noqa: SLF001
        connection,
        ids.member_1,
        "member.one.confirmed@example.test",
        "777777",
    )
    assert confirmed["ok"] is True

    missing_password = users_router._update_current_user_password(connection, "missing-user", "new-password")  # noqa: SLF001
    assert missing_password["ok"] is False
    password_insert = users_router._update_current_user_password(connection, ids.member_2, "new-password")  # noqa: SLF001
    assert password_insert["ok"] is True
    password_update = users_router._update_current_user_password(connection, ids.admin_1, "updated-password")  # noqa: SLF001
    assert password_update["ok"] is True

    missing_image_url = users_router._update_current_user_profile_image_url(connection, "missing-user", "/uploads/avatars/member.webp")  # noqa: SLF001
    assert missing_image_url["ok"] is False
    image_url_update = users_router._update_current_user_profile_image_url(connection, ids.member_1, "/uploads/avatars/member.webp")  # noqa: SLF001
    assert image_url_update["ok"] is True

    class _UploadRequest:
        def __init__(self) -> None:
            self.headers = {"content-type": "multipart/form-data"}
            self.client = SimpleNamespace(host="127.0.0.1")

    async def _upload_error_request(*_args, **_kwargs):
        raise RuntimeError("multipart error")

    monkeypatch.setattr(users_router, "parse_multipart_form", _upload_error_request)
    upload_error = _payload(
        await users_router.upload_profile_image(
            _UploadRequest(),
            SimpleNamespace(id=ids.member_1),
            connection,
        )
    )
    assert upload_error["success"] is False

    async def _upload_form_ok(*_args, **_kwargs):
        return {"fileToUpload": None}

    monkeypatch.setattr(users_router, "parse_multipart_form", _upload_form_ok)
    monkeypatch.setattr(users_router, "select_upload_from_form", lambda _form, _names: None)
    upload_missing_file = _payload(
        await users_router.upload_profile_image(
            _UploadRequest(),
            SimpleNamespace(id=ids.member_1),
            connection,
        )
    )
    assert upload_missing_file["success"] is False

    monkeypatch.setattr(users_router, "select_upload_from_form", lambda _form, _names: SimpleNamespace(filename="member.webp"))
    async def _read_upload_bytes_none(_file, max_bytes):
        return None

    monkeypatch.setattr(users_router, "read_upload_bytes", _read_upload_bytes_none)
    upload_too_large = _payload(
        await users_router.upload_profile_image(
            _UploadRequest(),
            SimpleNamespace(id=ids.member_1),
            connection,
        )
    )
    assert upload_too_large["success"] is False

    async def _upload_profile_error(*_args, **_kwargs):
        return users_router.service_failure("Falha ao salvar imagem", 500)

    async def _read_upload_bytes_ok(_file, max_bytes):
        return b"bytes"

    monkeypatch.setattr(users_router, "read_upload_bytes", _read_upload_bytes_ok)
    monkeypatch.setattr(users_router, "_update_current_user_profile_image", _upload_profile_error)
    upload_service_error = _payload(
        await users_router.upload_profile_image(
            _UploadRequest(),
            SimpleNamespace(id=ids.member_1),
            connection,
        )
    )
    assert upload_service_error["success"] is False

    assert sent_emails


@pytest.mark.asyncio
async def test_users_router_routes_cover_service_error_wrappers_and_filters(
    users_connection,
    monkeypatch,
) -> None:
    connection, ids, _tables = users_connection

    failing_result = users_router.service_failure("erro", 500)
    current_user = SimpleNamespace(id=ids.member_1)

    route_cases = [
        ("_update_current_user_preferences", users_router.update_preferences, {"chatEnabled": True}),
        ("_update_current_user_email", users_router.update_email, {"email": "member.one.updated@example.test"}),
        (
            "_request_current_user_email_change",
            users_router.request_email_change,
            {"email": "member.one.pending@example.test"},
        ),
        (
            "_confirm_current_user_email_change",
            users_router.confirm_email_change,
            {"newEmail": "member.one.confirm@example.test", "code": "123456"},
        ),
        ("_update_current_user_password", users_router.change_password, {"password": "new-password-123"}),
        (
            "_update_current_user_profile_image_url",
            users_router.update_profile_image_url,
            {"imageUrl": "/uploads/avatars/member-one.webp"},
        ),
    ]

    for helper_name, route, payload in route_cases:
        monkeypatch.setattr(users_router, helper_name, lambda *args, **kwargs: failing_result)
        response = await route(payload, current_user, connection)
        assert _payload(response)["success"] is False

    inactive_users = users_router._list_users(connection, search="Member", status="inactive", group_id=None)  # noqa: SLF001
    assert [item["id"] for item in inactive_users["items"]] == [ids.member_2]

    no_match_users = users_router._list_users(connection, search="Does not exist", status="active", group_id=None)  # noqa: SLF001
    assert no_match_users == {"items": [], "total": 0}

    empty_group_users = users_router._list_users(connection, search=None, status=None, group_id="missing-group")  # noqa: SLF001
    assert empty_group_users == {"items": [], "total": 0}
