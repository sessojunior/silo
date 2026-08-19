from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Integer,
    JSON,
    MetaData,
    String,
    Table,
    create_engine,
    insert,
    update,
)

from silo.services import project_portal


@dataclass(frozen=True, slots=True)
class _ProjectIds:
    project_1: str = "project-1"
    project_2: str = "project-2"
    project_x: str = "project-x"
    activity_1: str = "activity-1"
    activity_2: str = "activity-2"
    activity_x: str = "activity-x"
    task_1: str = "task-1"
    task_2: str = "task-2"
    task_3: str = "task-3"
    task_4: str = "task-4"
    task_x: str = "task-x"
    user_1: str = "user-1"
    user_2: str = "user-2"


BASE_DATE = date(2026, 8, 1)
BASE_DATETIME = datetime(2026, 8, 1, 12, 0, tzinfo=UTC)


def _build_tables() -> dict[str, Table]:
    metadata = MetaData()
    return {
        "project": Table(
            "project",
            metadata,
            Column("id", String, primary_key=True),
            Column("name", String, nullable=False),
            Column("short_description", String, nullable=False),
            Column("description", String, nullable=False),
            Column("start_date", Date, nullable=True),
            Column("end_date", Date, nullable=True),
            Column("priority", String, nullable=False),
            Column("status", String, nullable=False),
            Column("created_at", DateTime, nullable=False),
            Column("updated_at", DateTime, nullable=False),
        ),
        "project_activity": Table(
            "project_activity",
            metadata,
            Column("id", String, primary_key=True),
            Column("project_id", String, nullable=False),
            Column("name", String, nullable=False),
            Column("description", String, nullable=False),
            Column("category", String, nullable=True),
            Column("estimated_days", Integer, nullable=True),
            Column("start_date", Date, nullable=True),
            Column("end_date", Date, nullable=True),
            Column("priority", String, nullable=False),
            Column("status", String, nullable=False),
            Column("created_at", DateTime, nullable=False),
            Column("updated_at", DateTime, nullable=False),
        ),
        "project_task": Table(
            "project_task",
            metadata,
            Column("id", String, primary_key=True),
            Column("project_id", String, nullable=False),
            Column("project_activity_id", String, nullable=False),
            Column("name", String, nullable=False),
            Column("description", String, nullable=False),
            Column("category", String, nullable=True),
            Column("estimated_days", Integer, nullable=True),
            Column("start_date", Date, nullable=True),
            Column("end_date", Date, nullable=True),
            Column("priority", String, nullable=False),
            Column("status", String, nullable=False),
            Column("sort", Integer, nullable=False),
            Column("created_at", DateTime, nullable=False),
            Column("updated_at", DateTime, nullable=False),
        ),
        "project_task_user": Table(
            "project_task_user",
            metadata,
            Column("id", String, primary_key=True),
            Column("task_id", String, nullable=False),
            Column("user_id", String, nullable=False),
            Column("role", String, nullable=False),
            Column("assigned_at", DateTime, nullable=False),
            Column("created_at", DateTime, nullable=False),
        ),
        "project_task_history": Table(
            "project_task_history",
            metadata,
            Column("id", String, primary_key=True),
            Column("task_id", String, nullable=False),
            Column("user_id", String, nullable=False),
            Column("action", String, nullable=False),
            Column("from_status", String, nullable=True),
            Column("to_status", String, nullable=True),
            Column("from_sort", Integer, nullable=True),
            Column("to_sort", Integer, nullable=True),
            Column("details", JSON, nullable=False),
            Column("created_at", DateTime, nullable=False),
        ),
        "user": Table(
            "user",
            metadata,
            Column("id", String, primary_key=True),
            Column("name", String, nullable=False),
            Column("email", String, nullable=False),
            Column("image", String, nullable=True),
        ),
    }


def _seed_project_data(connection, tables: dict[str, Table]) -> _ProjectIds:  # type: ignore[no-untyped-def]
    ids = _ProjectIds()
    now = BASE_DATETIME.replace(tzinfo=None)

    connection.execute(
        insert(tables["user"]),
        [
            {
                "id": ids.user_1,
                "name": "User One",
                "email": "user.one@example.test",
                "image": "/uploads/avatars/user-1.png",
            },
            {
                "id": ids.user_2,
                "name": "User Two",
                "email": "user.two@example.test",
                "image": "/uploads/avatars/user-2.png",
            },
        ],
    )
    connection.execute(
        insert(tables["project"]),
        [
            {
                "id": ids.project_1,
                "name": "Projeto Atlas",
                "short_description": "Acompanhamento operacional",
                "description": "Projeto principal de testes",
                "start_date": BASE_DATE - timedelta(days=10),
                "end_date": BASE_DATE + timedelta(days=20),
                "priority": "high",
                "status": "active",
                "created_at": now - timedelta(days=10),
                "updated_at": now - timedelta(days=1),
            },
            {
                "id": ids.project_2,
                "name": "Projeto Aurora",
                "short_description": "Relatórios executivos",
                "description": "Projeto secundário",
                "start_date": BASE_DATE - timedelta(days=20),
                "end_date": BASE_DATE - timedelta(days=5),
                "priority": "low",
                "status": "completed",
                "created_at": now - timedelta(days=20),
                "updated_at": now - timedelta(days=5),
            },
        ],
    )
    connection.execute(
        insert(tables["project_activity"]),
        [
            {
                "id": ids.activity_1,
                "project_id": ids.project_1,
                "name": "Atividade principal",
                "description": "Fluxo principal do projeto",
                "category": "Operações",
                "estimated_days": 5,
                "start_date": BASE_DATE - timedelta(days=8),
                "end_date": BASE_DATE - timedelta(days=2),
                "priority": "high",
                "status": "progress",
                "created_at": now - timedelta(days=8),
                "updated_at": now - timedelta(days=1),
            },
            {
                "id": ids.activity_2,
                "project_id": ids.project_1,
                "name": "Atividade secundária",
                "description": "Etapa de revisão",
                "category": "Qualidade",
                "estimated_days": 3,
                "start_date": BASE_DATE - timedelta(days=6),
                "end_date": BASE_DATE - timedelta(days=1),
                "priority": "medium",
                "status": "todo",
                "created_at": now - timedelta(days=6),
                "updated_at": now - timedelta(hours=10),
            },
        ],
    )
    connection.execute(
        insert(tables["project_task"]),
        [
            {
                "id": ids.task_1,
                "project_id": ids.project_1,
                "project_activity_id": ids.activity_1,
                "name": "Tarefa 1",
                "description": "Tarefa em andamento",
                "category": "Operações",
                "estimated_days": 1,
                "start_date": BASE_DATE - timedelta(days=8),
                "end_date": BASE_DATE - timedelta(days=7),
                "priority": "high",
                "status": "todo",
                "sort": 0,
                "created_at": now - timedelta(days=8),
                "updated_at": now - timedelta(days=2),
            },
            {
                "id": ids.task_2,
                "project_id": ids.project_1,
                "project_activity_id": ids.activity_1,
                "name": "Tarefa 2",
                "description": "Tarefa complementar",
                "category": "Operações",
                "estimated_days": 1,
                "start_date": BASE_DATE - timedelta(days=7),
                "end_date": BASE_DATE - timedelta(days=6),
                "priority": "medium",
                "status": "todo",
                "sort": 1,
                "created_at": now - timedelta(days=7),
                "updated_at": now - timedelta(days=2),
            },
            {
                "id": ids.task_3,
                "project_id": ids.project_1,
                "project_activity_id": ids.activity_1,
                "name": "Tarefa 3",
                "description": "Tarefa em progresso",
                "category": "Operações",
                "estimated_days": 2,
                "start_date": BASE_DATE - timedelta(days=6),
                "end_date": BASE_DATE - timedelta(days=4),
                "priority": "low",
                "status": "progress",
                "sort": 0,
                "created_at": now - timedelta(days=6),
                "updated_at": now - timedelta(days=1),
            },
            {
                "id": ids.task_4,
                "project_id": ids.project_1,
                "project_activity_id": ids.activity_1,
                "name": "Tarefa 4",
                "description": "Tarefa concluída",
                "category": "Operações",
                "estimated_days": 1,
                "start_date": BASE_DATE - timedelta(days=5),
                "end_date": BASE_DATE - timedelta(days=4),
                "priority": "low",
                "status": "done",
                "sort": 0,
                "created_at": now - timedelta(days=5),
                "updated_at": now - timedelta(days=1),
            },
        ],
    )
    connection.execute(
        insert(tables["project_task_user"]),
        [
            {
                "id": "task-user-1",
                "task_id": ids.task_1,
                "user_id": ids.user_1,
                "role": "assignee",
                "assigned_at": now - timedelta(days=8),
                "created_at": now - timedelta(days=8),
            },
            {
                "id": "task-user-2",
                "task_id": ids.task_1,
                "user_id": ids.user_2,
                "role": "reviewer",
                "assigned_at": now - timedelta(days=7),
                "created_at": now - timedelta(days=7),
            },
            {
                "id": "task-user-3",
                "task_id": ids.task_2,
                "user_id": ids.user_1,
                "role": "assignee",
                "assigned_at": now - timedelta(days=7),
                "created_at": now - timedelta(days=7),
            },
        ],
    )
    connection.execute(
        insert(tables["project_task_history"]),
        [
            {
                "id": "history-1",
                "task_id": ids.task_1,
                "user_id": ids.user_1,
                "action": "created",
                "from_status": None,
                "to_status": "todo",
                "from_sort": None,
                "to_sort": 0,
                "details": {"initialData": {"name": "Tarefa 1"}},
                "created_at": now - timedelta(days=8),
            }
        ],
    )
    return ids


@pytest.fixture()
def project_connection(tmp_path, monkeypatch):
    engine = create_engine(
        f"sqlite+pysqlite:///{tmp_path / 'project.sqlite3'}",
        future=True,
        connect_args={"check_same_thread": False},
    )
    tables = _build_tables()
    tables["project"].metadata.create_all(engine)
    monkeypatch.setattr(project_portal, "legacy_tables", tables)
    with engine.begin() as connection:
        ids = _seed_project_data(connection, tables)

    connection = engine.connect()
    try:
        yield connection, ids, tables
    finally:
        connection.close()


def test_project_portal_crud_and_task_history(project_connection) -> None:
    connection, ids, tables = project_connection

    filtered = project_portal.list_projects(connection, search="Projeto", status="active", priority="high")
    assert filtered["ok"] is True
    assert len(filtered["data"]) == 1
    assert filtered["data"][0]["id"] == ids.project_1

    created_project = project_portal.create_project(
        connection,
        {
            "name": "Projeto Novo",
            "shortDescription": "Resumo novo",
            "description": "Descrição nova",
            "priority": "medium",
            "status": "planning",
            "startDate": "2026-08-01",
            "endDate": "2026-08-20",
        },
    )
    assert created_project["ok"] is True
    project_x_id = created_project["data"]["id"]

    updated_project = project_portal.update_project(
        connection,
        {
            "id": project_x_id,
            "name": "Projeto Novo Atualizado",
            "shortDescription": "Resumo novo",
            "description": "Descrição atualizada",
            "priority": "high",
            "status": "active",
            "startDate": "2026-08-02",
            "endDate": "2026-08-21",
        },
    )
    assert updated_project["data"]["name"] == "Projeto Novo Atualizado"

    activities = project_portal.list_project_activities(connection, ids.project_1)
    assert activities["ok"] is True
    assert len(activities["data"]["activities"]) == 2

    created_activity = project_portal.create_project_activity(
        connection,
        project_x_id,
        {
            "name": "Atividade nova",
            "description": "Atividade nova",
            "priority": "medium",
            "status": "todo",
            "category": "Planejamento",
            "estimatedDays": 4,
            "startDate": "2026-08-03",
            "endDate": "2026-08-10",
        },
    )
    assert created_activity["ok"] is True
    activity_x_id = created_activity["data"]["activity"]["id"]

    updated_activity = project_portal.update_project_activity(
        connection,
        project_x_id,
        {
            "id": activity_x_id,
            "name": "Atividade nova atualizada",
            "description": "Atividade atualizada",
            "priority": "high",
            "status": "progress",
            "category": "Planejamento",
            "estimatedDays": 5,
            "startDate": "2026-08-04",
            "endDate": "2026-08-11",
        },
    )
    assert updated_activity["data"]["activity"]["name"] == "Atividade nova atualizada"

    # estimatedDays decimal deve ser rejeitado (coluna do banco e integer);
    # antes virava NULL silenciosamente via optional_int.
    decimal_days = project_portal.create_project_activity(
        connection,
        project_x_id,
        {"name": "Atividade decimal", "description": "x", "estimatedDays": 2.5},
    )
    assert decimal_days["ok"] is False
    assert decimal_days["field"] == "estimatedDays"

    decimal_update = project_portal.update_project_activity(
        connection,
        project_x_id,
        {
            "id": activity_x_id,
            "name": "Atividade nova atualizada",
            "description": "Atividade atualizada",
            "estimatedDays": 1.5,
        },
    )
    assert decimal_update["ok"] is False
    assert decimal_update["field"] == "estimatedDays"

    # Inteiro em string deve continuar aceito.
    string_days = project_portal.update_project_activity(
        connection,
        project_x_id,
        {
            "id": activity_x_id,
            "name": "Atividade nova atualizada",
            "description": "Atividade atualizada",
            "estimatedDays": "4",
        },
    )
    assert string_days["ok"] is True

    tasks = project_portal.list_project_activity_tasks(connection, ids.project_1, ids.activity_1)
    assert tasks["ok"] is True
    assert [task["id"] for task in tasks["data"]["tasks"]["todo"]] == [ids.task_1, ids.task_2]
    assert [task["id"] for task in tasks["data"]["tasks"]["in_progress"]] == [ids.task_3]
    assert [task["id"] for task in tasks["data"]["tasks"]["done"]] == [ids.task_4]
    assert tasks["data"]["tasks"]["todo"][0]["assignedUsers"] == [ids.user_1, ids.user_2]

    created_task = project_portal.create_project_activity_task(
        connection,
        project_x_id,
        activity_x_id,
        ids.user_1,
        {
            "projectId": project_x_id,
            "projectActivityId": activity_x_id,
            "name": "Tarefa nova",
            "description": "Tarefa nova",
            "priority": "medium",
            "status": "progress",
            "category": "Planejamento",
            "estimatedDays": 2,
            "startDate": "2026-08-05",
            "endDate": "2026-08-12",
        },
    )
    assert created_task["ok"] is True
    task_x_id = created_task["data"]["task"]["id"]
    assert created_task["data"]["task"]["status"] == "in_progress"

    updated_task = project_portal.update_project_activity_task(
        connection,
        project_x_id,
        activity_x_id,
        ids.user_1,
        {
            "id": task_x_id,
            "projectId": project_x_id,
            "projectActivityId": activity_x_id,
            "name": "Tarefa nova atualizada",
            "description": "Tarefa atualizada",
            "priority": "high",
            "status": "done",
            "category": "Planejamento",
            "estimatedDays": 3,
            "startDate": "2026-08-05",
            "endDate": "2026-08-13",
        },
    )
    assert updated_task["ok"] is True
    assert updated_task["data"]["task"]["status"] == "done"

    history = project_portal.get_task_history(connection, task_x_id)
    assert history["ok"] is True
    assert [item["action"] for item in history["data"]["history"]][:2] == ["updated", "created"]

    task_users = project_portal.get_task_users(connection, ids.task_1)
    assert task_users["ok"] is True
    assert [user["id"] for user in task_users["data"]] == [ids.user_1, ids.user_2]

    project_portal.set_task_users(connection, ids.task_1, [ids.user_2, ids.user_2, ids.user_1], role="reviewer")
    task_users_after = project_portal.get_task_users(connection, ids.task_1)
    assert [user["id"] for user in task_users_after["data"]] == [ids.user_2, ids.user_1]
    assert all(user["role"] == "reviewer" for user in task_users_after["data"])

    reorder_result = project_portal.reorder_project_activity_tasks(
        connection,
        ids.project_1,
        ids.activity_1,
        ids.user_1,
        [
            {"taskId": ids.task_1, "status": "todo", "sort": 0},
            {"taskId": ids.task_2, "status": "todo", "sort": 1},
            {"taskId": ids.task_3, "status": "in_progress", "sort": 0},
            {"taskId": ids.task_4, "status": "done", "sort": 0},
        ],
        [
            {"taskId": ids.task_1, "status": "todo", "sort": 1},
            {"taskId": ids.task_2, "status": "todo", "sort": 0},
            {"taskId": ids.task_3, "status": "in_progress", "sort": 0},
            {"taskId": ids.task_4, "status": "done", "sort": 0},
        ],
    )
    assert reorder_result["ok"] is True
    assert [task["id"] for task in reorder_result["data"]["tasks"]] == [
        ids.task_2,
        ids.task_3,
        ids.task_4,
        ids.task_1,
    ]
    assert [task["status"] for task in reorder_result["data"]["tasks"]] == [
        "todo",
        "in_progress",
        "done",
        "todo",
    ]

    delete_task_result = project_portal.delete_project_activity_task(connection, project_x_id, activity_x_id, task_x_id)
    assert delete_task_result["ok"] is True

    delete_activity_result = project_portal.delete_project_activity(connection, project_x_id, activity_x_id)
    assert delete_activity_result["ok"] is True

    delete_project_result = project_portal.delete_project(connection, project_x_id)
    assert delete_project_result["ok"] is True
    assert (
        connection.execute(
            tables["project"].select().where(tables["project"].c.id == project_x_id)
        ).mappings().first()
        is None
    )


def test_project_portal_covers_task_conflicts_and_project_cascade(project_connection) -> None:
    connection, ids, tables = project_connection

    assert (
        project_portal.update_project(
            connection,
            {
                "id": "missing-project",
                "name": "Projeto",
                "shortDescription": "Resumo",
                "description": "Descricao",
                "priority": "medium",
                "status": "planning",
            },
        )["ok"]
        is False
    )

    assert (
        project_portal.create_project_activity_task(
            connection,
            ids.project_1,
            ids.activity_1,
            ids.user_1,
            {
                "name": "Tarefa invalida",
                "description": "Descricao",
                "projectId": ids.project_2,
                "projectActivityId": ids.activity_1,
                "priority": "medium",
                "status": "todo",
            },
        )["ok"]
        is False
    )

    assert (
        project_portal.update_project_activity_task(
            connection,
            ids.project_1,
            ids.activity_1,
            ids.user_1,
            {
                "id": ids.task_1,
                "name": "Tarefa invalida",
                "description": "Descricao",
                "projectId": ids.project_2,
                "projectActivityId": ids.activity_1,
                "priority": "medium",
                "status": "todo",
            },
        )["ok"]
        is False
    )

    stale_before_move = [
        {"taskId": ids.task_1, "status": "todo", "sort": 0},
        {"taskId": ids.task_2, "status": "todo", "sort": 1},
    ]
    stale_after_move = [
        {"taskId": ids.task_1, "status": "todo", "sort": 1},
        {"taskId": ids.task_2, "status": "todo", "sort": 0},
    ]

    connection.execute(
        update(tables["project_task"]).where(tables["project_task"].c.id == ids.task_1).values(sort=9)
    )
    connection.commit()

    outdated_result = project_portal.reorder_project_activity_tasks(
        connection,
        ids.project_1,
        ids.activity_1,
        ids.user_1,
        stale_before_move,
        stale_after_move,
    )
    assert outdated_result["ok"] is False
    assert any(task["id"] == ids.task_1 for task in outdated_result["data"]["tasks"])
    assert any(task["id"] == ids.task_2 for task in outdated_result["data"]["tasks"])

    connection.execute(
        update(tables["project_task"]).where(tables["project_task"].c.id == ids.task_1).values(sort=0)
    )
    connection.execute(
        update(tables["project_task"]).where(tables["project_task"].c.id == ids.task_2).values(sort=1)
    )
    connection.commit()

    class _ConflictConnection:
        def __init__(self, inner_connection) -> None:  # type: ignore[no-untyped-def]
            self._inner_connection = inner_connection

        def __getattr__(self, name: str):
            return getattr(self._inner_connection, name)

        def execute(self, statement, *args, **kwargs):  # type: ignore[no-untyped-def]
            result = self._inner_connection.execute(statement, *args, **kwargs)
            if getattr(statement, "__visit_name__", None) == "update" and getattr(
                getattr(statement, "table", None),
                "name",
                None,
            ) == "project_task":
                return type("_EmptyUpdateResult", (), {"all": lambda self: []})()
            return result

    conflict_result = project_portal.reorder_project_activity_tasks(
        _ConflictConnection(connection),
        ids.project_1,
        ids.activity_1,
        ids.user_1,
        stale_before_move,
        stale_after_move,
    )
    assert conflict_result["ok"] is False
    assert conflict_result["data"]["tasks"][0]["id"] == ids.task_1

    project_x = project_portal.create_project(
        connection,
        {
            "name": "Projeto Cascata",
            "shortDescription": "Resumo cascata",
            "description": "Descricao cascata",
            "priority": "medium",
            "status": "planning",
            "startDate": "2026-08-03",
            "endDate": "2026-08-10",
        },
    )["data"]["id"]
    activity_x = project_portal.create_project_activity(
        connection,
        project_x,
        {
            "name": "Atividade cascata",
            "description": "Descricao cascata",
            "priority": "medium",
            "status": "todo",
        },
    )["data"]["activity"]["id"]
    task_x = project_portal.create_project_activity_task(
        connection,
        project_x,
        activity_x,
        ids.user_1,
        {
            "name": "Tarefa cascata",
            "description": "Descricao cascata",
            "projectId": project_x,
            "projectActivityId": activity_x,
            "priority": "high",
            "status": "todo",
        },
    )["data"]["task"]["id"]
    project_portal.set_task_users(connection, task_x, [ids.user_1], role="assignee")

    delete_project_result = project_portal.delete_project(connection, project_x)
    assert delete_project_result["ok"] is True
    assert connection.execute(tables["project"].select().where(tables["project"].c.id == project_x)).first() is None
    assert connection.execute(tables["project_task"].select().where(tables["project_task"].c.id == task_x)).first() is None
    assert (
        connection.execute(
            tables["project_task_user"].select().where(tables["project_task_user"].c.task_id == task_x)
        ).first()
        is None
    )
    assert (
        connection.execute(
            tables["project_task_history"].select().where(tables["project_task_history"].c.task_id == task_x)
        ).first()
        is None
    )


def test_project_portal_rejects_invalid_inputs_and_missing_rows(project_connection) -> None:
    connection, ids, _tables = project_connection

    assert project_portal.create_project(connection, {"name": "x"})["ok"] is False
    assert project_portal.update_project(connection, {"id": "missing"})["ok"] is False
    assert project_portal.delete_project(connection, "missing")["ok"] is False
    assert project_portal.list_project_activities(connection, "missing")["ok"] is False
    assert project_portal.create_project_activity(connection, "missing", {"name": "x"})["ok"] is False
    assert project_portal.update_project_activity(connection, "missing", {"id": "x"})["ok"] is False
    assert project_portal.delete_project_activity(connection, "missing", "x")["ok"] is False
    assert project_portal.list_project_activity_tasks(connection, ids.project_1, "missing")["ok"] is False
    assert (
        project_portal.create_project_activity_task(
            connection,
            ids.project_1,
            ids.activity_1,
            ids.user_1,
            {
                "projectId": ids.project_1,
                "projectActivityId": ids.activity_1,
                "name": "x",
            },
        )["ok"]
        is False
    )
    assert project_portal.update_project_activity_task(connection, ids.project_1, ids.activity_1, ids.user_1, {"id": "x"})["ok"] is False
    assert project_portal.delete_project_activity_task(connection, ids.project_1, ids.activity_1, "missing")["ok"] is False
    assert project_portal.reorder_project_activity_tasks(connection, ids.project_1, ids.activity_1, ids.user_1, [], [])["ok"] is False
    assert project_portal.get_task_history(connection, "missing")["ok"] is False
    assert project_portal.get_task_users(connection, "missing")["ok"] is False
    assert project_portal.set_task_users(connection, "missing", [ids.user_1])["ok"] is False


def test_project_portal_helpers_cover_payload_and_kanban_branches(project_connection) -> None:
    connection, ids, tables = project_connection

    conflict = project_portal.ProjectTaskReorderConflict([])  # noqa: SLF001
    assert str(conflict) == "KANBAN_OUTDATED"
    assert conflict.tasks == []

    assert project_portal._create_task_groups() == {  # noqa: SLF001
        "todo": [],
        "in_progress": [],
        "blocked": [],
        "review": [],
        "done": [],
    }
    assert project_portal._task_position_sort_key({"sort": 3, "createdAt": "a"}) == (3, "a")  # noqa: SLF001
    assert project_portal._task_position_sort_key({"sort": "7", "createdAt": "b"}) == (7, "b")  # noqa: SLF001
    assert project_portal._normalize_task_status(None) == "todo"  # noqa: SLF001
    assert project_portal._normalize_task_status("progress") == "in_progress"  # noqa: SLF001
    assert project_portal._normalize_task_status("review") == "review"  # noqa: SLF001
    assert project_portal._normalize_task_status("unknown") == "todo"  # noqa: SLF001

    rows = [
        {"id": "task-a", "status": "todo", "sort": 2, "createdAt": "2026-08-01T12:00:00"},
        {"id": "task-b", "status": "progress", "sort": 1, "createdAt": "2026-08-01T12:05:00"},
        {"id": "task-c", "status": "done", "sort": 0, "createdAt": "2026-08-01T12:10:00"},
    ]
    grouped = project_portal._task_groups_from_rows(rows)  # noqa: SLF001
    assert [task["id"] for task in grouped["todo"]] == ["task-a"]
    assert [task["id"] for task in grouped["in_progress"]] == ["task-b"]
    assert [task["id"] for task in grouped["done"]] == ["task-c"]

    assert project_portal._read_task_values(  # noqa: SLF001
        {
            "name": "Tarefa",
            "description": "Descricao",
            "category": "Categoria",
            "estimated_days": 3,
            "start_date": "2026-08-01",
            "end_date": "2026-08-02",
            "priority": "high",
            "status": "progress",
        }
    )["status"] == "in_progress"

    changed = project_portal._detect_changed_fields(  # noqa: SLF001
        {"name": "A", "description": "B", "priority": "low", "status": "todo"},
        {"name": "A1", "description": "B", "priority": "high", "status": "done"},
    )
    assert changed == ["name", "priority", "status"]

    assert project_portal._optional_date("2026-08-01") == date(2026, 8, 1)  # noqa: SLF001
    assert project_portal._optional_date("bad") is None  # noqa: SLF001
    assert project_portal._optional_date(None) is None  # noqa: SLF001
    assert project_portal._optional_str("texto") == "texto"  # noqa: SLF001
    assert project_portal._optional_str(123) is None  # noqa: SLF001

    safe_value = project_portal._json_safe_value(  # noqa: SLF001
        {
            "date": date(2026, 8, 1),
            "datetime": BASE_DATETIME,
            "list": [BASE_DATE, (1, BASE_DATETIME)],
        }
    )
    assert safe_value["date"] == "2026-08-01"
    assert safe_value["datetime"].startswith("2026-08-01T12:00:00")
    assert safe_value["list"][1] == [1, BASE_DATETIME.isoformat()]

    assert project_portal._require_project_payload(  # noqa: SLF001
        {
            "name": "Projeto",
            "shortDescription": "Resumo",
            "description": "Descricao",
            "priority": "high",
            "status": "active",
        }
    )["name"] == "Projeto"
    assert project_portal._require_project_payload({"name": "Projeto"}, update=False)["ok"] is False  # noqa: SLF001
    assert project_portal._require_project_payload(  # noqa: SLF001
        {
            "id": "project-x",
            "name": "Projeto",
            "shortDescription": "Resumo",
            "description": "Descricao",
            "priority": "high",
            "status": "active",
        },
        update=True,
    )["id"] == "project-x"
    assert project_portal._require_project_payload(  # noqa: SLF001
        {
            "name": "Projeto",
            "shortDescription": "Resumo",
            "description": "Descricao",
            "priority": "high",
            "status": "active",
        },
        update=True,
    )["ok"] is False

    assert project_portal._require_activity_payload(  # noqa: SLF001
        {"name": "Atividade", "description": "Descricao"}
    )["name"] == "Atividade"
    assert project_portal._require_activity_payload({"name": "Atividade"}, update=False)["ok"] is False  # noqa: SLF001
    assert project_portal._require_activity_payload(  # noqa: SLF001
        {"id": "activity-x", "name": "Atividade", "description": "Descricao"},
        update=True,
    )["id"] == "activity-x"
    assert project_portal._require_activity_payload({"name": "Atividade", "description": "Descricao"}, update=True)["ok"] is False  # noqa: SLF001

    assert project_portal._require_task_payload(  # noqa: SLF001
        {
            "projectId": ids.project_1,
            "projectActivityId": ids.activity_1,
            "name": "Tarefa",
            "description": "Descricao",
            "priority": "high",
            "status": "todo",
        },
        include_id=False,
    )["name"] == "Tarefa"
    assert project_portal._require_task_payload(  # noqa: SLF001
        {
            "projectId": ids.project_1,
            "projectActivityId": ids.activity_1,
            "name": "Tarefa",
            "description": "Descricao",
            "priority": "high",
            "status": "todo",
        },
        include_id=True,
    )["ok"] is False

    next_sort_existing = project_portal._get_next_task_sort(connection, ids.project_1, ids.activity_1, "todo")  # noqa: SLF001
    assert next_sort_existing == 2

    connection.execute(
        insert(tables["project"]).values(
            {
                "id": ids.project_x,
                "name": "Projeto vazio",
                "short_description": "Resumo vazio",
                "description": "Descricao vazia",
                "start_date": BASE_DATE,
                "end_date": BASE_DATE,
                "priority": "medium",
                "status": "planning",
                "created_at": BASE_DATETIME,
                "updated_at": BASE_DATETIME,
            }
        )
    )
    connection.execute(
        insert(tables["project_activity"]).values(
            {
                "id": ids.activity_x,
                "project_id": ids.project_x,
                "name": "Atividade vazia",
                "description": "Descricao vazia",
                "category": None,
                "estimated_days": None,
                "start_date": None,
                "end_date": None,
                "priority": "medium",
                "status": "todo",
                "created_at": BASE_DATETIME,
                "updated_at": BASE_DATETIME,
            }
        )
    )
    connection.commit()
    assert project_portal._get_next_task_sort(connection, ids.project_x, ids.activity_x, "todo") == 0  # noqa: SLF001

    kanban = project_portal._kanban_outdated(  # noqa: SLF001
        [{"id": "task-a", "status": "progress", "sort": "2", "createdAt": "2026-08-01T12:00:00"}]
    )
    assert kanban["ok"] is False
    assert kanban["data"]["tasks"][0]["status"] == "in_progress"
