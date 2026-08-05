from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from datetime import datetime as real_datetime

import pytest
from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Date,
    DateTime,
    Integer,
    MetaData,
    String,
    Table,
    create_engine,
    insert,
)

from silo.services import dashboard_portal

BASE_DATE = date(2026, 7, 22)
BASE_DATETIME = real_datetime(2026, 7, 22, 12, 0)


class _FixedDateTime(real_datetime):
    @classmethod
    def now(cls, tz=None):  # type: ignore[override]
        if tz is None:
            return cls(2026, 7, 22, 12, 0)
        return cls(2026, 7, 22, 12, 0, tzinfo=tz)


@dataclass(frozen=True, slots=True)
class _DashboardIds:
    product_1: str = "product-1"
    product_2: str = "product-2"
    category_a: str = "category-a"
    category_b: str = "category-b"
    project_1: str = "project-1"
    project_2: str = "project-2"


def _dt(days: int = 0, hours: int = 0) -> real_datetime:
    return BASE_DATETIME - timedelta(days=days, hours=hours)


def _build_tables() -> dict[str, Table]:
    metadata = MetaData()
    return {
        "product": Table(
            "product",
            metadata,
            Column("id", String, primary_key=True),
            Column("name", String, nullable=False),
            Column("slug", String, nullable=False),
            Column("available", Boolean, nullable=False),
            Column("priority", String, nullable=False),
            Column("turns", JSON, nullable=False),
            Column("description", String, nullable=True),
            Column("url_product_flow", String, nullable=True),
            Column("data_product_flow", JSON, nullable=False),
        ),
        "product_activity": Table(
            "product_activity",
            metadata,
            Column("id", String, primary_key=True),
            Column("product_id", String, nullable=False),
            Column("user_id", String, nullable=False),
            Column("date", Date, nullable=False),
            Column("turn", Integer, nullable=False),
            Column("status", String, nullable=False),
            Column("problem_category_id", String, nullable=True),
            Column("description", String, nullable=True),
            Column("intervention", String, nullable=True),
            Column("created_at", DateTime, nullable=False),
            Column("updated_at", DateTime, nullable=False),
        ),
        "product_problem_category": Table(
            "product_problem_category",
            metadata,
            Column("id", String, primary_key=True),
            Column("name", String, nullable=False),
            Column("color", String, nullable=True),
            Column("is_system", Boolean, nullable=False),
            Column("sort_order", Integer, nullable=False),
            Column("created_at", DateTime, nullable=False),
            Column("updated_at", DateTime, nullable=False),
        ),
        "product_problem": Table(
            "product_problem",
            metadata,
            Column("id", String, primary_key=True),
            Column("product_id", String, nullable=False),
            Column("user_id", String, nullable=False),
            Column("title", String, nullable=False),
            Column("description", String, nullable=False),
            Column("created_at", Date, nullable=False),
            Column("updated_at", Date, nullable=False),
            Column("problem_category_id", String, nullable=True),
            Column("embedding", JSON, nullable=True),
        ),
        "product_solution": Table(
            "product_solution",
            metadata,
            Column("id", String, primary_key=True),
            Column("user_id", String, nullable=False),
            Column("product_problem_id", String, nullable=False),
            Column("description", String, nullable=False),
            Column("reply_id", String, nullable=True),
            Column("embedding", JSON, nullable=True),
            Column("created_at", Date, nullable=False),
            Column("updated_at", Date, nullable=False),
        ),
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
    }


def _seed_dashboard_data(connection, tables: dict[str, Table]) -> _DashboardIds:  # type: ignore[no-untyped-def]
    ids = _DashboardIds()

    connection.execute(
        insert(tables["product"]),
        [
            {
                "id": ids.product_1,
                "name": "Produto Alfa",
                "slug": "produto-alfa",
                "available": True,
                "priority": "high",
                "turns": ["00", "06", "12", "18"],
                "description": "Produto principal",
                "url_product_flow": None,
                "data_product_flow": [],
            },
            {
                "id": ids.product_2,
                "name": "Produto Beta",
                "slug": "produto-beta",
                "available": False,
                "priority": "low",
                "turns": ["00", "06", "12", "18"],
                "description": "Produto secundario",
                "url_product_flow": None,
                "data_product_flow": [],
            },
        ],
    )

    connection.execute(
        insert(tables["product_problem_category"]),
        [
            {
                "id": ids.category_a,
                "name": "Category A",
                "color": "#ff0000",
                "is_system": False,
                "sort_order": 0,
                "created_at": _dt(40),
                "updated_at": _dt(40),
            },
            {
                "id": ids.category_b,
                "name": "Category B",
                "color": "#00ff00",
                "is_system": False,
                "sort_order": 1,
                "created_at": _dt(39),
                "updated_at": _dt(39),
            },
        ],
    )

    connection.execute(
        insert(tables["product_activity"]),
        [
            {
                "id": "activity-1",
                "product_id": ids.product_1,
                "user_id": "user-admin",
                "date": BASE_DATE - timedelta(days=1),
                "turn": 0,
                "status": "completed",
                "problem_category_id": None,
                "description": "Concluido 1",
                "intervention": None,
                "created_at": _dt(1, 4),
                "updated_at": _dt(1, 1),
            },
            {
                "id": "activity-2",
                "product_id": ids.product_1,
                "user_id": "user-admin",
                "date": BASE_DATE - timedelta(days=2),
                "turn": 6,
                "status": "completed",
                "problem_category_id": None,
                "description": "Concluido 2",
                "intervention": None,
                "created_at": _dt(2, 4),
                "updated_at": _dt(2, 1),
            },
            {
                "id": "activity-3",
                "product_id": ids.product_1,
                "user_id": "user-admin",
                "date": BASE_DATE - timedelta(days=3),
                "turn": 12,
                "status": "with_problems",
                "problem_category_id": ids.category_a,
                "description": "Problema recente A",
                "intervention": "Ajuste A",
                "created_at": _dt(3, 4),
                "updated_at": _dt(3, 1),
            },
            {
                "id": "activity-4",
                "product_id": ids.product_1,
                "user_id": "user-admin",
                "date": BASE_DATE - timedelta(days=4),
                "turn": 18,
                "status": "run_again",
                "problem_category_id": ids.category_b,
                "description": "Problema recente B",
                "intervention": "Ajuste B",
                "created_at": _dt(4, 4),
                "updated_at": _dt(4, 1),
            },
            {
                "id": "activity-5",
                "product_id": ids.product_1,
                "user_id": "user-admin",
                "date": BASE_DATE - timedelta(days=8),
                "turn": 0,
                "status": "under_support",
                "problem_category_id": ids.category_a,
                "description": "Problema anterior",
                "intervention": "Ajuste C",
                "created_at": _dt(8, 4),
                "updated_at": _dt(8, 1),
            },
        ],
    )

    connection.execute(
        insert(tables["product_problem"]),
        [
            {
                "id": "problem-1",
                "product_id": ids.product_1,
                "user_id": "user-admin",
                "title": "Falha A",
                "description": "Descricao A",
                "created_at": BASE_DATE - timedelta(days=2),
                "updated_at": BASE_DATE - timedelta(days=2),
                "problem_category_id": ids.category_a,
                "embedding": None,
            },
            {
                "id": "problem-2",
                "product_id": ids.product_1,
                "user_id": "user-admin",
                "title": "Falha B",
                "description": "Descricao B",
                "created_at": BASE_DATE - timedelta(days=4),
                "updated_at": BASE_DATE - timedelta(days=4),
                "problem_category_id": ids.category_b,
                "embedding": None,
            },
            {
                "id": "problem-3",
                "product_id": ids.product_1,
                "user_id": "user-admin",
                "title": "Falha C",
                "description": "Descricao C",
                "created_at": BASE_DATE - timedelta(days=10),
                "updated_at": BASE_DATE - timedelta(days=10),
                "problem_category_id": ids.category_a,
                "embedding": None,
            },
        ],
    )

    connection.execute(
        insert(tables["product_solution"]),
        [
            {
                "id": "solution-1",
                "user_id": "user-admin",
                "product_problem_id": "problem-1",
                "description": "Solucao A",
                "reply_id": None,
                "embedding": None,
                "created_at": BASE_DATE - timedelta(days=2),
                "updated_at": BASE_DATE - timedelta(days=2),
            },
            {
                "id": "solution-2",
                "user_id": "user-admin",
                "product_problem_id": "problem-2",
                "description": "Solucao B",
                "reply_id": None,
                "embedding": None,
                "created_at": BASE_DATE - timedelta(days=3),
                "updated_at": BASE_DATE - timedelta(days=3),
            },
        ],
    )

    connection.execute(
        insert(tables["project"]),
        [
            {
                "id": ids.project_1,
                "name": "Projeto Alfa",
                "short_description": "Resumo do projeto alfa",
                "description": "Descricao do projeto alfa",
                "start_date": BASE_DATE - timedelta(days=7),
                "end_date": BASE_DATE + timedelta(days=21),
                "priority": "high",
                "status": "active",
                "created_at": _dt(7, 6),
                "updated_at": _dt(1, 3),
            },
            {
                "id": ids.project_2,
                "name": "Projeto Beta",
                "short_description": "Resumo do projeto beta",
                "description": "Descricao do projeto beta",
                "start_date": BASE_DATE - timedelta(days=80),
                "end_date": BASE_DATE - timedelta(days=60),
                "priority": "low",
                "status": "completed",
                "created_at": _dt(80, 6),
                "updated_at": _dt(60, 3),
            },
        ],
    )

    connection.execute(
        insert(tables["project_task"]),
        [
            {
                "id": "task-1",
                "project_id": ids.project_1,
                "project_activity_id": "activity-group-1",
                "name": "Tarefa 1",
                "description": "Tarefa 1",
                "category": None,
                "estimated_days": 1,
                "start_date": BASE_DATE - timedelta(days=6),
                "end_date": BASE_DATE - timedelta(days=5),
                "priority": "high",
                "status": "done",
                "sort": 1,
                "created_at": _dt(6, 1),
                "updated_at": _dt(5, 1),
            },
            {
                "id": "task-2",
                "project_id": ids.project_1,
                "project_activity_id": "activity-group-1",
                "name": "Tarefa 2",
                "description": "Tarefa 2",
                "category": None,
                "estimated_days": 1,
                "start_date": BASE_DATE - timedelta(days=5),
                "end_date": BASE_DATE - timedelta(days=4),
                "priority": "medium",
                "status": "done",
                "sort": 2,
                "created_at": _dt(5, 1),
                "updated_at": _dt(4, 1),
            },
            {
                "id": "task-3",
                "project_id": ids.project_1,
                "project_activity_id": "activity-group-2",
                "name": "Tarefa 3",
                "description": "Tarefa 3",
                "category": None,
                "estimated_days": 2,
                "start_date": BASE_DATE - timedelta(days=4),
                "end_date": BASE_DATE - timedelta(days=2),
                "priority": "low",
                "status": "todo",
                "sort": 3,
                "created_at": _dt(4, 1),
                "updated_at": _dt(2, 1),
            },
        ],
    )

    return ids


@pytest.fixture()
def dashboard_connection(tmp_path, monkeypatch):
    engine = create_engine(
        f"sqlite+pysqlite:///{tmp_path / 'dashboard.sqlite3'}",
        future=True,
        connect_args={"check_same_thread": False},
    )
    tables = _build_tables()
    tables["product"].metadata.create_all(engine)
    monkeypatch.setattr(dashboard_portal, "legacy_tables", tables)
    with engine.begin() as connection:
        ids = _seed_dashboard_data(connection, tables)

    connection = engine.connect()
    try:
        yield connection, ids
    finally:
        connection.close()


def test_dashboard_portal_queries_cover_aggregates(monkeypatch, dashboard_connection) -> None:
    connection, ids = dashboard_connection
    monkeypatch.setattr(dashboard_portal, "datetime", _FixedDateTime)

    assert dashboard_portal.get_dashboard_root_meta()["sourceKind"] == "dashboard_products"
    assert dashboard_portal.get_dashboard_summary_meta()["denominator"] == "incidentRows"
    assert (
        dashboard_portal.get_dashboard_problems_causes_meta()["sourceKind"]
        == "dashboard_problem_causes"
    )
    assert (
        dashboard_portal.get_dashboard_problems_solutions_meta()["sourceKind"]
        == "dashboard_problem_solutions"
    )
    assert dashboard_portal.get_dashboard_projects_meta()["denominator"] == "taskRows"

    products = dashboard_portal.get_dashboard_data(connection)
    assert len(products) == 1
    product = products[0]
    assert product["productId"] == ids.product_1
    assert product["percent_completed"] == 40
    assert len(product["dates"]) == 5
    assert product["last_run"].startswith("2026-07-21")
    assert product["turns"] == ["00", "06", "12", "18"]

    summary = dashboard_portal.get_dashboard_summary(connection)
    assert summary["recentCount"] == 2
    assert summary["previousCount"] == 1
    assert summary["trend"] == 100.0
    assert [item["name"] for item in summary["topCategories"]] == ["Category A", "Category B"]
    assert [item["count"] for item in summary["topCategories"]] == [1, 1]

    causes = dashboard_portal.get_dashboard_problems_causes(connection)
    assert causes["labels"] == ["Category A", "Category B"]
    assert causes["values"] == [2, 1]
    assert causes["colors"] == ["#ff0000", "#00ff00"]

    problem_series = dashboard_portal.get_dashboard_problems_solutions(connection)
    assert len(problem_series["categories"]) == 28
    assert sum(problem_series["problems"]) == 3
    assert sum(problem_series["solutions"]) == 2

    projects = dashboard_portal.get_dashboard_projects(connection)
    assert len(projects) == 1
    assert projects[0]["projectId"] == ids.project_1
    assert projects[0]["progress"] == 67
    assert projects[0]["daysElapsed"] == 8
    assert projects[0]["time"] == "8 dias"
