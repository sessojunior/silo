from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime

from sqlalchemy import and_, asc, delete, desc, insert, or_, select, update
from sqlalchemy.engine import Connection

from silo.db.models import legacy_tables
from silo.db.serialization import serialize_legacy_row
from silo.services.common import service_failure, service_success
from silo.services.legacy_utils import new_uuid, now_naive, optional_int, optional_str

PROJECT_TASK_STATUSES: tuple[str, ...] = ("todo", "in_progress", "blocked", "review", "done")


@dataclass(frozen=True, slots=True)
class ProjectTaskReorderConflict(Exception):
    tasks: list[dict[str, object]]

    def __init__(self, tasks: list[dict[str, object]]) -> None:
        super().__init__("KANBAN_OUTDATED")
        object.__setattr__(self, "tasks", tasks)


def list_projects(
    connection: Connection,
    *,
    search: str | None = None,
    status: str | None = None,
    priority: str | None = None,
):
    project_table = legacy_tables["project"]

    conditions = []
    if search:
        pattern = f"%{search.strip()}%"
        conditions.append(
            or_(
                project_table.c.name.ilike(pattern),
                project_table.c.short_description.ilike(pattern),
                project_table.c.description.ilike(pattern),
            )
        )
    if status and status != "all":
        conditions.append(project_table.c.status == status)
    if priority and priority != "all":
        conditions.append(project_table.c.priority == priority)

    statement = select(project_table).order_by(project_table.c.name.asc())
    if conditions:
        statement = statement.where(and_(*conditions))

    rows = connection.execute(statement).mappings().all()
    return service_success([serialize_legacy_row(row) for row in rows])


def create_project(connection: Connection, payload: dict[str, object]):
    required = _require_project_payload(payload)
    if isinstance(required, dict) and required.get("error"):
        return required

    project_table = legacy_tables["project"]
    now = now_naive()
    row = {
        "id": new_uuid(),
        "name": required["name"],
        "short_description": required["shortDescription"],
        "description": required["description"],
        "start_date": _optional_date(payload.get("startDate")),
        "end_date": _optional_date(payload.get("endDate")),
        "priority": required["priority"],
        "status": required["status"],
        "created_at": now,
        "updated_at": now,
    }
    connection.execute(insert(project_table).values(row))
    connection.commit()
    return service_success(serialize_legacy_row(row))


def update_project(connection: Connection, payload: dict[str, object]):
    required = _require_project_payload(payload, update=True)
    if isinstance(required, dict) and required.get("error"):
        return required

    project_id = required["id"]
    project_table = legacy_tables["project"]
    current = connection.execute(
        select(project_table).where(project_table.c.id == project_id).limit(1)
    ).mappings().first()
    if current is None:
        return service_failure("Projeto não encontrado.", 404)

    row = {
        "id": project_id,
        "name": required["name"],
        "short_description": required["shortDescription"],
        "description": required["description"],
        "start_date": _optional_date(payload.get("startDate")),
        "end_date": _optional_date(payload.get("endDate")),
        "priority": required["priority"],
        "status": required["status"],
        "created_at": current["created_at"],
        "updated_at": now_naive(),
    }
    connection.execute(update(project_table).where(project_table.c.id == project_id).values(row))
    connection.commit()
    return service_success(serialize_legacy_row(row))


def delete_project(connection: Connection, project_id: str):
    project_table = legacy_tables["project"]
    activity_table = legacy_tables["project_activity"]
    task_table = legacy_tables["project_task"]
    task_user_table = legacy_tables["project_task_user"]
    task_history_table = legacy_tables["project_task_history"]

    existing = connection.execute(
        select(project_table.c.id).where(project_table.c.id == project_id).limit(1)
    ).first()
    if existing is None:
        return service_failure("Projeto não encontrado.", 404)

    task_ids = [
        row[0]
        for row in connection.execute(
            select(task_table.c.id).where(task_table.c.project_id == project_id)
        ).all()
    ]

    connection.commit()
    with connection.begin():
        if task_ids:
            connection.execute(delete(task_history_table).where(task_history_table.c.task_id.in_(task_ids)))
            connection.execute(delete(task_user_table).where(task_user_table.c.task_id.in_(task_ids)))
        connection.execute(delete(task_table).where(task_table.c.project_id == project_id))
        connection.execute(delete(activity_table).where(activity_table.c.project_id == project_id))
        connection.execute(delete(project_table).where(project_table.c.id == project_id))

    return service_success(None)


def list_project_activities(connection: Connection, project_id: str):
    project_table = legacy_tables["project"]
    activity_table = legacy_tables["project_activity"]

    project_exists = connection.execute(
        select(project_table.c.id).where(project_table.c.id == project_id).limit(1)
    ).first()
    if project_exists is None:
        return service_failure("Projeto não encontrado.", 404)

    rows = connection.execute(
        select(activity_table)
        .where(activity_table.c.project_id == project_id)
        .order_by(activity_table.c.created_at.asc())
    ).mappings().all()
    activities = [serialize_legacy_row(row) for row in rows]
    return service_success({"activities": activities})


def create_project_activity(connection: Connection, project_id: str, payload: dict[str, object]):
    project_table = legacy_tables["project"]
    activity_table = legacy_tables["project_activity"]

    if connection.execute(select(project_table.c.id).where(project_table.c.id == project_id).limit(1)).first() is None:
        return service_failure("Projeto não encontrado.", 404)

    required = _require_activity_payload(payload)
    if isinstance(required, dict) and required.get("error"):
        return required

    estimated_days, days_error = _parse_estimated_days(payload.get("estimatedDays"))
    if days_error is not None:
        return days_error

    now = now_naive()
    row = {
        "id": new_uuid(),
        "project_id": project_id,
        "name": required["name"],
        "description": required["description"],
        "category": _optional_str(payload.get("category")),
        "estimated_days": estimated_days,
        "start_date": _optional_date(payload.get("startDate")),
        "end_date": _optional_date(payload.get("endDate")),
        "priority": _optional_str(payload.get("priority")) or "medium",
        "status": _optional_str(payload.get("status")) or "todo",
        "created_at": now,
        "updated_at": now,
    }
    connection.execute(insert(activity_table).values(row))
    connection.commit()
    return service_success({"activity": serialize_legacy_row(row)})


def update_project_activity(connection: Connection, project_id: str, payload: dict[str, object]):
    project_table = legacy_tables["project"]
    activity_table = legacy_tables["project_activity"]

    if connection.execute(select(project_table.c.id).where(project_table.c.id == project_id).limit(1)).first() is None:
        return service_failure("Projeto não encontrado.", 404)

    required = _require_activity_payload(payload, update=True)
    if isinstance(required, dict) and required.get("error"):
        return required

    estimated_days, days_error = _parse_estimated_days(payload.get("estimatedDays"))
    if days_error is not None:
        return days_error

    activity_id = required["id"]
    current = connection.execute(
        select(activity_table).where(
            and_(activity_table.c.id == activity_id, activity_table.c.project_id == project_id)
        ).limit(1)
    ).mappings().first()
    if current is None:
        return service_failure("Atividade não encontrada.", 404)

    row = {
        "id": activity_id,
        "project_id": project_id,
        "name": required["name"],
        "description": required["description"],
        "category": _optional_str(payload.get("category")),
        "estimated_days": estimated_days,
        "start_date": _optional_date(payload.get("startDate")),
        "end_date": _optional_date(payload.get("endDate")),
        "priority": _optional_str(payload.get("priority")) or "medium",
        "status": _optional_str(payload.get("status")) or "todo",
        "created_at": current["created_at"],
        "updated_at": now_naive(),
    }
    connection.execute(
        update(activity_table)
        .where(and_(activity_table.c.id == activity_id, activity_table.c.project_id == project_id))
        .values(row)
    )
    connection.commit()
    return service_success({"activity": serialize_legacy_row(row)})


def delete_project_activity(connection: Connection, project_id: str, activity_id: str):
    activity_table = legacy_tables["project_activity"]
    project_table = legacy_tables["project"]

    if connection.execute(select(project_table.c.id).where(project_table.c.id == project_id).limit(1)).first() is None:
        return service_failure("Projeto não encontrado.", 404)

    deleted = connection.execute(
        delete(activity_table).where(
            and_(activity_table.c.id == activity_id, activity_table.c.project_id == project_id)
        )
    )
    if deleted.rowcount == 0:
        return service_failure("Atividade não encontrada.", 404)
    connection.commit()
    return service_success(None)


def list_project_activity_tasks(connection: Connection, project_id: str, activity_id: str):
    activity_table = legacy_tables["project_activity"]
    task_table = legacy_tables["project_task"]
    task_user_table = legacy_tables["project_task_user"]
    user_table = legacy_tables["user"]

    if connection.execute(
        select(activity_table.c.id).where(
            and_(activity_table.c.id == activity_id, activity_table.c.project_id == project_id)
        ).limit(1)
    ).first() is None:
        return service_failure("Atividade não encontrada.", 404)

    task_rows = connection.execute(
        select(task_table)
        .where(and_(task_table.c.project_id == project_id, task_table.c.project_activity_id == activity_id))
        .order_by(asc(task_table.c.sort), asc(task_table.c.created_at))
    ).mappings().all()

    task_ids = [str(row["id"]) for row in task_rows]
    user_map: dict[str, list[dict[str, object]]] = {task_id: [] for task_id in task_ids}
    if task_ids:
        user_rows = connection.execute(
            select(
                task_user_table.c.task_id,
                user_table.c.id.label("user_id"),
                user_table.c.name,
                user_table.c.email,
                user_table.c.image,
                task_user_table.c.role,
            )
            .select_from(task_user_table.join(user_table, task_user_table.c.user_id == user_table.c.id))
            .where(task_user_table.c.task_id.in_(task_ids))
            .order_by(task_user_table.c.created_at.asc())
        ).mappings().all()
        for row in user_rows:
            task_id = str(row["task_id"])
            user_map.setdefault(task_id, []).append(
                {
                    "id": str(row["user_id"]),
                    "name": str(row["name"] or "Desconhecido"),
                    "role": str(row["role"] or "assignee"),
                    "email": str(row["email"] or ""),
                    "image": row["image"],
                }
            )

    grouped = _create_task_groups()
    for row in task_rows:
        task = _normalize_task_view(row)
        users = user_map.get(str(task["id"]), [])
        task["assignedUsers"] = [user["id"] for user in users]
        task["assignedUsersDetails"] = users
        grouped[task["status"]].append(task)

    for status in PROJECT_TASK_STATUSES:
        grouped[status].sort(key=_task_position_sort_key)

    return service_success({"tasks": grouped})


def create_project_activity_task(
    connection: Connection,
    project_id: str,
    activity_id: str,
    user_id: str,
    payload: dict[str, object],
):
    activity_table = legacy_tables["project_activity"]
    task_table = legacy_tables["project_task"]
    history_table = legacy_tables["project_task_history"]

    if connection.execute(
        select(activity_table.c.id).where(
            and_(activity_table.c.id == activity_id, activity_table.c.project_id == project_id)
        ).limit(1)
    ).first() is None:
        return service_failure("Atividade não encontrada.", 404)

    required = _require_task_payload(payload, include_id=False)
    if isinstance(required, dict) and required.get("error"):
        return required

    if required["projectId"] != project_id or required["projectActivityId"] != activity_id:
        return service_failure("Dados da tarefa inválidos.", 400)

    status = _normalize_task_status(required["status"])
    sort_value = _get_next_task_sort(connection, project_id, activity_id, status)
    now = now_naive()
    row = {
        "id": new_uuid(),
        "project_id": project_id,
        "project_activity_id": activity_id,
        "name": required["name"],
        "description": required["description"],
        "category": _optional_str(payload.get("category")),
        "estimated_days": optional_int(payload.get("estimatedDays")),
        "start_date": _optional_date(payload.get("startDate")),
        "end_date": _optional_date(payload.get("endDate")),
        "priority": required["priority"],
        "status": status,
        "sort": sort_value,
        "created_at": now,
        "updated_at": now,
    }

    connection.commit()
    with connection.begin():
        connection.execute(insert(task_table).values(row))
        connection.execute(
            insert(history_table).values(
                {
                    "id": new_uuid(),
                    "task_id": row["id"],
                    "user_id": user_id,
                    "action": "created",
                    "from_status": None,
                    "to_status": status,
                    "from_sort": None,
                    "to_sort": sort_value,
                    "details": _json_safe_value(
                        {
                            "initialData": {
                                "name": required["name"],
                                "description": required["description"],
                                "category": _optional_str(payload.get("category")),
                                "estimatedDays": optional_int(payload.get("estimatedDays")),
                                "startDate": _optional_date(payload.get("startDate")),
                                "endDate": _optional_date(payload.get("endDate")),
                                "priority": required["priority"],
                                "status": status,
                            }
                        }
                    ),
                    "created_at": now,
                }
            )
        )

    task = _normalize_task_view(row)
    return service_success({"task": task})


def update_project_activity_task(
    connection: Connection,
    project_id: str,
    activity_id: str,
    user_id: str,
    payload: dict[str, object],
):
    activity_table = legacy_tables["project_activity"]
    task_table = legacy_tables["project_task"]
    history_table = legacy_tables["project_task_history"]

    if connection.execute(
        select(activity_table.c.id).where(
            and_(activity_table.c.id == activity_id, activity_table.c.project_id == project_id)
        ).limit(1)
    ).first() is None:
        return service_failure("Atividade não encontrada.", 404)

    required = _require_task_payload(payload, include_id=True)
    if isinstance(required, dict) and required.get("error"):
        return required

    if required["projectId"] != project_id or required["projectActivityId"] != activity_id:
        return service_failure("Dados da tarefa inválidos.", 400)

    current = connection.execute(
        select(task_table)
        .where(
            and_(
                task_table.c.id == required["id"],
                task_table.c.project_id == project_id,
                task_table.c.project_activity_id == activity_id,
            )
        )
        .limit(1)
    ).mappings().first()
    if current is None:
        return service_failure("Tarefa não encontrada.", 404)

    current_values = _read_task_values(serialize_legacy_row(current))
    next_status = _normalize_task_status(required["status"])
    next_values = {
        "name": required["name"],
        "description": required["description"],
        "category": _optional_str(payload.get("category")),
        "estimatedDays": optional_int(payload.get("estimatedDays")),
        "startDate": _optional_date(payload.get("startDate")),
        "endDate": _optional_date(payload.get("endDate")),
        "priority": required["priority"],
        "status": next_status,
    }

    next_sort = int(current["sort"]) if current_values["status"] == next_status else _get_next_task_sort(
        connection, project_id, activity_id, next_status
    )
    now = now_naive()
    row = {
        "id": required["id"],
        "project_id": project_id,
        "project_activity_id": activity_id,
        "name": next_values["name"],
        "description": next_values["description"],
        "category": next_values["category"],
        "estimated_days": next_values["estimatedDays"],
        "start_date": next_values["startDate"],
        "end_date": next_values["endDate"],
        "priority": next_values["priority"],
        "status": next_status,
        "sort": next_sort,
        "created_at": current["created_at"],
        "updated_at": now,
    }

    connection.commit()
    with connection.begin():
        updated = connection.execute(
            update(task_table)
            .where(
                and_(
                    task_table.c.id == required["id"],
                    task_table.c.project_id == project_id,
                    task_table.c.project_activity_id == activity_id,
                )
            )
            .values(row)
            .returning(task_table.c.id)
        ).first()
        if updated is None:
            return service_failure("Tarefa não encontrada.", 404)

        updated_values = _read_task_values(serialize_legacy_row(row))
        changed_fields = _detect_changed_fields(current_values, updated_values)
        if changed_fields:
            connection.execute(
                insert(history_table).values(
                    {
                        "id": new_uuid(),
                        "task_id": required["id"],
                        "user_id": user_id,
                        "action": "updated",
                        "from_status": current_values["status"],
                        "to_status": updated_values["status"],
                        "from_sort": int(current["sort"]),
                        "to_sort": next_sort,
                        "details": _json_safe_value(
                            {
                                "changedFields": changed_fields,
                                "oldValues": current_values,
                                "newValues": updated_values,
                            }
                        ),
                        "created_at": now,
                    }
                )
            )

    task = _normalize_task_view(row)
    return service_success({"task": task})


def delete_project_activity_task(connection: Connection, project_id: str, activity_id: str, task_id: str):
    activity_table = legacy_tables["project_activity"]
    task_table = legacy_tables["project_task"]

    if connection.execute(
        select(activity_table.c.id).where(
            and_(activity_table.c.id == activity_id, activity_table.c.project_id == project_id)
        ).limit(1)
    ).first() is None:
        return service_failure("Atividade não encontrada.", 404)

    deleted = connection.execute(
        delete(task_table).where(
            and_(
                task_table.c.id == task_id,
                task_table.c.project_id == project_id,
                task_table.c.project_activity_id == activity_id,
            )
        )
    )
    if deleted.rowcount == 0:
        return service_failure("Tarefa não encontrada.", 404)

    connection.commit()
    return service_success(None)


def reorder_project_activity_tasks(
    connection: Connection,
    project_id: str,
    activity_id: str,
    user_id: str,
    tasks_before_move: list[dict[str, object]],
    tasks_after_move: list[dict[str, object]],
):
    activity_table = legacy_tables["project_activity"]
    task_table = legacy_tables["project_task"]
    history_table = legacy_tables["project_task_history"]

    if connection.execute(
        select(activity_table.c.id).where(
            and_(activity_table.c.id == activity_id, activity_table.c.project_id == project_id)
        ).limit(1)
    ).first() is None:
        return service_failure("Atividade não encontrada.", 404)

    if not tasks_before_move or not tasks_after_move or len(tasks_before_move) != len(tasks_after_move):
        return service_failure("Dados de movimentação inválidos.", 400)

    normalized_before = [_normalize_position_item(item) for item in tasks_before_move]
    normalized_after = [_normalize_position_item(item) for item in tasks_after_move]
    if any(item is None for item in normalized_before) or any(item is None for item in normalized_after):
        return service_failure("Dados de movimentação inválidos.", 400)

    before_map = {item["taskId"]: item for item in normalized_before if item is not None}
    after_map = {item["taskId"]: item for item in normalized_after if item is not None}
    if len(before_map) != len(normalized_before) or len(after_map) != len(normalized_after):
        return service_failure("Dados de movimentação inválidos.", 400)
    if before_map.keys() != after_map.keys():
        return service_failure("Dados de movimentação inválidos.", 400)

    current_rows = connection.execute(
        select(task_table)
        .where(and_(task_table.c.project_id == project_id, task_table.c.project_activity_id == activity_id))
        .order_by(asc(task_table.c.sort), asc(task_table.c.created_at))
    ).mappings().all()
    current_map = {str(row["id"]): row for row in current_rows}
    current_normalized = {task_id: {"taskId": task_id, "status": _normalize_task_status(row["status"]), "sort": int(row["sort"])} for task_id, row in current_map.items()}

    if len(current_normalized) != len(before_map):
        return _kanban_outdated(current_rows)

    for task_id, expected in before_map.items():
        current = current_normalized.get(task_id)
        if current is None or current["status"] != expected["status"] or current["sort"] != int(expected["sort"]):
            return _kanban_outdated(current_rows)

    now = now_naive()
    try:
        connection.commit()
        with connection.begin():
            for next_task in normalized_after:
                assert next_task is not None
                current_task = current_map.get(next_task["taskId"])
                current_normalized_task = current_normalized.get(next_task["taskId"])
                if current_task is None or current_normalized_task is None:
                    raise ProjectTaskReorderConflict(
                        [_normalize_task_view(row) for row in current_rows]
                    )

                if current_normalized_task["status"] == next_task["status"] and current_normalized_task["sort"] == int(next_task["sort"]):
                    continue

                updated_rows = connection.execute(
                    update(task_table)
                    .where(
                        and_(
                            task_table.c.id == next_task["taskId"],
                            task_table.c.project_id == project_id,
                            task_table.c.project_activity_id == activity_id,
                            task_table.c.status == current_task["status"],
                            task_table.c.sort == int(current_task["sort"]),
                        )
                    )
                    .values(status=next_task["status"], sort=int(next_task["sort"]), updated_at=now)
                    .returning(task_table.c.id)
                ).all()
                if not updated_rows:
                    fresh_rows = connection.execute(
                        select(task_table)
                        .where(and_(task_table.c.project_id == project_id, task_table.c.project_activity_id == activity_id))
                        .order_by(asc(task_table.c.sort), asc(task_table.c.created_at))
                    ).mappings().all()
                    raise ProjectTaskReorderConflict([_normalize_task_view(row) for row in fresh_rows])

                connection.execute(
                    insert(history_table).values(
                        {
                            "id": new_uuid(),
                            "task_id": next_task["taskId"],
                            "user_id": user_id,
                            "action": "status_change",
                            "from_status": current_normalized_task["status"],
                            "to_status": next_task["status"],
                            "from_sort": current_normalized_task["sort"],
                            "to_sort": int(next_task["sort"]),
                            "details": {"kanbanMove": True},
                            "created_at": now,
                        }
                    )
                )
    except ProjectTaskReorderConflict as conflict:
        return service_failure("KANBAN_OUTDATED", 409, data={"tasks": conflict.tasks})
    refreshed = connection.execute(
        select(task_table)
        .where(and_(task_table.c.project_id == project_id, task_table.c.project_activity_id == activity_id))
        .order_by(asc(task_table.c.sort), asc(task_table.c.created_at))
    ).mappings().all()
    tasks = [_normalize_task_view(row) for row in refreshed]
    return service_success({"tasks": tasks})


def get_task_history(connection: Connection, task_id: str):
    task_table = legacy_tables["project_task"]
    history_table = legacy_tables["project_task_history"]
    user_table = legacy_tables["user"]

    task = connection.execute(select(task_table).where(task_table.c.id == task_id).limit(1)).mappings().first()
    if task is None:
        return service_failure("Tarefa não encontrada.", 404)

    history_rows = connection.execute(
        select(
            history_table.c.id,
            history_table.c.action,
            history_table.c.from_status,
            history_table.c.to_status,
            history_table.c.from_sort,
            history_table.c.to_sort,
            history_table.c.details,
            history_table.c.created_at,
            user_table.c.id.label("user_id"),
            user_table.c.name,
            user_table.c.email,
            user_table.c.image,
        )
        .select_from(history_table.join(user_table, history_table.c.user_id == user_table.c.id))
        .where(history_table.c.task_id == task_id)
        .order_by(desc(history_table.c.created_at))
    ).mappings().all()

    history = []
    for row in history_rows:
        item = serialize_legacy_row(row)
        item["user"] = {
            "id": row["user_id"],
            "name": row["name"],
            "email": row["email"],
            "image": row["image"],
        }
        history.append(item)

    return service_success({"task": serialize_legacy_row(task), "history": history})


def get_task_users(connection: Connection, task_id: str):
    task_table = legacy_tables["project_task"]
    task_user_table = legacy_tables["project_task_user"]
    user_table = legacy_tables["user"]

    task = connection.execute(select(task_table.c.id).where(task_table.c.id == task_id).limit(1)).first()
    if task is None:
        return service_failure("Tarefa não encontrada.", 404)

    rows = connection.execute(
        select(
            task_user_table.c.user_id.label("id"),
            task_user_table.c.role,
            task_user_table.c.assigned_at,
            user_table.c.name,
            user_table.c.email,
            user_table.c.image,
        )
        .select_from(task_user_table.join(user_table, task_user_table.c.user_id == user_table.c.id))
        .where(task_user_table.c.task_id == task_id)
        .order_by(task_user_table.c.created_at.asc())
    ).mappings().all()

    users = []
    for row in rows:
        item = serialize_legacy_row(row)
        item["id"] = row["id"]
        users.append(item)
    return service_success(users)


def set_task_users(connection: Connection, task_id: str, user_ids: list[str], role: str = "assignee"):
    task_table = legacy_tables["project_task"]
    task_user_table = legacy_tables["project_task_user"]

    task = connection.execute(select(task_table.c.id).where(task_table.c.id == task_id).limit(1)).first()
    if task is None:
        return service_failure("Tarefa não encontrada.", 404)

    unique_user_ids = []
    for user_id in user_ids:
        if user_id not in unique_user_ids:
            unique_user_ids.append(user_id)

    now = now_naive()
    connection.commit()
    with connection.begin():
        connection.execute(delete(task_user_table).where(task_user_table.c.task_id == task_id))
        if unique_user_ids:
            connection.execute(
                insert(task_user_table).values(
                    [
                        {
                            "id": new_uuid(),
                            "task_id": task_id,
                            "user_id": user_id,
                            "role": role or "assignee",
                            "assigned_at": now,
                            "created_at": now,
                        }
                        for user_id in unique_user_ids
                    ]
                )
            )

    return service_success(None)


def _create_task_groups() -> dict[str, list[dict[str, object]]]:
    return {status: [] for status in PROJECT_TASK_STATUSES}


def _task_position_sort_key(task: dict[str, object]) -> tuple[int, str]:
    sort_value = task.get("sort")
    if isinstance(sort_value, int):
        sort_key = sort_value
    else:
        sort_key = int(sort_value or 0)
    created_at = str(task.get("createdAt") or "")
    return sort_key, created_at


def _normalize_task_view(row: dict[str, object]) -> dict[str, object]:
    task = serialize_legacy_row(row)
    task["status"] = _normalize_task_status(str(row.get("status") or "todo"))
    return task


def _normalize_task_status(status: object | None) -> str:
    text = _optional_str(status) or "todo"
    if text == "progress":
        return "in_progress"
    if text in PROJECT_TASK_STATUSES:
        return text
    return "todo"


def _task_groups_from_rows(rows: list[dict[str, object]]) -> dict[str, list[dict[str, object]]]:
    grouped = _create_task_groups()
    for row in rows:
        task = _normalize_task_view(row)
        grouped[task["status"]].append(task)
    for status in PROJECT_TASK_STATUSES:
        grouped[status].sort(key=_task_position_sort_key)
    return grouped


def _read_task_values(row: dict[str, object]) -> dict[str, object]:
    return {
        "name": row.get("name"),
        "description": row.get("description"),
        "category": row.get("category"),
        "estimatedDays": row.get("estimatedDays", row.get("estimated_days")),
        "startDate": row.get("startDate", row.get("start_date")),
        "endDate": row.get("endDate", row.get("end_date")),
        "priority": row.get("priority"),
        "status": _normalize_task_status(row.get("status")),
    }


def _detect_changed_fields(before: dict[str, object], after: dict[str, object]) -> list[str]:
    changed = []
    for field in ("name", "description", "category", "estimatedDays", "startDate", "endDate", "priority", "status"):
        if before.get(field) != after.get(field):
            changed.append(field)
    return changed


def _get_next_task_sort(connection: Connection, project_id: str, activity_id: str, status: str) -> int:
    task_table = legacy_tables["project_task"]
    row = connection.execute(
        select(task_table.c.sort)
        .where(
            and_(
                task_table.c.project_id == project_id,
                task_table.c.project_activity_id == activity_id,
                task_table.c.status == status,
            )
        )
        .order_by(task_table.c.sort.desc())
        .limit(1)
    ).first()
    return int(row[0] if row is not None else -1) + 1


def _normalize_position_item(item: dict[str, object]) -> dict[str, object] | None:
    task_id = _optional_str(item.get("taskId"))
    status = _normalize_task_status(item.get("status"))
    sort = optional_int(item.get("sort"))
    if task_id is None or sort is None:
        return None
    return {"taskId": task_id, "status": status, "sort": sort}


def _kanban_outdated(rows: list[dict[str, object]]):
    normalized = [_normalize_task_view(row) for row in rows]
    return service_failure("KANBAN_OUTDATED", 409, data={"tasks": normalized})


def _optional_date(value: object | None) -> date | None:
    text = _optional_str(value)
    if text is None:
        return None
    try:
        return date.fromisoformat(text)
    except ValueError:
        return None


def _optional_str(value: object | None) -> str | None:
    return optional_str(value)


def _json_safe_value(value: object) -> object:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: _json_safe_value(inner) for key, inner in value.items()}
    if isinstance(value, list):
        return [_json_safe_value(item) for item in value]
    if isinstance(value, tuple):
        return [_json_safe_value(item) for item in value]
    return value


def _require_project_payload(payload: dict[str, object], *, update: bool = False):
    if update:
        identifier = _optional_str(payload.get("id"))
        if identifier is None:
            return service_failure("Invalid input: expected string, received undefined", 400)
    else:
        identifier = None

    required_keys = ("name", "shortDescription", "description", "priority", "status")
    required: dict[str, str] = {}
    for key in required_keys:
        value = _optional_str(payload.get(key))
        if value is None:
            return service_failure("Invalid input: expected string, received undefined", 400)
        required[key] = value.strip()

    if update:
        required["id"] = identifier or ""
    return required


def _require_activity_payload(payload: dict[str, object], *, update: bool = False):
    if update:
        identifier = _optional_str(payload.get("id"))
        if identifier is None:
            return service_failure("Invalid input: expected string, received undefined", 400)
    else:
        identifier = None

    name = _optional_str(payload.get("name"))
    description = _optional_str(payload.get("description"))
    if name is None or description is None:
        return service_failure("Invalid input: expected string, received undefined", 400)

    required = {
        "name": name.strip(),
        "description": description.strip(),
    }
    if update:
        required["id"] = identifier or ""
    return required


def _parse_estimated_days(value: object | None):
    # A coluna estimated_days e integer no banco. Numeros decimais (ex.: 2.5)
    # seriam perdidos como NULL pelo optional_int; melhor rejeitar com erro claro.
    if value is None:
        return None, None
    if isinstance(value, bool):
        return None, service_failure("Dias estimados inválido.", 400, field="estimatedDays")
    if isinstance(value, int):
        return value, None
    if isinstance(value, float):
        if value.is_integer():
            return int(value), None
        return None, service_failure(
            "Dias estimados deve ser um número inteiro.", 400, field="estimatedDays"
        )
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None, None
        try:
            return int(text), None
        except ValueError:
            return None, service_failure(
                "Dias estimados deve ser um número inteiro.", 400, field="estimatedDays"
            )
    return None, service_failure("Dias estimados inválido.", 400, field="estimatedDays")


def _require_task_payload(payload: dict[str, object], *, include_id: bool):
    if include_id:
        identifier = _optional_str(payload.get("id"))
        if identifier is None:
            return service_failure("Invalid input: expected string, received undefined", 400)
    else:
        identifier = None

    project_id = _optional_str(payload.get("projectId"))
    project_activity_id = _optional_str(payload.get("projectActivityId"))
    name = _optional_str(payload.get("name"))
    description = _optional_str(payload.get("description"))
    priority = _optional_str(payload.get("priority"))
    status = _optional_str(payload.get("status"))
    if any(value is None for value in (project_id, project_activity_id, name, description, priority, status)):
        return service_failure("Invalid input: expected string, received undefined", 400)

    required = {
        "projectId": project_id.strip(),
        "projectActivityId": project_activity_id.strip(),
        "name": name.strip(),
        "description": description.strip(),
        "priority": priority.strip(),
        "status": status.strip(),
    }
    if include_id:
        required["id"] = identifier or ""
    return required
