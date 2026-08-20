from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from datetime import datetime as real_datetime
from zoneinfo import ZoneInfo

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
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet

from silo.services import report_portal

LOCAL_TZ = ZoneInfo("America/Sao_Paulo")


@dataclass(frozen=True, slots=True)
class _ReportIds:
    product_1: str = "product-1"
    product_2: str = "product-2"
    category_a: str = "category-a"
    category_b: str = "category-b"
    problem_1: str = "problem-1"
    problem_2: str = "problem-2"
    problem_3: str = "problem-3"
    solution_1: str = "solution-1"
    solution_2: str = "solution-2"
    user_active: str = "user-active"
    user_inactive: str = "user-inactive"
    group_default: str = "group-default"
    project_1: str = "project-1"
    project_2: str = "project-2"
    activity_1: str = "project-activity-1"
    activity_2: str = "project-activity-2"
    task_1: str = "task-1"
    task_2: str = "task-2"
    task_3: str = "task-3"
    task_user_1: str = "task-user-1"
    task_user_2: str = "task-user-2"


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
            Column("created_at", DateTime, nullable=False),
            Column("updated_at", DateTime, nullable=False),
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
            Column("created_at", DateTime, nullable=False),
            Column("updated_at", DateTime, nullable=False),
        ),
        "product_solution_checked": Table(
            "product_solution_checked",
            metadata,
            Column("id", String, primary_key=True),
            Column("user_id", String, nullable=False),
            Column("product_solution_id", String, nullable=False),
        ),
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
            Column("description", String, nullable=True),
            Column("icon", String, nullable=True),
            Column("color", String, nullable=True),
            Column("role", String, nullable=False),
            Column("active", Boolean, nullable=False),
            Column("is_default", Boolean, nullable=False),
            Column("created_at", DateTime, nullable=False),
            Column("updated_at", DateTime, nullable=False),
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
    }


def _seed_report_data(connection, tables: dict[str, Table]) -> _ReportIds:  # type: ignore[no-untyped-def]
    ids = _ReportIds()
    now = real_datetime.now(LOCAL_TZ).replace(tzinfo=None, microsecond=0)
    today = now.date()

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
                "available": True,
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
                "created_at": now - timedelta(days=40),
                "updated_at": now - timedelta(days=40),
            },
            {
                "id": ids.category_b,
                "name": "Category B",
                "color": "#00ff00",
                "is_system": False,
                "sort_order": 1,
                "created_at": now - timedelta(days=39),
                "updated_at": now - timedelta(days=39),
            },
        ],
    )

    connection.execute(
        insert(tables["user"]),
        [
            {
                "id": ids.user_active,
                "name": "User Active",
                "email": "active@example.test",
                "email_verified": True,
                "image": None,
                "created_at": now - timedelta(days=30),
                "updated_at": now - timedelta(days=1),
                "is_active": True,
                "last_login": now - timedelta(days=1),
            },
            {
                "id": ids.user_inactive,
                "name": "User Inactive",
                "email": "inactive@example.test",
                "email_verified": False,
                "image": None,
                "created_at": now - timedelta(days=30),
                "updated_at": now - timedelta(days=30),
                "is_active": False,
                "last_login": None,
            },
        ],
    )

    connection.execute(
        insert(tables["group"]),
        [
            {
                "id": ids.group_default,
                "name": "Default",
                "description": "Grupo padrao",
                "icon": "icon-[lucide--users]",
                "color": "#3B82F6",
                "role": "user",
                "active": True,
                "is_default": True,
                "created_at": now - timedelta(days=30),
                "updated_at": now - timedelta(days=1),
            }
        ],
    )

    connection.execute(
        insert(tables["product_activity"]),
        [
            {
                "id": "activity-1",
                "product_id": ids.product_1,
                "user_id": ids.user_active,
                "date": today - timedelta(days=1),
                "turn": 0,
                "status": "completed",
                "problem_category_id": None,
                "description": "Concluido 1",
                "intervention": None,
                "created_at": now - timedelta(days=1, hours=4),
                "updated_at": now - timedelta(days=1, hours=1),
            },
            {
                "id": "activity-2",
                "product_id": ids.product_1,
                "user_id": ids.user_active,
                "date": today - timedelta(days=2),
                "turn": 6,
                "status": "completed",
                "problem_category_id": None,
                "description": "Concluido 2",
                "intervention": None,
                "created_at": now - timedelta(days=2, hours=4),
                "updated_at": now - timedelta(days=2, hours=1),
            },
            {
                "id": "activity-3",
                "product_id": ids.product_1,
                "user_id": ids.user_active,
                "date": today - timedelta(days=3),
                "turn": 12,
                "status": "with_problems",
                "problem_category_id": ids.category_a,
                "description": "Problema recente A",
                "intervention": "Ajuste A",
                "created_at": now - timedelta(days=3, hours=4),
                "updated_at": now - timedelta(days=3, hours=1),
            },
            {
                "id": "activity-4",
                "product_id": ids.product_1,
                "user_id": ids.user_active,
                "date": today - timedelta(days=4),
                "turn": 18,
                "status": "run_again",
                "problem_category_id": ids.category_b,
                "description": "Problema recente B",
                "intervention": "Ajuste B",
                "created_at": now - timedelta(days=4, hours=4),
                "updated_at": now - timedelta(days=4, hours=1),
            },
            {
                "id": "activity-5",
                "product_id": ids.product_1,
                "user_id": ids.user_active,
                "date": today - timedelta(days=8),
                "turn": 0,
                "status": "under_support",
                "problem_category_id": ids.category_a,
                "description": "Problema anterior",
                "intervention": "Ajuste C",
                "created_at": now - timedelta(days=8, hours=4),
                "updated_at": now - timedelta(days=8, hours=1),
            },
            {
                "id": "activity-6",
                "product_id": ids.product_2,
                "user_id": ids.user_active,
                "date": today - timedelta(days=1),
                "turn": 0,
                "status": "completed",
                "problem_category_id": None,
                "description": "Concluido beta",
                "intervention": None,
                "created_at": now - timedelta(days=1, hours=3),
                "updated_at": now - timedelta(days=1, hours=1),
            },
        ],
    )

    connection.execute(
        insert(tables["product_problem"]),
        [
            {
                "id": ids.problem_1,
                "product_id": ids.product_1,
                "user_id": ids.user_active,
                "title": "Falha A",
                "description": "Descricao A",
                "created_at": now - timedelta(days=2),
                "updated_at": now - timedelta(days=2),
                "problem_category_id": ids.category_a,
                "embedding": None,
            },
            {
                "id": ids.problem_2,
                "product_id": ids.product_1,
                "user_id": ids.user_active,
                "title": "Falha B",
                "description": "Descricao B",
                "created_at": now - timedelta(days=4),
                "updated_at": now - timedelta(days=4),
                "problem_category_id": ids.category_b,
                "embedding": None,
            },
            {
                "id": ids.problem_3,
                "product_id": ids.product_1,
                "user_id": ids.user_active,
                "title": "Falha C",
                "description": "Descricao C",
                "created_at": now - timedelta(days=10),
                "updated_at": now - timedelta(days=10),
                "problem_category_id": ids.category_a,
                "embedding": None,
            },
        ],
    )

    connection.execute(
        insert(tables["product_solution"]),
        [
            {
                "id": ids.solution_1,
                "user_id": ids.user_active,
                "product_problem_id": ids.problem_1,
                "description": "Solucao A",
                "reply_id": None,
                "embedding": None,
                "created_at": now - timedelta(days=2, hours=1),
                "updated_at": now - timedelta(days=2, hours=1),
            },
            {
                "id": ids.solution_2,
                "user_id": ids.user_active,
                "product_problem_id": ids.problem_2,
                "description": "Solucao B",
                "reply_id": None,
                "embedding": None,
                "created_at": now - timedelta(days=3, hours=1),
                "updated_at": now - timedelta(days=3, hours=1),
            },
        ],
    )

    connection.execute(
        insert(tables["product_solution_checked"]),
        [
            {
                "id": "checked-1",
                "user_id": ids.user_active,
                "product_solution_id": ids.solution_1,
            }
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
                "start_date": today - timedelta(days=7),
                "end_date": today + timedelta(days=21),
                "priority": "high",
                "status": "active",
                "created_at": now - timedelta(days=7),
                "updated_at": now - timedelta(days=1),
            },
            {
                "id": ids.project_2,
                "name": "Projeto Beta",
                "short_description": "Resumo do projeto beta",
                "description": "Descricao do projeto beta",
                "start_date": today - timedelta(days=80),
                "end_date": today - timedelta(days=60),
                "priority": "low",
                "status": "completed",
                "created_at": now - timedelta(days=80),
                "updated_at": now - timedelta(days=60),
            },
        ],
    )

    connection.execute(
        insert(tables["project_activity"]),
        [
            {
                "id": ids.activity_1,
                "project_id": ids.project_1,
                "name": "Atividade 1",
                "description": "Atividade 1",
                "category": "analysis",
                "estimated_days": 3,
                "start_date": today - timedelta(days=6),
                "end_date": today - timedelta(days=3),
                "priority": "high",
                "status": "active",
                "created_at": now - timedelta(days=6),
                "updated_at": now - timedelta(days=3),
            },
            {
                "id": ids.activity_2,
                "project_id": ids.project_1,
                "name": "Atividade 2",
                "description": "Atividade 2",
                "category": "delivery",
                "estimated_days": 2,
                "start_date": today - timedelta(days=4),
                "end_date": today - timedelta(days=1),
                "priority": "medium",
                "status": "done",
                "created_at": now - timedelta(days=4),
                "updated_at": now - timedelta(days=1),
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
                "description": "Tarefa 1",
                "category": None,
                "estimated_days": 1,
                "start_date": today - timedelta(days=6),
                "end_date": today - timedelta(days=5),
                "priority": "high",
                "status": "done",
                "sort": 1,
                "created_at": now - timedelta(days=6),
                "updated_at": now - timedelta(days=5),
            },
            {
                "id": ids.task_2,
                "project_id": ids.project_1,
                "project_activity_id": ids.activity_1,
                "name": "Tarefa 2",
                "description": "Tarefa 2",
                "category": None,
                "estimated_days": 1,
                "start_date": today - timedelta(days=5),
                "end_date": today - timedelta(days=4),
                "priority": "medium",
                "status": "done",
                "sort": 2,
                "created_at": now - timedelta(days=5),
                "updated_at": now - timedelta(days=4),
            },
            {
                "id": ids.task_3,
                "project_id": ids.project_1,
                "project_activity_id": ids.activity_2,
                "name": "Tarefa 3",
                "description": "Tarefa 3",
                "category": None,
                "estimated_days": 2,
                "start_date": today - timedelta(days=4),
                "end_date": today - timedelta(days=2),
                "priority": "low",
                "status": "todo",
                "sort": 3,
                "created_at": now - timedelta(days=4),
                "updated_at": now - timedelta(days=2),
            },
        ],
    )

    connection.execute(
        insert(tables["project_task_user"]),
        [
            {
                "id": ids.task_user_1,
                "task_id": ids.task_1,
                "user_id": ids.user_active,
                "role": "assignee",
                "assigned_at": now - timedelta(days=6),
                "created_at": now - timedelta(days=6),
            },
            {
                "id": ids.task_user_2,
                "task_id": ids.task_2,
                "user_id": ids.user_active,
                "role": "assignee",
                "assigned_at": now - timedelta(days=5),
                "created_at": now - timedelta(days=5),
            },
        ],
    )

    return ids


@pytest.fixture()
def report_connection(tmp_path, monkeypatch):
    engine = create_engine(
        f"sqlite+pysqlite:///{tmp_path / 'report.sqlite3'}",
        future=True,
        connect_args={"check_same_thread": False},
    )
    tables = _build_tables()
    tables["product"].metadata.create_all(engine)
    monkeypatch.setattr(report_portal, "legacy_tables", tables)

    with engine.begin() as connection:
        ids = _seed_report_data(connection, tables)

    connection = engine.connect()
    try:
        yield connection, ids
    finally:
        connection.close()


def test_report_portal_helpers_and_reports(report_connection) -> None:
    connection, ids = report_connection

    today = report_portal.get_today()
    assert report_portal.parse_period({}) == {
        "start": (date.fromisoformat(today) - timedelta(days=29)).isoformat(),
        "end": today,
    }
    assert report_portal.parse_period({"dateRange": "7d"}) == {
        "start": (date.fromisoformat(today) - timedelta(days=6)).isoformat(),
        "end": today,
    }
    assert (
        report_portal.get_availability_report_meta({"start": today, "end": today})["sourceKind"]
        == "availability_report"
    )
    assert (
        report_portal.get_problems_report_meta({"start": today, "end": today})["denominator"]
        == "totalProblems"
    )
    assert (
        report_portal.get_executive_report_meta({"start": today, "end": today})["denominator"]
        == "mixed"
    )
    assert (
        report_portal.get_projects_report_meta({"start": today, "end": today})["denominator"]
        == "totalTasks"
    )

    availability = report_portal.get_availability_report(
        connection,
        {"start": (date.fromisoformat(today) - timedelta(days=30)).isoformat(), "end": today},
    )
    assert availability["totalProducts"] == 2
    assert availability["avgAvailability"] == 70.0
    assert availability["totalInterventions"] == 3
    assert availability["products"][0]["status"] == "critical"

    problems = report_portal.get_problems_report(
        connection,
        {"start": (date.fromisoformat(today) - timedelta(days=30)).isoformat(), "end": today},
    )
    assert problems["totalProblems"] == 3
    assert problems["summary"]["totalSolutions"] == 2
    assert len(problems["topProblems"]) == 3
    assert [item["name"] for item in problems["problemsByCategory"]] == ["Category A", "Category B"]

    executive = report_portal.get_executive_report(
        connection,
        {"start": (date.fromisoformat(today) - timedelta(days=30)).isoformat(), "end": today},
    )
    assert executive["summary"]["totalProducts"] == 2
    assert executive["summary"]["totalProblems"] == 3
    assert executive["summary"]["totalSolutions"] == 2
    assert executive["summary"]["activeProjects"] == 1
    assert executive["summary"]["completedTasks"] == 2
    assert executive["summary"]["avgAvailability"] == 70.0
    assert executive["projectsByStatus"] == {"active": 1, "completed": 1}
    assert executive["productMetrics"][0]["productId"] == ids.product_1
    assert executive["productMetrics"][0]["availabilityPercentage"] == 40.0
    assert executive["productMetrics"][1]["availabilityPercentage"] == 100.0
    assert executive["topProducts"][0]["productId"] == ids.product_1

    with pytest.raises(report_portal.UnsupportedReportFilterError):
        report_portal.get_executive_report(
            connection,
            {"start": (date.fromisoformat(today) - timedelta(days=30)).isoformat(), "end": today},
            group_id=ids.group_default,
        )

    projects = report_portal.get_projects_report(
        connection,
        {"start": (date.fromisoformat(today) - timedelta(days=30)).isoformat(), "end": today},
    )
    assert projects["summary"]["totalProjects"] == 1
    assert projects["summary"]["totalActivities"] == 2
    assert projects["summary"]["totalTasks"] == 3
    assert projects["summary"]["activeUsers"] == 1
    assert projects["summary"]["avgProgress"] == 67
    assert projects["projects"][0]["progress"] == 67
    assert projects["tasksByStatus"] == {"done": 2, "todo": 1}
    assert projects["projectsByStatus"] == {"active": 1}


def test_availability_report_without_activity_data_marks_no_data(tmp_path, monkeypatch) -> None:
    database_path = tmp_path / "report-empty.sqlite"
    engine = create_engine(f"sqlite+pysqlite:///{database_path.as_posix()}", future=True)
    tables = _build_tables()
    tables["product"].metadata.create_all(engine)
    monkeypatch.setattr(report_portal, "legacy_tables", tables)

    today = report_portal.get_today()
    with engine.begin() as connection:
        connection.execute(
            insert(tables["product"]),
            [
                {
                    "id": "product-sem-dados",
                    "name": "Produto Sem Dados",
                    "slug": "produto-sem-dados",
                    "available": True,
                    "priority": "high",
                    "turns": ["00"],
                    "description": None,
                    "url_product_flow": None,
                    "data_product_flow": [],
                }
            ],
        )

    with engine.connect() as connection:
        availability = report_portal.get_availability_report(
            connection,
            {"start": (date.fromisoformat(today) - timedelta(days=30)).isoformat(), "end": today},
        )
        assert availability["totalProducts"] == 1
        assert availability["avgAvailability"] is None
        assert availability["products"][0]["status"] == "no_data"
        assert availability["products"][0]["availabilityPercentage"] is None
        assert availability["products"][0]["totalActivities"] == 0

        executive = report_portal.get_executive_report(
            connection,
            {"start": (date.fromisoformat(today) - timedelta(days=30)).isoformat(), "end": today},
        )
        assert executive["summary"]["avgAvailability"] is None

        problems = report_portal.get_problems_report(
            connection,
            {"start": (date.fromisoformat(today) - timedelta(days=30)).isoformat(), "end": today},
        )
        assert problems["totalProblems"] == 0
        assert problems["avgResolutionHours"] is None
        assert problems["summary"]["averageResolutionHours"] is None

    engine.dispose()


def test_report_portal_pdf_builders_and_auxiliary_helpers(report_connection, tmp_path, monkeypatch) -> None:
    connection, _ids = report_connection
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="SiloSection", parent=styles["Heading2"]))

    story: list[object] = []
    report_portal._build_availability_pdf(  # noqa: SLF001
        story,
        {
            "totalProducts": 2,
            "avgAvailability": 70.0,
            "totalInterventions": 3,
            "products": [
                {"name": "Produto Alfa", "availabilityPercentage": 80, "totalActivities": 5, "completedActivities": 4, "status": "stable"},
                {"name": "Produto Beta", "availabilityPercentage": 40, "totalActivities": 5, "completedActivities": 2, "status": "critical"},
            ],
        },
        styles,
    )
    report_portal._build_problems_pdf(  # noqa: SLF001
        story,
        {
            "summary": {"totalProblems": 3, "averageResolutionHours": 7.5},
            "problemsByCategory": [{"name": "Categoria A", "problemsCount": 2, "avgResolutionHours": 5}],
            "topProblems": [
                {"title": "Problema 1", "product": {"name": "Produto Alfa"}, "category": {"name": "Categoria A"}, "solutionsCount": 1}
            ],
        },
        styles,
    )
    report_portal._build_executive_pdf(  # noqa: SLF001
        story,
        {
            "summary": {"totalProducts": 2, "totalProblems": 3, "activeProjects": 1, "completedTasks": 2},
            "trends": {"problems": {"current": 2, "previous": 1, "change": 100}, "solutions": {"current": 5, "previous": 4, "change": 25}},
            "productMetrics": [{"name": "Produto Alfa", "priority": "high", "totalProblems": 2, "totalSolutions": 1, "available": True}],
        },
        styles,
    )
    report_portal._build_projects_pdf(  # noqa: SLF001
        story,
        {
            "summary": {"totalProjects": 1, "totalActivities": 2, "totalTasks": 3, "avgProgress": 67},
            "projectsByStatus": {"active": 1},
            "tasksByStatus": {"done": 2, "todo": 1},
            "projects": [{"name": "Projeto A", "progress": 67, "status": "active"}],
        },
        styles,
    )

    assert any(getattr(item, "text", "") == "Visão Geral" for item in story if hasattr(item, "text"))
    assert report_portal._status_pt("unknown") == "unknown"  # noqa: SLF001
    assert report_portal.parse_period({"start": "2026-08-01", "end": "2026-08-04"}) == {"start": "2026-08-01", "end": "2026-08-04"}
    assert report_portal.parse_period({"dateRange": "90d"})["start"] <= report_portal.parse_period({"dateRange": "90d"})["end"]

    monkeypatch.setattr(report_portal, "list_upload_files", lambda kind: [{"kind": kind, "filename": "report.pdf"}, {"kind": kind, "filename": "ignored.txt"}])
    assert report_portal.list_report_files() == [{"kind": "reports", "filename": "report.pdf"}]
