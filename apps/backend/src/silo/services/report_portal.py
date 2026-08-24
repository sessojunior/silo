from __future__ import annotations

from collections.abc import Iterable
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle
from sqlalchemy import and_, desc, select
from sqlalchemy.engine import Connection

from silo.date import format_date, format_date_br, get_days_ago, get_today
from silo.db.models import legacy_tables
from silo.domain.model_run_status import PROBLEM_STATUSES
from silo.services.analytics_common import (
    ANALYTICS_TIMEZONE,
    build_analytics_meta,
    format_local_datetime_text,
)
from silo.services.common import service_failure, service_success
from silo.services.legacy_utils import normalize_turn_list, optional_str
from silo.services.pdf_artifacts import PdfArtifactStore, PdfArtifactTooLargeError, PdfRenderer
from silo.storage.uploads import list_upload_files

NO_INCIDENTS_CATEGORY_ID = "no-incidents"
PROBLEM_INCIDENT_STATUSES = tuple(sorted(PROBLEM_STATUSES))


class UnsupportedReportFilterError(ValueError):
    pass


def parse_period(query: dict[str, object | None]) -> dict[str, str]:
    start = _optional_text(query.get("start")) or _optional_text(query.get("startDate"))
    end = _optional_text(query.get("end")) or _optional_text(query.get("endDate"))
    date_range = _optional_text(query.get("dateRange")) or "30d"

    if start and end:
        return {"start": format_date(start), "end": format_date(end)}

    if date_range == "7d":
        days = 7
    elif date_range == "90d":
        days = 90
    else:
        days = 30

    end_value = format_date(end or get_today())
    end_date = datetime.fromisoformat(end_value)
    start_date = end_date - timedelta(days=max(1, days) - 1)
    return {"start": start_date.date().isoformat(), "end": end_value}


def get_availability_report_meta(date_range: dict[str, str]) -> dict[str, object]:
    return build_analytics_meta(
        source_kind="availability_report",
        range_start=date_range["start"],
        range_end=date_range["end"],
        denominator="totalActivities",
        rounding=1,
        complete=True,
    )


def get_problems_report_meta(date_range: dict[str, str]) -> dict[str, object]:
    return build_analytics_meta(
        source_kind="problems_report",
        range_start=date_range["start"],
        range_end=date_range["end"],
        denominator="totalProblems",
        rounding=1,
        complete=True,
    )


def get_executive_report_meta(date_range: dict[str, str]) -> dict[str, object]:
    return build_analytics_meta(
        source_kind="executive_report",
        range_start=date_range["start"],
        range_end=date_range["end"],
        denominator="mixed",
        rounding=1,
        complete=True,
    )


def get_projects_report_meta(date_range: dict[str, str]) -> dict[str, object]:
    return build_analytics_meta(
        source_kind="projects_report",
        range_start=date_range["start"],
        range_end=date_range["end"],
        denominator="totalTasks",
        rounding=0,
        complete=True,
    )


def get_availability_report(connection: Connection, date_range: dict[str, str]) -> dict[str, object]:
    product_table = legacy_tables["product"]
    activity_table = legacy_tables["product_activity"]

    products = connection.execute(select(product_table).order_by(product_table.c.name.asc())).mappings().all()
    if not products:
        return {
            "totalProducts": 0,
            "avgAvailability": 0,
            "totalInterventions": 0,
            "products": [],
        }

    start = parse_date_only(date_range["start"])
    end = parse_date_only(date_range["end"])
    all_activities = connection.execute(
        select(activity_table)
        .where(and_(activity_table.c.date >= start, activity_table.c.date <= end))
    ).mappings().all()

    activities_by_product: dict[str, list[dict[str, object]]] = {}
    for activity in all_activities:
        activities_by_product.setdefault(str(activity["product_id"]), []).append(activity)

    products_with_availability: list[dict[str, object]] = []
    for product in products:
        activities = activities_by_product.get(str(product["id"]), [])
        total_activities = len(activities)
        completed_activities = sum(1 for row in activities if row["status"] == "completed")
        active_activities = sum(1 for row in activities if row["status"] == "in_progress")
        failed_activities = sum(1 for row in activities if str(row["status"]) in PROBLEM_INCIDENT_STATUSES)
        interventions_count = sum(1 for row in activities if _has_text(row.get("intervention")))
        availability_percentage = None
        status = "no_data"
        if total_activities > 0:
            availability_percentage = round((completed_activities / total_activities) * 100, 1)
            if availability_percentage < 50:
                status = "critical"
            elif availability_percentage < 70:
                status = "warning"
            elif availability_percentage < 90:
                status = "stable"
            else:
                status = "active"

        intervention_rows = [row for row in activities if _has_text(row.get("intervention"))]
        latest_intervention_at = None
        latest_intervention_text = None
        if intervention_rows:
            latest = max(intervention_rows, key=lambda row: row["updated_at"])
            latest_intervention_at = latest["date"].isoformat() if isinstance(latest["date"], date) else str(latest["date"])
            latest_intervention_text = latest.get("intervention")

        last_activity_date = None
        if activities:
            latest_activity = max(activities, key=lambda row: row["date"])
            last_activity_date = latest_activity["date"].isoformat() if isinstance(latest_activity["date"], date) else str(latest_activity["date"])

        item = {
            "id": str(product["id"]),
            "name": product["name"],
            "slug": product["slug"],
            "description": product.get("description"),
            "status": status,
            "totalActivities": total_activities,
            "completedActivities": completed_activities,
            "activeActivities": active_activities,
            "failedActivities": failed_activities,
            "interventionsCount": interventions_count,
            "latestInterventionAt": latest_intervention_at,
            "latestInterventionText": latest_intervention_text,
            "availabilityPercentage": availability_percentage,
            "lastActivityDate": last_activity_date,
            "lastActivity": last_activity_date,
        }
        products_with_availability.append(item)

    total_products = len(products_with_availability)
    products_with_data = [
        product for product in products_with_availability
        if product["availabilityPercentage"] is not None
    ]
    avg_availability = (
        round(
            sum(float(product["availabilityPercentage"]) for product in products_with_data)
            / len(products_with_data),
            1,
        )
        if products_with_data
        else None
    )
    total_interventions = sum(int(product["interventionsCount"]) for product in products_with_availability)

    return {
        "totalProducts": total_products,
        "avgAvailability": avg_availability,
        "totalInterventions": total_interventions,
        "products": products_with_availability,
    }


def get_problems_report(
    connection: Connection,
    date_range: dict[str, str],
    product_id: str | None = None,
    problem_category: str | None = None,
) -> dict[str, object]:
    problem_table = legacy_tables["product_problem"]
    category_table = legacy_tables["product_problem_category"]
    solution_table = legacy_tables["product_solution"]
    solution_checked_table = legacy_tables["product_solution_checked"]
    product_table = legacy_tables["product"]
    user_table = legacy_tables["user"]

    start = parse_date_only(date_range["start"])
    end = parse_date_only(date_range["end"])

    problem_filters = [
        problem_table.c.created_at >= datetime.combine(start, datetime.min.time()),
        problem_table.c.created_at <= datetime.combine(end, datetime.max.time().replace(microsecond=0)),
        problem_table.c.problem_category_id != NO_INCIDENTS_CATEGORY_ID,
    ]
    if product_id:
        problem_filters.append(problem_table.c.product_id == product_id)
    if problem_category:
        problem_filters.append(problem_table.c.problem_category_id == problem_category)

    problems = connection.execute(
        select(
            problem_table.c.id,
            problem_table.c.product_id,
            problem_table.c.user_id,
            problem_table.c.title,
            problem_table.c.description,
            problem_table.c.created_at,
            problem_table.c.updated_at,
            problem_table.c.problem_category_id,
        )
        .where(and_(*problem_filters))
        .order_by(problem_table.c.created_at.asc(), problem_table.c.id.asc())
    ).mappings().all()

    categories = connection.execute(
        select(category_table.c.id, category_table.c.name, category_table.c.color)
        .where(category_table.c.id != NO_INCIDENTS_CATEGORY_ID)
        .order_by(category_table.c.name.asc())
    ).mappings().all()

    solutions_by_problem = _group_solutions(connection, [str(row["id"]) for row in problems], solution_table)
    solution_ids = [
        str(solution["id"])
        for grouped_solutions in solutions_by_problem.values()
        for solution in grouped_solutions
    ]
    checked_solution_ids = {
        str(row[0])
        for row in connection.execute(
            select(solution_checked_table.c.product_solution_id)
            .where(
                solution_checked_table.c.product_solution_id.in_(tuple(solution_ids))
                if solution_ids
                else False
            )
        ).all()
    }

    problems_by_category: list[dict[str, object]] = []
    for category in categories:
        category_problems = [problem for problem in problems if str(problem["problem_category_id"]) == str(category["id"])]
        if not category_problems:
            continue
        resolution_hours = _average_resolution_hours(category_problems, solutions_by_problem)
        problems_by_category.append(
            {
                "id": str(category["id"]),
                "name": category["name"],
                "color": category.get("color") or "#6b7280",
                "problemsCount": len(category_problems),
                "avgResolutionHours": resolution_hours,
            }
        )

    products_by_problem: list[dict[str, object]] = []
    product_rows = connection.execute(
        select(product_table.c.id, product_table.c.name, product_table.c.slug).order_by(product_table.c.name.asc())
    ).mappings().all()
    for product in product_rows:
        product_problems = [problem for problem in problems if str(problem["product_id"]) == str(product["id"])]
        if not product_problems:
            continue
        resolved_count = 0
        for problem in product_problems:
            for solution in solutions_by_problem.get(str(problem["id"]), []):
                if str(solution["id"]) in checked_solution_ids:
                    resolved_count += 1
                    break
        products_by_problem.append(
            {
                "id": str(product["id"]),
                "name": product["name"],
                "slug": product["slug"],
                "problemsCount": len(product_problems),
                "resolvedCount": resolved_count,
                "resolutionRate": round((resolved_count / len(product_problems)) * 100) if product_problems else 0,
            }
        )

    total_problems = len(problems)
    total_solutions = sum(len(solutions_by_problem.get(problem_id, [])) for problem_id in solutions_by_problem)
    avg_resolution_hours = (
        round(
            sum(item["avgResolutionHours"] for item in problems_by_category) / len(problems_by_category),
            1,
        )
        if problems_by_category
        else None
    )

    top_problem_candidates = sorted(problems, key=lambda problem: str(problem["id"]))
    top_problem_candidates.sort(key=lambda problem: problem["created_at"], reverse=True)
    top_problem_ids = [str(problem["id"]) for problem in top_problem_candidates[:5]]
    top_problems = []
    if top_problem_ids:
        top_problem_lookup = {str(problem["id"]): problem for problem in problems}
        for problem_id_value in top_problem_ids:
            problem = top_problem_lookup[problem_id_value]
            product_info = next((row for row in product_rows if str(row["id"]) == str(problem["product_id"])), None)
            category_info = next((row for row in categories if str(row["id"]) == str(problem["problem_category_id"])), None)
            solution_rows = solutions_by_problem.get(problem_id_value, [])
            earliest_solution = min(solution_rows, key=lambda row: row["created_at"]) if solution_rows else None
            avg_problem_hours = None
            if earliest_solution is not None and isinstance(problem["created_at"], datetime):
                avg_problem_hours = round(
                    (earliest_solution["created_at"] - problem["created_at"]).total_seconds() / 3_600,
                    1,
                )
            top_problems.append(
                {
                    "id": problem_id_value,
                    "title": problem["title"],
                    "description": problem.get("description"),
                    "createdAt": problem["created_at"].isoformat(),
                    "updatedAt": problem["updated_at"].isoformat(),
                    "product": {
                        "name": product_info["name"] if product_info else "Produto",
                        "slug": product_info["slug"] if product_info else "produto",
                    },
                    "category": {
                        "name": category_info["name"] if category_info else "Sem categoria",
                        "color": category_info.get("color") if category_info else "#6b7280",
                    },
                    "reportedBy": _user_name(connection, str(problem["user_id"])) or "Usuário",
                    "userInfo": {
                        "name": _user_name(connection, str(problem["user_id"])) or "Usuário",
                        "image": _user_image(connection, str(problem["user_id"])) or "/images/profile.png",
                    },
                    "solutionsCount": len(solution_rows),
                    "avgResolutionHours": avg_problem_hours,
                    "categoryName": category_info["name"] if category_info else "Sem categoria",
                    "categoryColor": category_info.get("color") if category_info else "#6b7280",
                }
            )

    return {
        "totalProblems": total_problems,
        "avgResolutionHours": avg_resolution_hours,
        "topProblems": top_problems,
        "problemsByCategory": problems_by_category,
        "problemsByProduct": products_by_problem,
        "categories": problems_by_category,
        "summary": {
            "totalProblems": total_problems,
            "totalSolutions": total_solutions,
            "averageResolutionHours": avg_resolution_hours,
        },
    }


def get_executive_report(
    connection: Connection,
    date_range: dict[str, str],
    product_id: str | None = None,
    group_id: str | None = None,
) -> dict[str, object]:
    if group_id:
        raise UnsupportedReportFilterError("UNSUPPORTED_FILTER")

    product_table = legacy_tables["product"]
    problem_table = legacy_tables["product_problem"]
    solution_table = legacy_tables["product_solution"]
    user_table = legacy_tables["user"]
    group_table = legacy_tables["group"]
    project_table = legacy_tables["project"]
    activity_table = legacy_tables["product_activity"]
    task_table = legacy_tables["project_task"]

    start = parse_date_only(date_range["start"])
    end = parse_date_only(date_range["end"])

    products = connection.execute(
        select(product_table.c.id, product_table.c.name, product_table.c.available, product_table.c.priority)
        .order_by(product_table.c.name.asc())
    ).mappings().all()

    problem_filters = [
        problem_table.c.created_at >= datetime.combine(start, datetime.min.time()),
        problem_table.c.created_at <= datetime.combine(end, datetime.max.time().replace(microsecond=0)),
    ]
    if product_id:
        problem_filters.append(problem_table.c.product_id == product_id)

    problems = connection.execute(
        select(problem_table.c.id, problem_table.c.product_id, problem_table.c.created_at)
        .where(and_(*problem_filters))
    ).mappings().all()
    problem_ids = [str(row["id"]) for row in problems]

    solutions = connection.execute(
        select(solution_table.c.id, solution_table.c.product_problem_id, solution_table.c.created_at)
        .where(
            and_(
                solution_table.c.created_at >= datetime.combine(start, datetime.min.time()),
                solution_table.c.created_at <= datetime.combine(end, datetime.max.time().replace(microsecond=0)),
            )
        )
    ).mappings().all()

    users = connection.execute(select(user_table.c.id).where(user_table.c.is_active.is_(True))).all()
    groups = connection.execute(select(group_table.c.id)).all()
    projects = connection.execute(select(project_table.c.id, project_table.c.status, project_table.c.priority)).mappings().all()
    activities = connection.execute(select(activity_table.c.id, activity_table.c.status)).mappings().all()
    tasks = connection.execute(select(task_table.c.id, task_table.c.status)).mappings().all()

    # Disponibilidade média do período (mesma semântica do relatório de disponibilidade):
    # produtos sem atividades no período não entram na média; sem dados, valor nulo.
    period_activities = connection.execute(
        select(activity_table.c.product_id, activity_table.c.status)
        .where(and_(activity_table.c.date >= start, activity_table.c.date <= end))
    ).mappings().all()
    availability_by_product: dict[str, dict[str, int]] = {}
    for row in period_activities:
        bucket = availability_by_product.setdefault(str(row["product_id"]), {"total": 0, "completed": 0})
        bucket["total"] += 1
        if row["status"] == "completed":
            bucket["completed"] += 1
    period_availabilities = [
        round((bucket["completed"] / bucket["total"]) * 100, 1)
        for bucket in availability_by_product.values()
        if bucket["total"] > 0
    ]
    avg_availability = (
        round(sum(period_availabilities) / len(period_availabilities), 1)
        if period_availabilities
        else None
    )

    total_products = len(products)
    available_products = sum(1 for row in products if bool(row["available"]))
    total_problems = len(problems)
    total_solutions = len(solutions)
    completed_tasks = sum(1 for row in tasks if row["status"] == "done")

    recent_cutoff = parse_date_only(get_days_ago(7))
    previous_cutoff = parse_date_only(get_days_ago(14))
    recent_problems = sum(1 for problem in problems if problem["created_at"].date() >= recent_cutoff)
    previous_problems = sum(
        1
        for problem in problems
        if previous_cutoff <= problem["created_at"].date() < recent_cutoff
    )
    recent_solutions = sum(1 for solution in solutions if solution["created_at"].date() >= recent_cutoff)
    previous_solutions = sum(
        1
        for solution in solutions
        if previous_cutoff <= solution["created_at"].date() < recent_cutoff
    )

    product_metrics = []
    for product in products:
        product_problems = [problem for problem in problems if str(problem["product_id"]) == str(product["id"])]
        product_solution_count = sum(
            1 for solution in solutions if any(str(problem["id"]) == str(solution["product_problem_id"]) for problem in product_problems)
        )
        activity_bucket = availability_by_product.get(str(product["id"]), {"total": 0, "completed": 0})
        product_availability = (
            round((activity_bucket["completed"] / activity_bucket["total"]) * 100, 1)
            if activity_bucket["total"] > 0
            else None
        )
        product_metrics.append(
            {
                "productId": str(product["id"]),
                "name": product["name"],
                "available": bool(product["available"]),
                "priority": product["priority"],
                "totalProblems": len(product_problems),
                "totalSolutions": product_solution_count,
                "activityRate": len(product_problems) + product_solution_count,
                "availabilityPercentage": product_availability,
            }
        )

    product_metrics.sort(key=lambda item: (-int(item["totalProblems"]), str(item["productId"])))
    top_products = product_metrics[:5]

    return {
        "period": {"start": date_range["start"], "end": date_range["end"]},
        "filters": {"productId": product_id},
        "summary": {
            "totalProducts": total_products,
            "availableProducts": available_products,
            "totalProblems": total_problems,
            "totalSolutions": total_solutions,
            "totalUsers": len(users),
            "totalGroups": len(groups),
            "totalProjects": len(projects),
            "activeProjects": sum(1 for row in projects if row["status"] == "active"),
            "totalActivities": len(activities),
            "totalTasks": len(tasks),
            "completedTasks": completed_tasks,
            "completedProjects": sum(1 for row in projects if row["status"] == "completed"),
            "averageProgress": round((completed_tasks / len(tasks)) * 100, 1) if tasks else 0,
            "avgAvailability": avg_availability,
        },
        "kpis": {
            "taskCompletionRate": round((completed_tasks / len(tasks)) * 100, 1) if tasks else 0,
        },
        "trends": {
            "problems": {
                "current": recent_problems,
                "previous": previous_problems,
                "change": 0 if previous_problems == 0 else ((recent_problems - previous_problems) / previous_problems) * 100,
            },
            "solutions": {
                "current": recent_solutions,
                "previous": previous_solutions,
                "change": 0 if previous_solutions == 0 else ((recent_solutions - previous_solutions) / previous_solutions) * 100,
            },
        },
        "productMetrics": product_metrics,
        "topProducts": top_products,
        "projectsByStatus": _count_by(projects, "status"),
    }


def get_projects_report(connection: Connection, date_range: dict[str, str]) -> dict[str, object]:
    project_table = legacy_tables["project"]
    activity_table = legacy_tables["project_activity"]
    task_table = legacy_tables["project_task"]
    task_user_table = legacy_tables["project_task_user"]
    user_table = legacy_tables["user"]

    start = parse_date_only(date_range["start"])
    end = parse_date_only(date_range["end"])

    projects_in_period = connection.execute(
        select(
            project_table.c.id,
            project_table.c.name,
            project_table.c.description,
            project_table.c.status,
            project_table.c.priority,
            project_table.c.start_date,
            project_table.c.end_date,
            project_table.c.created_at,
        )
        .where(
            and_(
                project_table.c.created_at >= datetime.combine(start, datetime.min.time()),
                project_table.c.created_at <= datetime.combine(end, datetime.max.time().replace(microsecond=0)),
            )
        )
        .order_by(project_table.c.created_at.asc(), project_table.c.id.asc())
    ).mappings().all()

    activities_in_period = connection.execute(
        select(
            activity_table.c.id,
            activity_table.c.project_id,
            activity_table.c.name,
            activity_table.c.status,
            activity_table.c.created_at,
        )
        .where(
            and_(
                activity_table.c.created_at >= datetime.combine(start, datetime.min.time()),
                activity_table.c.created_at <= datetime.combine(end, datetime.max.time().replace(microsecond=0)),
            )
        )
        .order_by(activity_table.c.created_at.asc(), activity_table.c.id.asc())
    ).mappings().all()

    tasks_in_period = connection.execute(
        select(
            task_table.c.id,
            task_table.c.project_id,
            task_table.c.project_activity_id,
            task_table.c.name,
            task_table.c.status,
            task_table.c.priority,
            task_table.c.created_at,
        )
        .where(
            and_(
                task_table.c.created_at >= datetime.combine(start, datetime.min.time()),
                task_table.c.created_at <= datetime.combine(end, datetime.max.time().replace(microsecond=0)),
            )
        )
        .order_by(task_table.c.created_at.asc(), task_table.c.id.asc())
    ).mappings().all()

    active_users = connection.execute(
        select(user_table.c.id, user_table.c.name, user_table.c.email)
        .where(user_table.c.is_active.is_(True))
        .order_by(user_table.c.name.asc(), user_table.c.id.asc())
    ).mappings().all()

    tasks_by_status = _count_by(tasks_in_period, "status")
    projects_by_status = _count_by(projects_in_period, "status")
    projects_by_priority = _count_by(projects_in_period, "priority")

    project_activity_counts: dict[str, int] = {}
    for activity in activities_in_period:
        project_activity_counts[str(activity["project_id"])] = project_activity_counts.get(str(activity["project_id"]), 0) + 1

    most_active_projects = sorted(
        project_activity_counts.items(),
        key=lambda item: (-item[1], item[0]),
    )[:5]
    most_active_projects = [
        {
            "projectId": project_id,
            "name": next((project["name"] for project in projects_in_period if str(project["id"]) == project_id), "?"),
            "activityCount": count,
        }
        for project_id, count in most_active_projects
    ]

    project_users = connection.execute(
        select(
            task_table.c.project_id,
            task_user_table.c.user_id,
            user_table.c.name.label("user_name"),
            user_table.c.email.label("user_email"),
        )
        .select_from(task_user_table.join(task_table, task_user_table.c.task_id == task_table.c.id).join(user_table, task_user_table.c.user_id == user_table.c.id))
        .where(user_table.c.is_active.is_(True))
        .order_by(task_table.c.project_id.asc(), user_table.c.name.asc(), user_table.c.id.asc())
    ).mappings().all()

    users_by_project: dict[str, dict[str, dict[str, object]]] = {}
    for row in project_users:
        project_id = str(row["project_id"])
        users_by_project.setdefault(project_id, {})
        users_by_project[project_id][str(row["user_id"])] = {
            "id": str(row["user_id"]),
            "name": row["user_name"],
            "email": row["user_email"],
        }

    projects_with_progress = []
    projects_response = []
    tasks_by_project: dict[str, list[dict[str, object]]] = {}
    for task in tasks_in_period:
        tasks_by_project.setdefault(str(task["project_id"]), []).append(task)

    for project in projects_in_period:
        project_tasks = tasks_by_project.get(str(project["id"]), [])
        done = sum(1 for task in project_tasks if task["status"] == "done")
        progress = round((done / len(project_tasks)) * 100) if project_tasks else 0
        users_list = list(users_by_project.get(str(project["id"]), {}).values())
        projects_with_progress.append(
            {
                "id": str(project["id"]),
                "name": project["name"],
                "description": project["description"],
                "progress": progress,
                "status": project["status"],
                "priority": project["priority"],
                "users": users_list,
            }
        )
        projects_response.append(
            {
                "id": str(project["id"]),
                "name": project["name"],
                "status": project["status"],
                "progress": progress,
                "startDate": project["start_date"],
                "endDate": project["end_date"],
                "tasksCount": len(project_tasks),
                "completedTasks": done,
                "priority": project["priority"],
                "description": project["description"],
            }
        )

    avg_progress = round(sum(project["progress"] for project in projects_with_progress) / len(projects_with_progress)) if projects_with_progress else 0
    completed_projects = sum(1 for project in projects_with_progress if project["progress"] == 100)

    summary = {
        "totalProjects": len(projects_in_period),
        "totalActivities": len(activities_in_period),
        "totalTasks": len(tasks_in_period),
        "activeUsers": len(active_users),
        "avgProgress": avg_progress,
        "activeProjects": sum(1 for project in projects_in_period if project["status"] == "active"),
        "completedProjects": completed_projects,
        "averageProgress": avg_progress,
    }

    return {
        "summary": summary,
        "projectsByStatus": projects_by_status,
        "projectsByPriority": projects_by_priority,
        "tasksByStatus": tasks_by_status,
        "mostActiveProjects": most_active_projects,
        "projectsWithProgress": projects_with_progress,
        "period": {"start": date_range["start"], "end": date_range["end"]},
        "projects": projects_response,
    }


def list_report_files() -> list[dict[str, object]]:
    return [item for item in list_upload_files("reports") if str(item.get("filename") or "").endswith(".pdf")]


def generate_pdf(
    *,
    report_type: str,
    data: dict[str, Any],
    period_label: str,
) -> dict[str, str]:
    generated_at = datetime.now(ANALYTICS_TIMEZONE)
    render_result = _PDF_RENDERER.render(
        report_type=report_type,
        data=data,
        period_label=period_label,
        generated_at=generated_at,
    )
    artifact = _PDF_ARTIFACT_STORE.save(
        report_type=report_type,
        pdf_bytes=render_result.pdf_bytes,
        generated_at=generated_at,
    )
    return {
        "filePath": str(artifact.file_path),
        "url": artifact.url,
        "filename": artifact.filename,
        "byteSize": artifact.byte_size,
        "sha256": artifact.sha256,
    }


def _build_availability_pdf(story: list[Any], data: dict[str, Any], styles) -> None:
    story.append(Paragraph("Visão Geral", styles["SiloSection"]))
    avg_availability = data.get("avgAvailability")
    avg_availability_label = f"{avg_availability}%" if isinstance(avg_availability, (int, float)) else "Sem dados"
    story.append(_kv_table([
        ("Total de produtos", str(data.get("totalProducts", 0))),
        ("Disponibilidade média", avg_availability_label),
        ("Total de intervenções", str(data.get("totalInterventions", 0))),
    ]))
    story.append(Spacer(1, 6))

    rows = [
        ["Produto", "Disponibilidade", "Atividades", "Concluídas", "Situação"],
    ]
    for product in data.get("products", []):
        availability = product.get("availabilityPercentage")
        availability_label = f"{availability}%" if isinstance(availability, (int, float)) else "Sem dados"
        rows.append([
            str(product.get("name") or "-"),
            availability_label,
            str(product.get("totalActivities", 0)),
            str(product.get("completedActivities", 0)),
            _status_pt(str(product.get("status") or "")),
        ])
    story.append(_zebra_table(rows))


def _build_problems_pdf(story: list[Any], data: dict[str, Any], styles) -> None:
    story.append(Paragraph("Visão Geral", styles["SiloSection"]))
    summary = data.get("summary", {})
    avg_resolution = data.get("avgResolutionHours", summary.get("averageResolutionHours"))
    avg_resolution_label = f"{avg_resolution} horas" if isinstance(avg_resolution, (int, float)) else "Sem dados"
    story.append(_kv_table([
        ("Total de problemas", str(data.get("totalProblems", summary.get("totalProblems", 0)))),
        ("Tempo médio de resolução", avg_resolution_label),
    ]))
    story.append(Spacer(1, 6))

    categories = data.get("problemsByCategory", data.get("categories", []))
    if categories:
        rows = [["Categoria", "Quantidade", "Média de resolução (h)"]]
        for category in categories:
            rows.append([
                str(category.get("name") or "-"),
                str(category.get("problemsCount", 0)),
                str(category.get("avgResolutionHours", 0)),
            ])
        story.append(Paragraph("Problemas por Categoria", styles["SiloSection"]))
        story.append(_zebra_table(rows))

    top_problems = data.get("topProblems", [])
    if top_problems:
        story.append(Spacer(1, 6))
        story.append(Paragraph("Principais Problemas", styles["SiloSection"]))
        rows = [["Título", "Produto", "Categoria", "Soluções"]]
        for problem in top_problems:
            rows.append([
                str(problem.get("title") or "-"),
                str((problem.get("product") or {}).get("name") or "-"),
                str(problem.get("categoryName") or (problem.get("category") or {}).get("name") or "-"),
                str(problem.get("solutionsCount", 0)),
            ])
        story.append(_zebra_table(rows))


def _build_executive_pdf(story: list[Any], data: dict[str, Any], styles) -> None:
    summary = data.get("summary", {})
    trends = data.get("trends", {})
    story.append(Paragraph("Indicadores", styles["SiloSection"]))
    story.append(_kv_table([
        ("Produtos", str(summary.get("totalProducts", 0))),
        ("Problemas", str(summary.get("totalProblems", 0))),
        ("Projetos ativos", str(summary.get("activeProjects", 0))),
        ("Tarefas concluídas", str(summary.get("completedTasks", 0))),
    ]))
    story.append(Spacer(1, 6))

    story.append(Paragraph("Tendências (7 dias)", styles["SiloSection"]))
    rows = [["Tipo", "Atual", "Anterior", "Variação"]]
    for key in ("problems", "solutions"):
        item = trends.get(key, {})
        rows.append([
            key.title(),
            str(item.get("current", 0)),
            str(item.get("previous", 0)),
            f"{item.get('change', 0)}%",
        ])
    story.append(_zebra_table(rows))

    product_metrics = data.get("productMetrics", [])
    if product_metrics:
        story.append(Spacer(1, 6))
        story.append(Paragraph("Métricas por Produto", styles["SiloSection"]))
        rows = [["Produto", "Prioridade", "Problemas", "Soluções", "Disponível"]]
        for product in product_metrics:
            rows.append([
                str(product.get("name") or "-"),
                _status_pt(str(product.get("priority") or "")),
                str(product.get("totalProblems", 0)),
                str(product.get("totalSolutions", 0)),
                "Sim" if product.get("available") else "Não",
            ])
        story.append(_zebra_table(rows))


def _build_projects_pdf(story: list[Any], data: dict[str, Any], styles) -> None:
    summary = data.get("summary", {})
    story.append(Paragraph("Visão Geral", styles["SiloSection"]))
    story.append(_kv_table([
        ("Total de projetos", str(summary.get("totalProjects", 0))),
        ("Total de atividades", str(summary.get("totalActivities", 0))),
        ("Total de tarefas", str(summary.get("totalTasks", 0))),
        ("Progresso médio", f"{summary.get('avgProgress', summary.get('averageProgress', 0))}%"),
    ]))

    if data.get("projectsByStatus"):
        story.append(Spacer(1, 6))
        story.append(Paragraph("Situação dos Projetos", styles["SiloSection"]))
        rows = [["Situação", "Quantidade"]]
        for status, count in data["projectsByStatus"].items():
            rows.append([_status_pt(str(status)), str(count)])
        story.append(_zebra_table(rows))

    if data.get("tasksByStatus"):
        story.append(Spacer(1, 6))
        story.append(Paragraph("Tarefas por Situação", styles["SiloSection"]))
        rows = [["Situação", "Quantidade"]]
        for status, count in data["tasksByStatus"].items():
            rows.append([_status_pt(str(status)), str(count)])
        story.append(_zebra_table(rows))

    projects = data.get("projectsWithProgress") or data.get("projects", [])
    if projects:
        story.append(Spacer(1, 6))
        story.append(Paragraph("Progresso por Projeto", styles["SiloSection"]))
        rows = [["Projeto", "Progresso", "Situação"]]
        for project in projects:
            rows.append([
                str(project.get("name") or "-"),
                f"{project.get('progress', 0)}%",
                _status_pt(str(project.get("status") or "")),
            ])
        story.append(_zebra_table(rows))


PDF_BUILDERS = {
    "availability": _build_availability_pdf,
    "problems": _build_problems_pdf,
    "executive": _build_executive_pdf,
    "projects": _build_projects_pdf,
}

TITLE_MAP = {
    "availability": "Relatório de Disponibilidade",
    "problems": "Relatório de Problemas",
    "executive": "Relatório Executivo",
    "projects": "Relatório de Projetos",
}

_PDF_RENDERER = PdfRenderer(PDF_BUILDERS, TITLE_MAP)
_PDF_ARTIFACT_STORE = PdfArtifactStore()


def _kv_table(rows: list[tuple[str, str]]):
    data = [[Paragraph(f"<b>{key}:</b> {value}", getSampleStyleSheet()["BodyText"]) for key, value in rows]]
    table = Table(data, colWidths=[85 * mm] * len(rows))
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.whitesmoke),
                ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#d1d5db")),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#d1d5db")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    return table


def _zebra_table(rows: list[list[str]]):
    table = Table(rows, repeatRows=1, colWidths=[None] * len(rows[0]))
    style = TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a5f")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("LEADING", (0, 0), (-1, -1), 10),
            ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#d1d5db")),
            ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#d1d5db")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]
    )
    for index in range(1, len(rows)):
        if index % 2 == 1:
            style.add("BACKGROUND", (0, index), (-1, index), colors.HexColor("#f8fafc"))
    table.setStyle(style)
    return table


def _status_pt(status: str) -> str:
    return {
        "active": "ativo",
        "critical": "crítico",
        "warning": "atenção",
        "stable": "estável",
        "no_data": "sem dados",
        "done": "concluído",
        "completed": "concluído",
        "in_progress": "em andamento",
        "pending": "pendente",
        "paused": "pausado",
        "cancelled": "cancelado",
        "undefined": "indefinido",
        "ok": "ok",
        "delayed": "atrasado",
        "offline": "offline",
        "high": "alta",
        "medium": "média",
        "low": "baixa",
        "normal": "normal",
    }.get(status.lower(), status)


def _count_by(items: Iterable[dict[str, object]], key: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in items:
        value = str(item.get(key) or "").strip()
        if not value:
            continue
        counts[value] = counts.get(value, 0) + 1
    return dict(sorted(counts.items(), key=lambda pair: (-pair[1], pair[0])))


def _group_solutions(
    connection: Connection,
    problem_ids: list[str],
    solution_table,
) -> dict[str, list[dict[str, object]]]:
    if not problem_ids:
        return {}
    rows = connection.execute(
        select(solution_table)
        .where(solution_table.c.product_problem_id.in_(tuple(problem_ids)))
        .order_by(solution_table.c.created_at.asc(), solution_table.c.id.asc())
    ).mappings().all()
    grouped: dict[str, list[dict[str, object]]] = {}
    for row in rows:
        grouped.setdefault(str(row["product_problem_id"]), []).append(row)
    return grouped


def _average_resolution_hours(
    category_problems: list[dict[str, object]],
    solutions_by_problem: dict[str, list[dict[str, object]]],
) -> float:
    durations: list[float] = []
    for problem in category_problems:
        problem_solutions = solutions_by_problem.get(str(problem["id"]), [])
        if not problem_solutions:
            continue
        earliest_solution = min(problem_solutions, key=lambda row: row["created_at"])
        durations.append(
            max(
                0,
                (earliest_solution["created_at"] - problem["created_at"]).total_seconds() / 3_600,
            )
        )
    return round(sum(durations) / len(durations), 1) if durations else 0


def _user_name(connection: Connection, user_id: str) -> str | None:
    user_table = legacy_tables["user"]
    row = connection.execute(select(user_table.c.name).where(user_table.c.id == user_id).limit(1)).first()
    return str(row[0]) if row is not None else None


def _user_image(connection: Connection, user_id: str) -> str | None:
    user_table = legacy_tables["user"]
    row = connection.execute(select(user_table.c.image).where(user_table.c.id == user_id).limit(1)).first()
    return str(row[0]) if row is not None else None


def parse_date_only(value: str) -> date:
    return datetime.fromisoformat(value).date()


def _optional_text(value: object | None) -> str | None:
    return optional_str(value)


def _has_text(value: object | None) -> bool:
    return isinstance(value, str) and value.strip() != ""
