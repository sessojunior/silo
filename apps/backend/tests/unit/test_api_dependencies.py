from __future__ import annotations

from types import SimpleNamespace

import pytest
from sqlalchemy import Boolean, Column, DateTime, MetaData, String, Table, create_engine, insert

import silo.api.dependencies as dependencies_module
from silo.api.dependencies import (
    CurrentUser,
    UserGroupInfo,
    canonicalize_action,
    canonicalize_requested_action,
    get_chat_enabled,
    get_chat_access_state,
    get_current_user,
    get_permissions,
    get_user_groups,
    has_chat_permission,
    has_permission,
    is_admin,
    require_admin,
    require_chat_access,
    require_permission,
)
from silo.api.errors import ForbiddenError, UnauthenticatedError


def _build_dependency_tables(engine):
    metadata = MetaData()
    group_table = Table(
        "group",
        metadata,
        Column("id", String, primary_key=True),
        Column("name", String, nullable=False),
        Column("role", String, nullable=False),
        Column("is_default", Boolean, nullable=False, default=False),
        Column("created_at", DateTime, nullable=True),
        Column("updated_at", DateTime, nullable=True),
    )
    user_group_table = Table(
        "user_group",
        metadata,
        Column("id", String, primary_key=True),
        Column("user_id", String, nullable=False),
        Column("group_id", String, nullable=False),
        Column("joined_at", DateTime, nullable=True),
        Column("created_at", DateTime, nullable=True),
    )
    group_permissions_table = Table(
        "group_permissions",
        metadata,
        Column("id", String, primary_key=True),
        Column("group_id", String, nullable=False),
        Column("resource", String, nullable=False),
        Column("action", String, nullable=False),
        Column("created_at", DateTime, nullable=True),
        Column("updated_at", DateTime, nullable=True),
    )
    user_preferences_table = Table(
        "user_preferences",
        metadata,
        Column("id", String, primary_key=True),
        Column("user_id", String, nullable=False),
        Column("chat_enabled", Boolean, nullable=False),
    )
    metadata.create_all(engine)
    return {
        "group": group_table,
        "user_group": user_group_table,
        "group_permissions": group_permissions_table,
        "user_preferences": user_preferences_table,
    }


def test_permission_action_canonicalization_matches_node_rules() -> None:
    assert canonicalize_action("products", "read") == "view"
    assert canonicalize_action("products", "view_details") == "view"
    assert canonicalize_action("products", "delete") == "manage"
    assert canonicalize_action("products", "approve_item") == "manage"
    assert canonicalize_action("products", "unknown") == "manage"
    assert canonicalize_action("chat", "view_private") == "view_private"


def test_requested_permission_action_canonicalization_matches_node_rules() -> None:
    assert canonicalize_requested_action("products", "list") == "view"
    assert canonicalize_requested_action("products", "edit") == "manage"
    assert canonicalize_requested_action("chat", "view_group") == "view_group"


def test_admin_and_permission_checks_match_legacy_semantics() -> None:
    assert is_admin((UserGroupInfo(id="g-admin", name="Admin", role="admin"),))
    assert not is_admin((UserGroupInfo(id="g-user", name="User", role="user"),))

    permissions = {"products": {"manage"}, "contacts": {"view"}, "chat": {"view_private"}}
    assert has_permission(permissions, "products", "manage")
    assert has_permission(permissions, "products", "view")
    assert has_permission(permissions, "contacts", "view")
    assert not has_permission(permissions, "contacts", "manage")
    assert has_chat_permission(permissions)
    assert not has_chat_permission({"chat": {"manage"}})


def test_get_current_user_prefers_active_user_from_request_state() -> None:
    request = SimpleNamespace(
        state=SimpleNamespace(
            current_user={
                "id": "user-1",
                "email": "user@example.test",
                "name": "User One",
                "is_active": True,
            },
            current_user_id=None,
        )
    )

    current_user = get_current_user(request, object())

    assert current_user == CurrentUser(
        id="user-1",
        email="user@example.test",
        name="User One",
        is_active=True,
    )
    assert request.state.current_user_id == "user-1"


def test_get_current_user_falls_back_to_session_token_lookup(monkeypatch: pytest.MonkeyPatch) -> None:
    request = SimpleNamespace(state=SimpleNamespace(current_user=None, current_user_id=None))
    session = SimpleNamespace(
        user_id="user-2",
        user_email="user2@example.test",
        user_name="User Two",
    )
    monkeypatch.setattr(dependencies_module, "extract_session_token", lambda _request: "token-1")
    monkeypatch.setattr(dependencies_module, "get_session_by_token", lambda _db, _token: session)

    current_user = get_current_user(request, object())

    assert current_user.id == "user-2"
    assert current_user.email == "user2@example.test"
    assert request.state.current_user_id == "user-2"


def test_get_current_user_raises_when_request_is_unauthenticated(monkeypatch: pytest.MonkeyPatch) -> None:
    request = SimpleNamespace(state=SimpleNamespace(current_user=None, current_user_id=None))
    monkeypatch.setattr(dependencies_module, "extract_session_token", lambda _request: None)

    with pytest.raises(UnauthenticatedError):
        get_current_user(request, object())


def test_permission_dependencies_follow_database_state(monkeypatch: pytest.MonkeyPatch) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    tables = _build_dependency_tables(engine)
    monkeypatch.setattr(dependencies_module, "legacy_tables", tables)

    with engine.begin() as connection:
        connection.execute(
            insert(tables["group"]),
            [
                {
                    "id": "group-admin",
                    "name": "Administradores",
                    "role": "admin",
                    "is_default": True,
                },
                {
                    "id": "group-editor",
                    "name": "Editores",
                    "role": "user",
                    "is_default": False,
                },
            ],
        )
        connection.execute(
            insert(tables["user_group"]),
            [
                {
                    "id": "ug-1",
                    "user_id": "user-admin",
                    "group_id": "group-admin",
                },
                {
                    "id": "ug-2",
                    "user_id": "user-editor",
                    "group_id": "group-editor",
                },
            ],
        )
        connection.execute(
            insert(tables["group_permissions"]),
            [
                {
                    "id": "perm-1",
                    "group_id": "group-editor",
                    "resource": "projects",
                    "action": "edit",
                },
                {
                    "id": "perm-2",
                    "group_id": "group-editor",
                    "resource": "chat",
                    "action": "view_private",
                },
                {
                    "id": "perm-3",
                    "group_id": "group-editor",
                    "resource": "users",
                    "action": "manage",
                },
            ],
        )
        connection.execute(
            insert(tables["user_preferences"]),
            [
                {"id": "pref-1", "user_id": "user-admin", "chat_enabled": True},
                {"id": "pref-2", "user_id": "user-editor", "chat_enabled": False},
            ],
        )

        admin_groups = get_user_groups(connection, "user-admin")
        editor_groups = get_user_groups(connection, "user-editor")
        admin_permissions = get_permissions(connection, admin_groups)
        editor_permissions = get_permissions(connection, editor_groups)

        assert admin_groups == (UserGroupInfo(id="group-admin", name="Administradores", role="admin"),)
        assert editor_groups == (
            UserGroupInfo(id="group-editor", name="Editores", role="user"),
        )
        assert admin_permissions == {}
        assert editor_permissions["projects"] == {"manage"}
        assert editor_permissions["chat"] == {"view_private"}
        assert editor_permissions["users"] == {"manage"}

        admin_state = get_chat_access_state(connection, "user-admin")
        editor_state = get_chat_access_state(connection, "user-editor")

        assert admin_state.chat_enabled is True
        assert admin_state.can_view_chat is True
        assert editor_state.chat_enabled is False
        assert editor_state.can_view_chat is False

        assert require_admin(
            current_user=CurrentUser(id="user-admin"),
            db=connection,
        ).id == "user-admin"

        with pytest.raises(ForbiddenError):
            require_admin(
                current_user=CurrentUser(id="user-editor"),
                db=connection,
            )

        assert require_permission("projects", "manage")(
            current_user=CurrentUser(id="user-editor"),
            db=connection,
        ).id == "user-editor"

        with pytest.raises(ForbiddenError):
            require_permission("contacts", "manage")(
                current_user=CurrentUser(id="user-editor"),
                db=connection,
            )

        with pytest.raises(ForbiddenError):
            require_chat_access(
                current_user=CurrentUser(id="user-editor"),
                db=connection,
            )


def test_permission_helpers_handle_empty_groups_and_state_variants(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    tables = _build_dependency_tables(engine)
    monkeypatch.setattr(dependencies_module, "legacy_tables", tables)

    with engine.begin() as connection:
        connection.execute(
            insert(tables["user_preferences"]),
            [
                {"id": "pref-1", "user_id": "user-chat", "chat_enabled": True},
                {"id": "pref-2", "user_id": "user-no-chat", "chat_enabled": False},
            ],
        )

        assert get_permissions(connection, ()) == {}
        assert get_chat_enabled(connection, "user-chat") is True
        assert get_chat_enabled(connection, "user-no-chat") is False
        assert get_chat_access_state(connection, "user-chat").can_view_chat is False
        assert get_chat_access_state(connection, "user-no-chat").can_view_chat is False


def test_permission_helpers_allow_chat_when_admin_or_explicit_permission(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    tables = _build_dependency_tables(engine)
    monkeypatch.setattr(dependencies_module, "legacy_tables", tables)

    with engine.begin() as connection:
        connection.execute(
            insert(tables["group"]),
            [
                {
                    "id": "group-admin",
                    "name": "Admins",
                    "role": "admin",
                    "is_default": True,
                },
                {
                    "id": "group-editor",
                    "name": "Editors",
                    "role": "user",
                    "is_default": False,
                },
            ],
        )
        connection.execute(
            insert(tables["user_group"]),
            [
                {"id": "ug-1", "user_id": "user-admin", "group_id": "group-admin"},
                {"id": "ug-2", "user_id": "user-editor", "group_id": "group-editor"},
            ],
        )
        connection.execute(
            insert(tables["group_permissions"]),
            [
                {
                    "id": "perm-1",
                    "group_id": "group-editor",
                    "resource": "chat",
                    "action": "view_private",
                },
                {
                    "id": "perm-2",
                    "group_id": "group-editor",
                    "resource": "products",
                    "action": "manage",
                },
            ],
        )
        connection.execute(
            insert(tables["user_preferences"]),
            [
                {"id": "pref-1", "user_id": "user-admin", "chat_enabled": True},
                {"id": "pref-2", "user_id": "user-editor", "chat_enabled": True},
            ],
        )

        admin_state = get_chat_access_state(connection, "user-admin")
        editor_state = get_chat_access_state(connection, "user-editor")

        assert admin_state.can_view_chat is True
        assert editor_state.can_view_chat is True
        assert require_chat_access(
            current_user=CurrentUser(id="user-editor"),
            db=connection,
        ).id == "user-editor"
        assert require_permission("products", "list")(
            current_user=CurrentUser(id="user-editor"),
            db=connection,
        ).id == "user-editor"


def test_snapshot_db_and_engine_cache_paths(monkeypatch: pytest.MonkeyPatch) -> None:
    executed: list[str] = []
    rollback_called = False

    class _FakeTransaction:
        def rollback(self) -> None:
            nonlocal rollback_called
            rollback_called = True

    class _FakeConnection:
        closed = False

        def __init__(self) -> None:
            self.transaction = _FakeTransaction()

        def begin(self) -> _FakeTransaction:
            return self.transaction

        def execute(self, statement):
            executed.append(str(statement))
            return self

        def __enter__(self) -> _FakeConnection:
            return self

        def __exit__(self, exc_type, exc, tb) -> bool:
            return False

    class _FakeEngine:
        def __init__(self) -> None:
            self.connection = _FakeConnection()

        def connect(self) -> _FakeConnection:
            return self.connection

    request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(db_engine=_FakeEngine())))

    generator = dependencies_module.get_snapshot_db(request)
    connection = next(generator)
    assert connection is request.app.state.db_engine.connection
    assert any("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY" in item for item in executed)
    assert any("SET LOCAL statement_timeout = '5000ms'" in item for item in executed)
    generator.close()
    assert rollback_called is True

    created_urls: list[str] = []
    cached_engine = object()

    class _Settings:
        def __init__(self) -> None:
            self.database_url = SimpleNamespace(get_secret_value=lambda: "postgresql://test")

    monkeypatch.setattr(dependencies_module, "load_settings", lambda: _Settings())
    monkeypatch.setattr(
        dependencies_module,
        "create_engine",
        lambda url, pool_pre_ping=True: created_urls.append(url) or cached_engine,
    )

    cached_request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace()))
    assert dependencies_module._get_engine(cached_request) is cached_engine
    assert created_urls
    assert cached_request.app.state.db_engine is cached_engine
    assert dependencies_module._get_engine(cached_request) is cached_engine


def test_current_user_state_parser_handles_invalid_values() -> None:
    assert dependencies_module._current_user_from_state(None) is None
    assert dependencies_module._current_user_from_state({"id": 1}) is None
    assert dependencies_module._current_user_from_state({"email": "x"}) is None
    user = dependencies_module._current_user_from_state(
        {
            "id": "user-1",
            "email": "user@example.test",
            "name": "User One",
            "isActive": False,
        }
    )
    assert user is not None
    assert user.is_active is False
