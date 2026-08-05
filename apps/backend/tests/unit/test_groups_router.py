from __future__ import annotations

import json
from datetime import datetime

import pytest
from fastapi.responses import JSONResponse
from sqlalchemy import Boolean, Column, DateTime, MetaData, String, Table, create_engine, insert, select

from silo.api.routers import groups as groups_router
from silo.services.common import service_failure


FIXED_NOW = datetime(2026, 8, 4, 12, 0)


def _build_tables() -> dict[str, Table]:
    metadata = MetaData()
    return {
        "group": Table(
            "group",
            metadata,
            Column("id", String, primary_key=True),
            Column("name", String, nullable=False),
            Column("description", String, nullable=True),
            Column("icon", String, nullable=True),
            Column("color", String, nullable=True),
            Column("role", String, nullable=False),
            Column("active", Boolean, nullable=False),
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
        "group_permissions": Table(
            "group_permissions",
            metadata,
            Column("id", String, primary_key=True),
            Column("group_id", String, nullable=False),
            Column("resource", String, nullable=False),
            Column("action", String, nullable=False),
            Column("created_at", DateTime, nullable=False),
            Column("updated_at", DateTime, nullable=False),
        ),
        "chat_message": Table(
            "chat_message",
            metadata,
            Column("id", String, primary_key=True),
            Column("receiver_group_id", String, nullable=True),
        ),
    }


def _payload(response):
    if isinstance(response, JSONResponse):
        return json.loads(response.body)
    return response


def _seed_group_data(connection, tables: dict[str, Table]) -> None:  # type: ignore[no-untyped-def]
    connection.execute(
        insert(tables["group"]),
        [
            {
                "id": "group-admin",
                "name": "Administradores",
                "description": "Administradores do sistema",
                "icon": "shield",
                "color": "#ef4444",
                "role": "admin",
                "active": True,
                "is_default": False,
                "created_at": FIXED_NOW,
                "updated_at": FIXED_NOW,
            },
            {
                "id": "group-default",
                "name": "Visitantes",
                "description": "Grupo padrão",
                "icon": "users",
                "color": "#64748B",
                "role": "user",
                "active": True,
                "is_default": True,
                "created_at": FIXED_NOW,
                "updated_at": FIXED_NOW,
            },
            {
                "id": "group-support",
                "name": "Suporte",
                "description": "Equipe de suporte",
                "icon": "headphones",
                "color": "#0ea5e9",
                "role": "user",
                "active": True,
                "is_default": False,
                "created_at": FIXED_NOW,
                "updated_at": FIXED_NOW,
            },
        ],
    )
    connection.execute(
        insert(tables["group_permissions"]),
        [
            {
                "id": "perm-support-1",
                "group_id": "group-support",
                "resource": "products",
                "action": "view",
                "created_at": FIXED_NOW,
                "updated_at": FIXED_NOW,
            }
        ],
    )
    connection.execute(
        insert(tables["user_group"]),
        [
            {
                "id": "user-group-1",
                "user_id": "user-1",
                "group_id": "group-support",
                "joined_at": FIXED_NOW,
                "created_at": FIXED_NOW,
            },
            {
                "id": "user-group-2",
                "user_id": "user-2",
                "group_id": "group-support",
                "joined_at": FIXED_NOW,
                "created_at": FIXED_NOW,
            },
            {
                "id": "user-group-3",
                "user_id": "user-2",
                "group_id": "group-default",
                "joined_at": FIXED_NOW,
                "created_at": FIXED_NOW,
            },
        ],
    )
    connection.execute(
        insert(tables["chat_message"]),
        [{"id": "chat-1", "receiver_group_id": "group-support"}],
    )


def test_group_route_wrappers_and_helpers(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(groups_router, "_create_group", lambda *args, **kwargs: service_failure("boom", 400))
    monkeypatch.setattr(groups_router, "_update_group", lambda *args, **kwargs: service_failure("boom", 400))
    monkeypatch.setattr(groups_router, "_delete_group", lambda *args, **kwargs: service_failure("boom", 400))
    monkeypatch.setattr(groups_router, "_get_group_permissions", lambda *args, **kwargs: service_failure("boom", 400))
    monkeypatch.setattr(groups_router, "_update_group_permission", lambda *args, **kwargs: service_failure("boom", 400))

    invalid_delete = _payload(
        asyncio_run(groups_router.delete_group(id=None, _current_user=object(), db=object()))
    )
    assert invalid_delete["success"] is False

    invalid_permissions = _payload(
        asyncio_run(groups_router.get_group_permissions(groupId=None, _current_user=object(), db=object()))
    )
    assert invalid_permissions["success"] is False

    invalid_remove = _payload(
        asyncio_run(groups_router.remove_user_from_group(userId=None, groupId=None, _current_user=object(), db=object()))
    )
    assert invalid_remove["success"] is False

    create_error = _payload(
        asyncio_run(groups_router.create_group({"name": "Novo"}, object(), object()))
    )
    assert create_error["success"] is False

    update_error = _payload(
        asyncio_run(groups_router.update_group({"id": "group-support", "name": "Suporte"}, object(), object()))
    )
    assert update_error["success"] is False

    permission_error = _payload(
        asyncio_run(
            groups_router.update_group_permission(
                {"groupId": "group-support", "resource": "products", "action": "view", "enabled": True},
                object(),
                object(),
            )
        )
    )
    assert permission_error["success"] is False

    assert groups_router._require_text("  texto  ") == "  texto  "  # noqa: SLF001
    assert groups_router._optional_str("  texto  ") == "  texto  "  # noqa: SLF001
    assert groups_router._nullable_text("  texto  ") == "texto"  # noqa: SLF001
    assert groups_router._nullable_text(1) is None  # noqa: SLF001


def test_group_crud_and_permission_helpers(monkeypatch: pytest.MonkeyPatch) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    tables = _build_tables()
    tables["group"].metadata.create_all(engine)

    monkeypatch.setattr(groups_router, "legacy_tables", tables)
    monkeypatch.setattr(groups_router, "now_naive", lambda: FIXED_NOW)
    new_ids = iter(
        [
            "new-group-id",
            *[f"perm-{index}" for index in range(1, 40)],
        ]
    )
    monkeypatch.setattr(groups_router, "_new_uuid", lambda: next(new_ids))

    with engine.begin() as connection:
        _seed_group_data(connection, tables)

    with engine.connect() as connection:
        listed = groups_router._list_groups(connection, search="Su", status="active")  # noqa: SLF001
        assert listed["total"] == 1
        assert listed["items"][0]["id"] == "group-support"
        assert listed["items"][0]["userCount"] == 2

        invalid_create = groups_router._create_group(connection, {"description": "Sem nome"})  # noqa: SLF001
        assert invalid_create["ok"] is False

        admin_create = groups_router._create_group(  # noqa: SLF001
            connection,
            {"name": "Novo", "role": "admin"},
        )
        assert admin_create["ok"] is False

        duplicate_create = groups_router._create_group(  # noqa: SLF001
            connection,
            {"name": "Suporte"},
        )
        assert duplicate_create["ok"] is False

        created = groups_router._create_group(  # noqa: SLF001
            connection,
            {"name": "Nova Equipe", "description": "Equipe nova", "isDefault": False},
        )
        assert created["ok"] is True
        assert created["data"]["id"] == "new-group-id"
        permissions = connection.execute(select(tables["group_permissions"]).where(tables["group_permissions"].c.group_id == "new-group-id")).mappings().all()
        assert len(permissions) == len(groups_router.DEFAULT_GROUP_PERMISSIONS)

        admin_disable = groups_router._update_group(  # noqa: SLF001
            connection,
            {"id": "group-admin", "name": "Administradores", "active": False},
        )
        assert admin_disable["ok"] is False

        rename_admin = groups_router._update_group(  # noqa: SLF001
            connection,
            {"id": "group-admin", "name": "Admins"},
        )
        assert rename_admin["ok"] is False

        last_default = groups_router._update_group(  # noqa: SLF001
            connection,
            {"id": "group-default", "name": "Visitantes", "isDefault": False},
        )
        assert last_default["ok"] is False

        duplicate_update = groups_router._update_group(  # noqa: SLF001
            connection,
            {"id": "group-support", "name": "Visitantes"},
        )
        assert duplicate_update["ok"] is False

        updated = groups_router._update_group(  # noqa: SLF001
            connection,
            {"id": "group-support", "name": "Suporte N1", "description": "Atualizado", "active": False},
        )
        assert updated["ok"] is True
        assert updated["data"]["name"] == "Suporte N1"

        missing_permissions = groups_router._get_group_permissions(connection, "missing-group")  # noqa: SLF001
        assert missing_permissions["ok"] is False

        permissions_before = groups_router._get_group_permissions(connection, "group-support")  # noqa: SLF001
        assert permissions_before["ok"] is True
        assert permissions_before["data"]["permissions"]["products"] == ["view"]
        support_permissions = connection.execute(
            select(tables["group_permissions"]).where(tables["group_permissions"].c.group_id == "group-support")
        ).mappings().all()
        assert len(support_permissions) == len(groups_router.DEFAULT_GROUP_PERMISSIONS)

        invalid_permission = groups_router._update_group_permission(  # noqa: SLF001
            connection,
            {"groupId": "group-support", "resource": "products", "action": "view", "enabled": "yes"},
        )
        assert invalid_permission["ok"] is False

        admin_permission = groups_router._update_group_permission(  # noqa: SLF001
            connection,
            {"groupId": "group-admin", "resource": "products", "action": "view", "enabled": True},
        )
        assert admin_permission["ok"] is False

        immutable_permission = groups_router._update_group_permission(  # noqa: SLF001
            connection,
            {"groupId": "group-support", "resource": "products", "action": "view", "enabled": False},
        )
        assert immutable_permission["ok"] is False

        extra_permission = groups_router._update_group_permission(  # noqa: SLF001
            connection,
            {"groupId": "group-support", "resource": "contacts", "action": "manage", "enabled": True},
        )
        assert extra_permission["ok"] is True

        disabled_permission = groups_router._update_group_permission(  # noqa: SLF001
            connection,
            {"groupId": "group-support", "resource": "contacts", "action": "manage", "enabled": False},
        )
        assert disabled_permission["ok"] is True

        groups_router._remove_user_from_group(connection, "user-2", "group-support")  # noqa: SLF001
        remaining_membership = connection.execute(
            select(tables["user_group"]).where(
                tables["user_group"].c.user_id == "user-2",
                tables["user_group"].c.group_id == "group-support",
            )
        ).mappings().all()
        assert remaining_membership == []

        deleted = groups_router._delete_group(connection, "group-support")  # noqa: SLF001
        assert deleted["ok"] is True
        default_memberships = connection.execute(
            select(tables["user_group"]).where(tables["user_group"].c.group_id == "group-default")
        ).mappings().all()
        assert any(row["user_id"] == "user-1" for row in default_memberships)
        chat_rows = connection.execute(select(tables["chat_message"])).mappings().all()
        assert chat_rows == []


def asyncio_run(coro):
    import asyncio

    return asyncio.run(coro)
