from __future__ import annotations

import json
from types import SimpleNamespace

import pytest
from fastapi.responses import JSONResponse
from sqlalchemy import Column, DateTime, JSON, MetaData, String, Table, create_engine, select

from silo.api.routers import dashboard as dashboard_router
from silo.api.routers import help as help_router
from silo.api.routers import product_flow as product_flow_router
from silo.api.routers import contacts as contacts_router
from silo.api.routers import groups as groups_router
from silo.api.routers import projects as projects_router
from silo.api.routers import tasks as tasks_router
from silo.services.common import service_failure, service_success


def _payload(response):
    if isinstance(response, JSONResponse):
        return json.loads(response.body)
    return response


def _patch_success(monkeypatch, module, name: str, data: object) -> None:
    monkeypatch.setattr(
        module,
        name,
        lambda *args, _data=data, **kwargs: service_success(_data),
    )


def _product_flow_table(metadata: MetaData) -> Table:
    return Table(
        "product",
        metadata,
        Column("id", String, primary_key=True),
        Column("slug", String, nullable=True),
        Column("data_product_flow", JSON, nullable=False),
    )


def _help_table(metadata: MetaData) -> Table:
    return Table(
        "help",
        metadata,
        Column("id", String, primary_key=True),
        Column("description", String, nullable=False),
        Column("updated_at", DateTime, nullable=True),
    )


@pytest.mark.asyncio
async def test_contacts_and_groups_router_surfaces(monkeypatch) -> None:
    deleted_uploads: list[tuple[str, str]] = []
    contact_calls: list[tuple[tuple[object, ...], dict[str, object]]] = []
    group_calls: list[tuple[tuple[object, ...], dict[str, object]]] = []

    monkeypatch.setattr(contacts_router, "_list_contacts", lambda *args, **kwargs: {"items": [{"id": "contact-1"}], "total": 1})
    monkeypatch.setattr(
        contacts_router,
        "_create_contact",
        lambda *args, **kwargs: service_success({"id": "contact-new"}),
    )
    monkeypatch.setattr(
        contacts_router,
        "_update_contact",
        lambda *args, **kwargs: service_success(None),
    )
    monkeypatch.setattr(
        contacts_router,
        "_delete_contact",
        lambda *args, **kwargs: service_success(None),
    )
    monkeypatch.setattr(contacts_router, "is_upload_kind", lambda kind: kind == "avatars")
    monkeypatch.setattr(contacts_router, "is_safe_filename", lambda filename: filename != "bad.webp")
    monkeypatch.setattr(
        contacts_router,
        "delete_upload_file",
        lambda kind, filename: deleted_uploads.append((kind, filename)) or True,
    )

    monkeypatch.setattr(groups_router, "_list_groups", lambda *args, **kwargs: {"items": [{"id": "group-1"}], "total": 1})
    monkeypatch.setattr(groups_router, "_create_group", lambda *args, **kwargs: service_success({"id": "group-new"}))
    monkeypatch.setattr(groups_router, "_update_group", lambda *args, **kwargs: service_success({"id": "group-1"}))
    monkeypatch.setattr(groups_router, "_get_group_permissions", lambda *args, **kwargs: service_success({"permissions": {"products": ["view"]}}))
    monkeypatch.setattr(
        groups_router,
        "_update_group_permission",
        lambda *args, **kwargs: service_success({"groupId": "group-1", "resource": "products", "action": "view", "enabled": True}, message="ok"),
    )
    monkeypatch.setattr(
        groups_router,
        "_remove_user_from_group",
        lambda *args, **kwargs: group_calls.append((args, kwargs)),
    )
    monkeypatch.setattr(groups_router, "_delete_group", lambda *args, **kwargs: service_success(None))

    contacts = _payload(
        await contacts_router.list_contacts(
            search="ana",
            status="active",
            _current_user=object(),
            db=object(),
        )
    )
    assert contacts["data"]["total"] == 1

    contact_created = _payload(
        await contacts_router.create_contact(
            {
                "name": "Ana",
                "role": "Sales",
                "team": "Growth",
                "email": "ANA@example.test",
                "phone": "123",
                "imageUrl": "/uploads/avatars/ana.webp",
                "active": True,
            },
            object(),
            object(),
        )
    )
    assert contact_created["data"]["id"] == "contact-new"

    contact_updated = _payload(
        await contacts_router.update_contact(
            {
                "id": "contact-1",
                "name": "Ana Atualizada",
                "role": "Sales",
                "team": "Growth",
                "email": "ana@example.test",
                "imageUrl": "/uploads/avatars/ana.webp",
                "removeImage": True,
            },
            object(),
            object(),
        )
    )
    assert contact_updated["success"] is True

    invalid_contact_delete = _payload(
        await contacts_router.delete_contact(
            {},
            object(),
            object(),
        )
    )
    assert invalid_contact_delete["success"] is False

    contact_deleted = _payload(
        await contacts_router.delete_contact(
            {"id": "contact-1"},
            object(),
            object(),
        )
    )
    assert contact_deleted["success"] is True

    assert contacts_router._normalize_email(" ANA@Example.Test ") == "ana@example.test"  # noqa: SLF001
    assert contacts_router._require_text("  texto  ", "field") == "texto"  # noqa: SLF001
    assert contacts_router._optional_str("  texto  ") == "  texto  "  # noqa: SLF001
    assert contacts_router._optional_str(123) is None  # noqa: SLF001
    delete_upload = contacts_router._delete_upload_from_url  # noqa: SLF001
    delete_upload("/uploads/avatars/contact-1.webp")
    delete_upload("/uploads/avatars/bad.webp")
    delete_upload("/assets/contact-1.webp")
    assert deleted_uploads == [("avatars", "contact-1.webp")]

    groups = _payload(
        await groups_router.list_groups(
            search="grupo",
            status="active",
            _current_user=object(),
            db=object(),
        )
    )
    assert groups["data"]["total"] == 1

    group_created = _payload(
        await groups_router.create_group(
            {"name": "Grupo Novo", "description": "Descricao", "isDefault": True},
            object(),
            object(),
        )
    )
    assert group_created["data"]["id"] == "group-new"

    group_updated = _payload(
        await groups_router.update_group(
            {"id": "group-1", "name": "Grupo Atualizado", "description": "Descricao", "active": True},
            object(),
            object(),
        )
    )
    assert group_updated["success"] is True

    invalid_permissions = _payload(
        await groups_router.get_group_permissions(
            groupId=None,
            _current_user=object(),
            db=object(),
        )
    )
    assert invalid_permissions["success"] is False

    permissions = _payload(
        await groups_router.get_group_permissions(
            groupId="group-1",
            _current_user=object(),
            db=object(),
        )
    )
    assert permissions["data"]["permissions"]["products"] == ["view"]

    permission_updated = _payload(
        await groups_router.update_group_permission(
            {"groupId": "group-1", "resource": "products", "action": "view", "enabled": True},
            object(),
            object(),
        )
    )
    assert permission_updated["success"] is True

    invalid_remove_user = _payload(
        await groups_router.remove_user_from_group(
            userId=None,
            groupId="group-1",
            _current_user=object(),
            db=object(),
        )
    )
    assert invalid_remove_user["success"] is False

    removed_user = _payload(
        await groups_router.remove_user_from_group(
            userId="user-1",
            groupId="group-1",
            _current_user=object(),
            db=object(),
        )
    )
    assert removed_user["success"] is True
    assert groups_router._require_text("  texto  ") == "  texto  "  # noqa: SLF001
    assert groups_router._optional_str("  texto  ") == "  texto  "  # noqa: SLF001
    assert groups_router._nullable_text("  texto  ") == "texto"  # noqa: SLF001


@pytest.mark.asyncio
async def test_projects_and_tasks_router_surfaces(monkeypatch) -> None:
    project_calls: list[tuple[tuple[object, ...], dict[str, object]]] = []
    task_calls: list[tuple[tuple[object, ...], dict[str, object]]] = []
    task_user_calls: list[tuple[tuple[object, ...], dict[str, object]]] = []

    monkeypatch.setattr(projects_router, "list_projects", lambda *args, **kwargs: service_success({"items": [{"id": "project-1"}], "total": 1}))
    monkeypatch.setattr(projects_router, "create_project", lambda *args, **kwargs: service_success({"id": "project-new"}))
    monkeypatch.setattr(projects_router, "update_project", lambda *args, **kwargs: service_success({"id": "project-1"}))
    monkeypatch.setattr(projects_router, "delete_project", lambda *args, **kwargs: service_success(None))
    monkeypatch.setattr(projects_router, "list_project_activities", lambda *args, **kwargs: service_success({"activities": [{"id": "activity-1"}]}))
    monkeypatch.setattr(projects_router, "create_project_activity", lambda *args, **kwargs: service_success({"activity": {"id": "activity-new"}}))
    monkeypatch.setattr(projects_router, "update_project_activity", lambda *args, **kwargs: service_success({"activity": {"id": "activity-1"}}))
    monkeypatch.setattr(projects_router, "delete_project_activity", lambda *args, **kwargs: service_success(None))
    monkeypatch.setattr(projects_router, "list_project_activity_tasks", lambda *args, **kwargs: service_success({"tasks": [{"id": "task-1"}]}))
    monkeypatch.setattr(
        projects_router,
        "create_project_activity_task",
        lambda *args, **kwargs: service_success({"task": {"id": "task-new", "userId": args[3] if len(args) > 3 else None}}),
    )
    monkeypatch.setattr(
        projects_router,
        "update_project_activity_task",
        lambda *args, **kwargs: service_success({"task": {"id": "task-1"}}),
    )
    monkeypatch.setattr(projects_router, "delete_project_activity_task", lambda *args, **kwargs: service_success(None))
    monkeypatch.setattr(
        projects_router,
        "reorder_project_activity_tasks",
        lambda *args, **kwargs: service_success({"tasks": [{"id": "task-1"}, {"id": "task-2"}]}),
    )

    monkeypatch.setattr(tasks_router, "get_task_history", lambda *args, **kwargs: service_success({"history": [{"id": "history-1"}]}))
    monkeypatch.setattr(tasks_router, "get_task_users", lambda *args, **kwargs: service_success({"users": [{"id": "user-1"}]}))
    monkeypatch.setattr(tasks_router, "set_task_users", lambda *args, **kwargs: service_success(None))

    projects = _payload(
        await projects_router.get_projects(
            search="alpha",
            status="open",
            priority="high",
            _current_user=object(),
            db=object(),
        )
    )
    assert projects["data"]["total"] == 1

    project_created = _payload(
        await projects_router.post_project(
            {"name": "Projeto Novo"},
            object(),
            object(),
        )
    )
    assert project_created["data"]["id"] == "project-new"

    project_updated = _payload(
        await projects_router.put_project(
            {"id": "project-1", "name": "Projeto Atualizado"},
            object(),
            object(),
        )
    )
    assert project_updated["success"] is True

    invalid_delete_project = _payload(
        await projects_router.delete_project_route(None, object(), object())
    )
    assert invalid_delete_project["success"] is False

    project_deleted = _payload(
        await projects_router.delete_project_route("project-1", object(), object())
    )
    assert project_deleted["success"] is True

    activities = _payload(
        await projects_router.get_project_activities("project-1", object(), object())
    )
    assert activities["data"]["activities"][0]["id"] == "activity-1"

    activity_created = _payload(
        await projects_router.post_project_activity(
            "project-1",
            {"name": "Activity"},
            object(),
            object(),
        )
    )
    assert activity_created["data"]["activity"]["id"] == "activity-new"

    activity_updated = _payload(
        await projects_router.put_project_activity(
            "project-1",
            {"id": "activity-1", "name": "Activity 1"},
            object(),
            object(),
        )
    )
    assert activity_updated["success"] is True

    invalid_delete_activity = _payload(
        await projects_router.delete_project_activity_route("project-1", None, object(), object())
    )
    assert invalid_delete_activity["success"] is False

    activity_deleted = _payload(
        await projects_router.delete_project_activity_route("project-1", "activity-1", object(), object())
    )
    assert activity_deleted["success"] is True

    tasks = _payload(
        await projects_router.get_project_activity_tasks("project-1", "activity-1", object(), object())
    )
    assert tasks["data"]["tasks"][0]["id"] == "task-1"

    task_created = _payload(
        await projects_router.post_project_activity_task(
            "project-1",
            "activity-1",
            {"name": "Task"},
            SimpleNamespace(id="user-1"),
            object(),
        )
    )
    assert task_created["data"]["task"]["userId"] == "user-1"

    task_updated = _payload(
        await projects_router.put_project_activity_task(
            "project-1",
            "activity-1",
            {"id": "task-1", "name": "Task 1"},
            SimpleNamespace(id="user-1"),
            object(),
        )
    )
    assert task_updated["success"] is True

    invalid_delete_task = _payload(
        await projects_router.delete_project_activity_task_route(
            "project-1",
            "activity-1",
            {},
            object(),
            object(),
        )
    )
    assert invalid_delete_task["success"] is False

    task_deleted = _payload(
        await projects_router.delete_project_activity_task_route(
            "project-1",
            "activity-1",
            {"id": "task-1"},
            object(),
            object(),
        )
    )
    assert task_deleted["success"] is True

    invalid_move = _payload(
        await projects_router.patch_project_activity_tasks(
            "project-1",
            "activity-1",
            {"tasksBeforeMove": "bad", "tasksAfterMove": []},
            SimpleNamespace(id="user-1"),
            object(),
        )
    )
    assert invalid_move["success"] is False

    moved = _payload(
        await projects_router.patch_project_activity_tasks(
            "project-1",
            "activity-1",
            {"tasksBeforeMove": [{"id": "task-1"}], "tasksAfterMove": [{"id": "task-2"}]},
            SimpleNamespace(id="user-1"),
            object(),
        )
    )
    assert moved["success"] is True
    assert moved["data"]["tasks"][0]["id"] == "task-1"

    history = _payload(
        await tasks_router.get_history("task-1", object(), object())
    )
    assert history["data"]["history"][0]["id"] == "history-1"

    users = _payload(
        await tasks_router.get_users("task-1", object(), object())
    )
    assert users["data"]["users"][0]["id"] == "user-1"

    invalid_task_users = _payload(
        await tasks_router.post_users("task-1", {"userIds": [1]}, object(), object())
    )
    assert invalid_task_users["success"] is False

    task_users = _payload(
        await tasks_router.post_users("task-1", {"userIds": ["user-1", " "]}, SimpleNamespace(id="user-1"), object())
    )
    assert task_users["success"] is True


@pytest.mark.asyncio
async def test_projects_router_error_branches(monkeypatch) -> None:
    monkeypatch.setattr(
        projects_router,
        "list_projects",
        lambda *args, **kwargs: service_failure("boom", 500),
    )
    monkeypatch.setattr(
        projects_router,
        "create_project",
        lambda *args, **kwargs: service_failure("boom", 500),
    )
    monkeypatch.setattr(
        projects_router,
        "update_project",
        lambda *args, **kwargs: service_failure("boom", 500),
    )
    monkeypatch.setattr(
        projects_router,
        "delete_project",
        lambda *args, **kwargs: service_failure("boom", 500),
    )
    monkeypatch.setattr(
        projects_router,
        "list_project_activities",
        lambda *args, **kwargs: service_failure("boom", 500),
    )
    monkeypatch.setattr(
        projects_router,
        "create_project_activity",
        lambda *args, **kwargs: service_failure("boom", 500),
    )
    monkeypatch.setattr(
        projects_router,
        "update_project_activity",
        lambda *args, **kwargs: service_failure("boom", 500),
    )
    monkeypatch.setattr(
        projects_router,
        "delete_project_activity",
        lambda *args, **kwargs: service_failure("boom", 500),
    )
    monkeypatch.setattr(
        projects_router,
        "list_project_activity_tasks",
        lambda *args, **kwargs: service_failure("boom", 500),
    )
    monkeypatch.setattr(
        projects_router,
        "create_project_activity_task",
        lambda *args, **kwargs: service_failure("boom", 500),
    )
    monkeypatch.setattr(
        projects_router,
        "update_project_activity_task",
        lambda *args, **kwargs: service_failure("boom", 500),
    )
    monkeypatch.setattr(
        projects_router,
        "delete_project_activity_task",
        lambda *args, **kwargs: service_failure("boom", 500),
    )
    monkeypatch.setattr(
        projects_router,
        "reorder_project_activity_tasks",
        lambda *args, **kwargs: service_failure(
            "KANBAN_OUTDATED",
            409,
            data={"tasks": [{"id": "task-1"}]},
        ),
    )

    assert _payload(
        await projects_router.get_projects(
            search="alpha",
            status="open",
            priority="high",
            _current_user=object(),
            db=object(),
        )
    )["success"] is False
    assert _payload(
        await projects_router.post_project(
            {"name": "Projeto Novo"},
            object(),
            object(),
        )
    )["success"] is False
    assert _payload(
        await projects_router.put_project(
            {"id": "project-1", "name": "Projeto Atualizado"},
            object(),
            object(),
        )
    )["success"] is False
    assert _payload(
        await projects_router.delete_project_route("project-1", object(), object())
    )["success"] is False
    assert _payload(
        await projects_router.get_project_activities("project-1", object(), object())
    )["success"] is False
    assert _payload(
        await projects_router.post_project_activity(
            "project-1",
            {"name": "Activity"},
            object(),
            object(),
        )
    )["success"] is False
    assert _payload(
        await projects_router.put_project_activity(
            "project-1",
            {"id": "activity-1", "name": "Activity 1"},
            object(),
            object(),
        )
    )["success"] is False
    assert _payload(
        await projects_router.delete_project_activity_route(
            "project-1",
            "activity-1",
            object(),
            object(),
        )
    )["success"] is False
    assert _payload(
        await projects_router.get_project_activity_tasks("project-1", "activity-1", object(), object())
    )["success"] is False
    assert _payload(
        await projects_router.post_project_activity_task(
            "project-1",
            "activity-1",
            {"name": "Task"},
            SimpleNamespace(id="user-1"),
            object(),
        )
    )["success"] is False
    assert _payload(
        await projects_router.put_project_activity_task(
            "project-1",
            "activity-1",
            {"id": "task-1", "name": "Task 1"},
            SimpleNamespace(id="user-1"),
            object(),
        )
    )["success"] is False
    assert _payload(
        await projects_router.delete_project_activity_task_route(
            "project-1",
            "activity-1",
            {"id": "task-1"},
            object(),
            object(),
        )
    )["success"] is False

    conflict = _payload(
        await projects_router.patch_project_activity_tasks(
            "project-1",
            "activity-1",
            {"tasksBeforeMove": [{"id": "task-1"}], "tasksAfterMove": [{"id": "task-2"}]},
            SimpleNamespace(id="user-1"),
            object(),
        )
    )
    assert conflict["success"] is False
    assert conflict["error"] == "KANBAN_OUTDATED"
    assert conflict["tasks"] == [{"id": "task-1"}]

    monkeypatch.setattr(
        projects_router,
        "reorder_project_activity_tasks",
        lambda *args, **kwargs: service_failure("boom", 500),
    )
    generic = _payload(
        await projects_router.patch_project_activity_tasks(
            "project-1",
            "activity-1",
            {"tasksBeforeMove": [{"id": "task-1"}], "tasksAfterMove": [{"id": "task-2"}]},
            SimpleNamespace(id="user-1"),
            object(),
        )
    )
    assert generic["success"] is False


@pytest.mark.asyncio
async def test_product_flow_help_and_dashboard_router_surfaces(monkeypatch) -> None:
    product_engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    product_metadata = MetaData()
    product_table = _product_flow_table(product_metadata)
    product_connection = product_engine.connect()
    try:
        product_metadata.create_all(product_connection)
        product_connection.execute(
            product_table.insert(),
            [
                {
                    "id": "product-1",
                    "slug": "slug-1",
                    "data_product_flow": [],
                },
                {
                    "id": "product-2",
                    "slug": "slug-2",
                    "data_product_flow": {"legacy": True},
                },
            ],
        )
        product_connection.commit()

        monkeypatch.setattr(product_flow_router, "legacy_tables", {"product": product_table})
        monkeypatch.setattr(
            product_flow_router,
            "load_settings",
            lambda: SimpleNamespace(
                product_flow_api_key=SimpleNamespace(get_secret_value=lambda: "secret")
            ),
        )

        unauthorized = await product_flow_router.receive_product_flow(
            {"productId": "product-1", "payload": {"kind": "unauthorized"}},
            x_api_key="wrong",
            db=product_connection,
        )
        assert unauthorized.status_code == 401

        missing_ids = await product_flow_router.receive_product_flow(
            {"payload": {"kind": "missing"}},
            x_api_key="secret",
            db=product_connection,
        )
        assert missing_ids.status_code == 400

        not_found = await product_flow_router.receive_product_flow(
            {"productId": "missing", "payload": {"kind": "missing"}},
            x_api_key="secret",
            db=product_connection,
        )
        assert not_found.status_code == 404

        product_result = _payload(
            await product_flow_router.receive_product_flow(
                {"productId": "product-1", "payload": {"kind": "by-id"}},
                x_api_key="secret",
                db=product_connection,
            )
        )
        assert product_result["success"] is True
        row = product_connection.execute(
            select(product_table.c.data_product_flow).where(product_table.c.id == "product-1")
        ).scalar_one()
        assert len(row) == 1

        slug_result = _payload(
            await product_flow_router.receive_product_flow(
                {"slug": "slug-2", "payload": {"kind": "by-slug"}},
                x_api_key="secret",
                db=product_connection,
            )
        )
        assert slug_result["success"] is True
        row = product_connection.execute(
            select(product_table.c.data_product_flow).where(product_table.c.id == "product-2")
        ).scalar_one()
        assert len(row) == 1
    finally:
        product_connection.close()
        product_engine.dispose()

    help_engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    help_metadata = MetaData()
    help_table = _help_table(help_metadata)
    help_connection = help_engine.connect()
    try:
        help_metadata.create_all(help_connection)
        deleted_uploads: list[tuple[str, str]] = []
        monkeypatch.setattr(help_router, "legacy_tables", {"help": help_table})

        def _discard_task(coro):
            coro.close()
            return None

        monkeypatch.setattr(help_router.asyncio, "create_task", _discard_task)
        monkeypatch.setattr(help_router, "list_upload_files", lambda kind: [{"kind": kind, "filename": "help-1.webp"}])
        monkeypatch.setattr(help_router, "is_safe_filename", lambda filename: filename != "bad.webp")
        monkeypatch.setattr(
            help_router,
            "delete_upload_file",
            lambda kind, filename: deleted_uploads.append((kind, filename)),
        )

        help_doc = _payload(await help_router.get_help(object(), help_connection))
        assert help_doc["data"]["id"] == "system-help"

        updated = _payload(
            await help_router.update_help(
                {"description": "new description"},
                object(),
                help_connection,
            )
        )
        assert updated["success"] is True
        updated_row = help_connection.execute(
            select(help_table.c.description).where(help_table.c.id == "system-help")
        ).scalar_one()
        assert updated_row == "new description"

        assert help_router._extract_description({}) == ""  # noqa: SLF001
        assert help_router._extract_description({"description": "texto"}) == "texto"  # noqa: SLF001
        assert help_router._now_naive().tzinfo is None  # noqa: SLF001

        images = _payload(await help_router.list_help_images(object()))
        assert images["data"]["items"][0]["filename"] == "help-1.webp"

        invalid_help_image = _payload(await help_router.delete_help_image(None, object()))
        assert invalid_help_image["success"] is False
        unsafe_help_image = _payload(await help_router.delete_help_image("bad.webp", object()))
        assert unsafe_help_image["success"] is False
        deleted_help_image = _payload(await help_router.delete_help_image("help-1.webp", object()))
        assert deleted_help_image["success"] is True
        assert deleted_uploads == [("help", "help-1.webp")]
    finally:
        help_connection.close()
        help_engine.dispose()

    dashboard_success_routes = [
        ("dashboard_root", "get_dashboard_data"),
        ("dashboard_summary", "get_dashboard_summary"),
        ("dashboard_problems_causes", "get_dashboard_problems_causes"),
        ("dashboard_problems_solutions", "get_dashboard_problems_solutions"),
        ("dashboard_projects", "get_dashboard_projects"),
    ]
    for route_name, service_name in dashboard_success_routes:
        monkeypatch.setattr(
            dashboard_router,
            service_name,
            lambda _db, _data={"route": route_name}: _data,
        )
        payload = _payload(await getattr(dashboard_router, route_name)(db=object()))
        assert payload["success"] is True

    def _dashboard_boom(_db):
        raise RuntimeError("boom")

    for route_name, service_name in dashboard_success_routes:
        monkeypatch.setattr(dashboard_router, service_name, _dashboard_boom)
        payload = _payload(await getattr(dashboard_router, route_name)(db=object()))
        assert payload["success"] is False


@pytest.mark.asyncio
async def test_tasks_router_error_branches(monkeypatch) -> None:
    monkeypatch.setattr(
        tasks_router,
        "get_task_history",
        lambda *args, **kwargs: service_failure("boom", 500),
    )
    monkeypatch.setattr(
        tasks_router,
        "get_task_users",
        lambda *args, **kwargs: service_failure("boom", 500),
    )
    monkeypatch.setattr(
        tasks_router,
        "set_task_users",
        lambda *args, **kwargs: service_failure("boom", 500),
    )

    assert _payload(await tasks_router.get_history("task-1", object(), object()))["success"] is False
    assert _payload(await tasks_router.get_users("task-1", object(), object()))["success"] is False
    assert _payload(
        await tasks_router.post_users(
            "task-1",
            {"userIds": ["user-1", "user-2"], "role": "assignee"},
            SimpleNamespace(id="user-1"),
            object(),
        )
    )["success"] is False
