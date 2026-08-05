from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy import and_, select
from sqlalchemy.engine import Connection

from silo.db.models import legacy_tables
from silo.domain.model_run_status import PROBLEM_STATUSES
from silo.services.analytics_common import (
    ANALYTICS_TIMEZONE,
    build_analytics_meta,
    format_br_day_short,
    format_local_date_text,
    format_local_datetime_text,
    is_incident_status,
    normalize_shift_turns,
)
from silo.services.legacy_utils import optional_str

NO_INCIDENTS_CATEGORY_ID = "no_incidents"
PROBLEM_INCIDENT_STATUSES = tuple(sorted(PROBLEM_STATUSES))


def get_dashboard_root_meta() -> dict[str, object]:
    today = datetime.now(ANALYTICS_TIMEZONE).date()
    start = today - timedelta(days=60)
    return build_analytics_meta(
        source_kind="dashboard_products",
        range_start=start.isoformat(),
        range_end=today.isoformat(),
        denominator="productActivityRows",
        rounding=0,
        complete=True,
    )


def get_dashboard_summary_meta() -> dict[str, object]:
    today = datetime.now(ANALYTICS_TIMEZONE).date()
    start = today - timedelta(days=14)
    return build_analytics_meta(
        source_kind="dashboard_summary",
        range_start=start.isoformat(),
        range_end=today.isoformat(),
        denominator="incidentRows",
        rounding=0,
        complete=True,
    )


def get_dashboard_problems_causes_meta() -> dict[str, object]:
    today = datetime.now(ANALYTICS_TIMEZONE).date()
    start = today - timedelta(days=27)
    return build_analytics_meta(
        source_kind="dashboard_problem_causes",
        range_start=start.isoformat(),
        range_end=today.isoformat(),
        denominator="incidentRows",
        rounding=0,
        complete=True,
    )


def get_dashboard_problems_solutions_meta() -> dict[str, object]:
    today = datetime.now(ANALYTICS_TIMEZONE).date()
    start = today - timedelta(days=27)
    return build_analytics_meta(
        source_kind="dashboard_problem_solutions",
        range_start=start.isoformat(),
        range_end=today.isoformat(),
        denominator="problemRows",
        rounding=0,
        complete=True,
    )


def get_dashboard_projects_meta() -> dict[str, object]:
    return build_analytics_meta(
        source_kind="dashboard_projects",
        range_start=None,
        range_end=None,
        denominator="taskRows",
        rounding=0,
        complete=True,
    )


def get_dashboard_data(connection: Connection) -> list[dict[str, object]]:
    product_table = legacy_tables["product"]
    activity_table = legacy_tables["product_activity"]

    products = connection.execute(
        select(product_table).where(product_table.c.available.is_(True))
    ).mappings().all()
    if not products:
        return []

    cutoff = (datetime.now(ANALYTICS_TIMEZONE) - timedelta(days=60)).date()
    activity_rows = connection.execute(
        select(activity_table)
        .where(activity_table.c.date >= cutoff)
        .order_by(activity_table.c.date.asc(), activity_table.c.turn.asc(), activity_table.c.id.asc())
    ).mappings().all()

    grouped: dict[str, dict[str, object]] = {}
    for product in products:
        grouped[str(product["id"])] = {
            "productId": str(product["id"]),
            "name": product["name"],
            "priority": product["priority"],
            "turns": normalize_shift_turns(product["turns"]),
            "last_run": None,
            "percent_completed": 0,
            "dates": [],
        }

    for row in activity_rows:
        product_id = str(row["product_id"])
        item = grouped.get(product_id)
        if item is None:
            continue

        date_text = row["date"].isoformat() if isinstance(row["date"], date) else format_local_date_text(row["date"])
        item["dates"].append(
            {
                "id": str(row["id"]),
                "date": date_text,
                "turn": int(row["turn"]),
                "user_id": str(row["user_id"]),
                "status": row["status"],
                "description": row.get("description"),
                "intervention": row.get("intervention"),
                "category_id": row.get("problem_category_id"),
                "alert": is_incident_status(row.get("status")),
            }
        )

        last_run = format_local_datetime_text(row.get("updated_at"))
        if last_run is not None and (item["last_run"] is None or last_run > item["last_run"]):
            item["last_run"] = last_run

    recent_cutoff = (datetime.now(ANALYTICS_TIMEZONE) - timedelta(days=28)).date()
    for item in grouped.values():
        last_28 = [row for row in item["dates"] if isinstance(row.get("date"), str) and row["date"] >= recent_cutoff.isoformat()]
        completed = sum(1 for row in last_28 if row.get("status") == "completed")
        item["percent_completed"] = round((completed / len(last_28)) * 100) if last_28 else 0

    return list(grouped.values())


def get_dashboard_summary(connection: Connection) -> dict[str, object]:
    activity_table = legacy_tables["product_activity"]
    category_table = legacy_tables["product_problem_category"]

    date_7 = (datetime.now(ANALYTICS_TIMEZONE) - timedelta(days=7)).date()
    date_14 = (datetime.now(ANALYTICS_TIMEZONE) - timedelta(days=14)).date()

    rows = connection.execute(
        select(activity_table.c.date, activity_table.c.problem_category_id)
        .where(
            and_(
                activity_table.c.date >= date_14,
                activity_table.c.problem_category_id.is_not(None),
                activity_table.c.problem_category_id != NO_INCIDENTS_CATEGORY_ID,
                activity_table.c.status.in_(PROBLEM_INCIDENT_STATUSES),
            )
        )
    ).mappings().all()

    recent_count = 0
    previous_count = 0
    recent_category_counts: dict[str, int] = {}
    for row in rows:
        category_id = str(row["problem_category_id"])
        if row["date"] >= date_7:
            recent_count += 1
            recent_category_counts[category_id] = recent_category_counts.get(category_id, 0) + 1
        else:
            previous_count += 1

    top_categories: list[dict[str, object]] = []
    if recent_category_counts:
        cat_rows = connection.execute(
            select(category_table.c.id, category_table.c.name)
            .where(category_table.c.id.in_(tuple(recent_category_counts.keys())))
            .order_by(category_table.c.name.asc(), category_table.c.id.asc())
        ).mappings().all()
        for category in cat_rows:
            top_categories.append(
                {
                    "name": category["name"],
                    "count": recent_category_counts.get(str(category["id"]), 0),
                }
            )
        top_categories.sort(key=lambda item: (-int(item["count"]), str(item["name"])))
        top_categories = top_categories[:5]

    trend = None if previous_count == 0 else ((recent_count - previous_count) / previous_count) * 100
    return {
        "recentCount": recent_count,
        "previousCount": previous_count,
        "trend": trend,
        "topCategories": top_categories,
    }


def get_dashboard_problems_causes(connection: Connection) -> dict[str, object]:
    activity_table = legacy_tables["product_activity"]
    category_table = legacy_tables["product_problem_category"]

    cutoff = (datetime.now(ANALYTICS_TIMEZONE) - timedelta(days=28)).date()
    rows = connection.execute(
        select(activity_table.c.problem_category_id)
        .where(
            and_(
                activity_table.c.date >= cutoff,
                activity_table.c.problem_category_id.is_not(None),
                activity_table.c.problem_category_id != NO_INCIDENTS_CATEGORY_ID,
            )
        )
    ).all()

    counts: dict[str, int] = {}
    for row in rows:
        category_id = str(row[0])
        counts[category_id] = counts.get(category_id, 0) + 1

    if not counts:
        return {"labels": [], "values": [], "colors": []}

    category_rows = connection.execute(
        select(category_table.c.id, category_table.c.name, category_table.c.color)
        .where(category_table.c.id.in_(tuple(counts.keys())))
        .order_by(category_table.c.name.asc(), category_table.c.id.asc())
    ).mappings().all()

    ordered = sorted(
        category_rows,
        key=lambda row: (-counts.get(str(row["id"]), 0), str(row["name"])),
    )
    return {
        "labels": [str(row["name"]) for row in ordered],
        "values": [counts.get(str(row["id"]), 0) for row in ordered],
        "colors": [row.get("color") for row in ordered],
    }


def get_dashboard_problems_solutions(connection: Connection) -> dict[str, object]:
    problem_table = legacy_tables["product_problem"]
    solution_table = legacy_tables["product_solution"]

    total_days = 28
    today = datetime.now(ANALYTICS_TIMEZONE).date()
    start = today - timedelta(days=total_days - 1)

    problem_rows = connection.execute(
        select(problem_table.c.created_at).where(problem_table.c.created_at >= datetime.combine(start, datetime.min.time()))
    ).all()
    solution_rows = connection.execute(
        select(solution_table.c.updated_at).where(solution_table.c.updated_at >= datetime.combine(start, datetime.min.time()))
    ).all()

    categories = [
        format_br_day_short(start + timedelta(days=index))
        for index in range(total_days)
    ]
    problems_counts = [0] * total_days
    solutions_counts = [0] * total_days

    for row in problem_rows:
        index = _day_index(start, row[0])
        if index is not None:
            problems_counts[index] += 1

    for row in solution_rows:
        index = _day_index(start, row[0])
        if index is not None:
            solutions_counts[index] += 1

    return {
        "categories": categories,
        "problems": problems_counts,
        "solutions": solutions_counts,
    }


def get_dashboard_projects(connection: Connection) -> list[dict[str, object]]:
    project_table = legacy_tables["project"]
    task_table = legacy_tables["project_task"]

    active_projects = connection.execute(
        select(project_table)
        .where(project_table.c.status == "active")
        .order_by(project_table.c.name.asc(), project_table.c.id.asc())
    ).mappings().all()
    if not active_projects:
        return []

    project_ids = [str(row["id"]) for row in active_projects]
    tasks = connection.execute(
        select(task_table.c.project_id, task_table.c.status)
        .where(task_table.c.project_id.in_(tuple(project_ids)))
    ).mappings().all()

    summary: dict[str, dict[str, int]] = {project_id: {"total": 0, "done": 0} for project_id in project_ids}
    for task in tasks:
        project_id = str(task["project_id"])
        project_summary = summary.get(project_id)
        if project_summary is None:
            continue
        project_summary["total"] += 1
        if task["status"] == "done":
            project_summary["done"] += 1

    today = datetime.now(ANALYTICS_TIMEZONE)
    result: list[dict[str, object]] = []
    for project in active_projects:
        aggregate = summary.get(str(project["id"]), {"total": 0, "done": 0})
        progress = round((aggregate["done"] / aggregate["total"]) * 100) if aggregate["total"] > 0 else 0
        if isinstance(project.get("start_date"), date):
            start_date = datetime.combine(project["start_date"], datetime.min.time(), tzinfo=ANALYTICS_TIMEZONE)
            days_elapsed = max(1, round((today - start_date).total_seconds() / 86_400))
        else:
            days_elapsed = 0
        result.append(
            {
                "projectId": str(project["id"]),
                "name": project["name"],
                "shortDescription": project["short_description"],
                "progress": progress,
                "daysElapsed": days_elapsed,
                "time": f"{days_elapsed} dias",
            }
        )
    return result


def _day_index(start: date, value: object) -> int | None:
    if isinstance(value, datetime):
        current_date = value.astimezone(ANALYTICS_TIMEZONE).date() if value.tzinfo is not None else value.date()
    elif isinstance(value, date):
        current_date = value
    elif isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            current_date = datetime.fromisoformat(text.replace("Z", "+00:00")).astimezone(ANALYTICS_TIMEZONE).date()
        except ValueError:
            return None
    else:
        return None

    diff = (current_date - start).days
    return diff if 0 <= diff < 28 else None
