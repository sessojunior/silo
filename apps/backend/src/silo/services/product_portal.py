from __future__ import annotations

import asyncio
from collections.abc import Iterable
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import and_, asc, delete, desc, func, insert, or_, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.engine import Connection

from silo.auth.mail import send_plain_email
from silo.date import format_date_br, parse_date
from silo.db.models import legacy_tables
from silo.db.serialization import serialize_legacy_row
from silo.domain.model_run_status import normalize_model_run_status
from silo.domain.scheduling import (
    SHIFT_CODES,
    ProfessionalSchedule,
    ScheduleBlock,
    ScheduleException,
    TimeSlot,
    WorkSchedule,
    check_slot_fit,
    get_shift_slot,
)
from silo.services.analytics_common import format_br_day_short, format_local_datetime_text, is_incident_status, normalize_shift_turns
from silo.services.common import service_failure, service_success
from silo.services.dataflow_portal import get_product_data_flow_pipelines_from_kafka_rest_sync
from silo.services.embedding_write import (
    upsert_manual_chunks,
    upsert_problem_embedding,
    upsert_solution_embedding,
)
from silo.services.legacy_utils import new_uuid, now_naive, optional_int, optional_str, normalize_whitespace
from silo.storage.uploads import delete_upload_file, is_safe_filename, is_upload_kind, list_upload_files

PRODUCT_AVAILABILITY_EXCEPTION_TYPES: tuple[str, ...] = ("holiday", "pause", "extra")
PRODUCT_PRIORITY_VALUES: tuple[str, ...] = ("low", "normal", "high", "urgent")
PRODUCT_TASK_STATUSES: tuple[str, ...] = ("todo", "in_progress", "blocked", "review", "done")
PROFILE_IMAGE_FALLBACK = "/images/profile.png"
DEFAULT_WORK_DAYS: list[int] = [0, 1, 2, 3, 4, 5, 6]
_CURRENT_CONNECTION: ContextVar[Connection | None] = ContextVar("_CURRENT_CONNECTION", default=None)


@contextmanager
def bind_connection(connection: Connection):
    token = _CURRENT_CONNECTION.set(connection)
    try:
        yield
    finally:
        _CURRENT_CONNECTION.reset(token)


def get_product_activity_availability(
    *,
    product_id: str,
    date_value: str,
    turn: int,
    activity_id: str | None = None,
) -> dict[str, object]:
    product_table = legacy_tables["product"]
    activity_table = legacy_tables["product_activity"]
    availability_table = legacy_tables["product_availability_exception"]

    product_row = _fetch_product_by_id(product_id)
    if product_row is None:
        return service_failure("Produto não encontrado.", 404)

    allowed_turns = normalize_shift_turns(product_row.get("turns"))
    if not bool(product_row.get("available")):
        return service_success(
            {
                "requestedDate": date_value,
                "requestedTurn": turn,
                "allowedTurns": allowed_turns,
                "fits": False,
                "reason": "product_unavailable",
                "conflictCount": 0,
                "suggestedSlots": [],
            }
        )

    requested_turn_allowed = str(turn) in allowed_turns
    requested_slot = get_shift_slot(_date_to_datetime(date_value), str(turn))
    range_end = _date_to_datetime(date_value) + timedelta(days=7)

    activity_rows = _connection_select_rows(
        select(activity_table.c.id, activity_table.c.date, activity_table.c.turn)
        .where(
            and_(
                activity_table.c.product_id == product_id,
                activity_table.c.date >= parse_date(date_value) if date_value else True,
                activity_table.c.date <= range_end.date(),
            )
        )
    )
    blocks = []
    for row in activity_rows:
        if activity_id and str(row["id"]) == activity_id:
            continue
        turn_code = str(row["turn"])
        if turn_code not in SHIFT_CODES:
            continue
        blocks.append(
            ScheduleBlock(
                id=str(row["id"]),
                reason="Atividade existente",
                slot=get_shift_slot(_date_to_datetime(str(row["date"])), turn_code),
            )
        )

    exception_rows = _connection_select_rows(
        select(
            availability_table.c.date,
            availability_table.c.type,
            availability_table.c.description,
        ).where(
            and_(
                availability_table.c.product_id == product_id,
                availability_table.c.date >= parse_date(date_value),
                availability_table.c.date <= range_end.date(),
            )
        )
    )
    exceptions = [
        ScheduleException(
            date=_date_to_datetime(str(row["date"])),
            type=str(row["type"]),
            description=str(row["description"]) if row.get("description") is not None else None,
        )
        for row in exception_rows
        if str(row.get("type") or "") in PRODUCT_AVAILABILITY_EXCEPTION_TYPES
    ]

    professional_schedule = ProfessionalSchedule(
        professional_id=product_row["id"],
        work_schedule=WorkSchedule(
            shifts_per_day=allowed_turns,
            work_days=DEFAULT_WORK_DAYS,
        ),
        blocks=blocks,
        exceptions=exceptions,
    )
    fit_result = check_slot_fit(requested_slot, professional_schedule)
    reason = "turn_not_allowed" if not requested_turn_allowed else "conflict" if fit_result.conflicts else "available"

    return service_success(
        {
            "requestedDate": date_value,
            "requestedTurn": turn,
            "allowedTurns": allowed_turns,
            "fits": reason == "available",
            "reason": reason,
            "conflictCount": len(fit_result.conflicts),
            "suggestedSlots": [
                {"date": slot.start.date().isoformat(), "turn": slot.start.hour}
                for slot in fit_result.suggested_slots
            ],
        }
    )


def list_product_availability_exceptions(
    *,
    product_id: str,
    from_date: str | None = None,
    to_date: str | None = None,
) -> dict[str, object]:
    product_row = _fetch_product_by_id(product_id)
    if product_row is None:
        return service_failure("Produto não encontrado.", 404)

    availability_table = legacy_tables["product_availability_exception"]
    conditions = [availability_table.c.product_id == product_id]
    if from_date:
        conditions.append(availability_table.c.date >= parse_date(from_date))
    if to_date:
        conditions.append(availability_table.c.date <= parse_date(to_date))

    rows = _connection_select_rows(
        select(availability_table).where(and_(*conditions)).order_by(
            asc(availability_table.c.date), asc(availability_table.c.type)
        )
    )
    items = [serialize_legacy_row(row) for row in rows]
    return service_success({"items": items})


def upsert_product_availability_exception(
    *,
    product_id: str,
    date_value: str,
    type_value: str,
    description: str | None = None,
) -> dict[str, object]:
    product_row = _fetch_product_by_id(product_id)
    if product_row is None:
        return service_failure("Produto não encontrado.", 404)
    if type_value not in PRODUCT_AVAILABILITY_EXCEPTION_TYPES:
        return service_failure("Tipo de exceção inválido.", 400)

    availability_table = legacy_tables["product_availability_exception"]
    existing = _connection_select_first(
        select(availability_table.c.id).where(
            and_(
                availability_table.c.product_id == product_id,
                availability_table.c.date == parse_date(date_value),
                availability_table.c.type == type_value,
            )
        )
    )

    row = {
        "id": new_uuid(),
        "product_id": product_id,
        "date": parse_date(date_value),
        "type": type_value,
        "description": description.strip() if isinstance(description, str) else None,
        "created_at": now_naive(),
        "updated_at": now_naive(),
    }
    statement = (
        pg_insert(availability_table)
        .values(row)
        .on_conflict_do_update(
            index_elements=[
                availability_table.c.product_id,
                availability_table.c.date,
                availability_table.c.type,
            ],
            set_={
                "description": row["description"],
                "updated_at": now_naive(),
            },
        )
        .returning(availability_table)
    )
    created = _connection_execute_first(statement)
    if created is None:
        return service_failure("Erro ao salvar exceção de disponibilidade.", 500)

    action = "updated" if existing is not None else "created"
    return service_success({"action": action, "exception": serialize_legacy_row(created)})


def delete_product_availability_exception(exception_id: str) -> dict[str, object]:
    availability_table = legacy_tables["product_availability_exception"]
    existing = _connection_select_first(select(availability_table.c.id).where(availability_table.c.id == exception_id))
    if existing is None:
        return service_failure("Exceção não encontrada.", 404)

    _connection_execute(delete(availability_table).where(availability_table.c.id == exception_id))
    _commit()
    return service_success(None)


def list_product_activity_history(
    *,
    product_id: str,
    date_value: str | None,
    turn_value: int | str | None,
) -> dict[str, object]:
    activity_table = legacy_tables["product_activity"]
    history_table = legacy_tables["product_activity_history"]
    user_table = legacy_tables["user"]

    if not date_value:
        return service_failure("Data inválida.", 400)
    try:
        date_object = parse_date(date_value)
    except Exception:
        return service_failure("Data inválida.", 400)

    try:
        turn = int(turn_value) if turn_value is not None else None
    except (TypeError, ValueError):
        turn = None
    if turn is None:
        return service_failure("Turno inválido.", 400)

    current_activity = _connection_select_first(
        select(activity_table.c.id).where(
            and_(
                activity_table.c.product_id == product_id,
                activity_table.c.date == date_object,
                activity_table.c.turn == turn,
            )
        )
    )
    if current_activity is None:
        return service_success({"history": []})

    rows = _connection_select_rows(
        select(
            history_table.c.id,
            history_table.c.status,
            history_table.c.description,
            history_table.c.intervention,
            history_table.c.created_at,
            user_table.c.id.label("user_id"),
            user_table.c.name,
            user_table.c.email,
            user_table.c.image,
        )
        .select_from(history_table.join(user_table, history_table.c.user_id == user_table.c.id))
        .where(history_table.c.product_activity_id == current_activity["id"])
        .order_by(desc(history_table.c.created_at))
    )

    history = []
    for row in rows:
        item = serialize_legacy_row(row)
        item["user"] = {
            "id": str(row["user_id"]),
            "name": row.get("name"),
            "email": row.get("email"),
            "image": row.get("image"),
        }
        history.append(item)

    activity_row = _connection_select_first(select(activity_table).where(activity_table.c.id == current_activity["id"]))
    return service_success({"task": serialize_legacy_row(activity_row), "history": history})


def list_product_activity_pending_email_recipients() -> dict[str, object]:
    user_table = legacy_tables["user"]
    rows = _connection_select_rows(
        select(user_table.c.id, user_table.c.name, user_table.c.email, user_table.c.image)
        .where(user_table.c.is_active.is_(True))
        .order_by(asc(user_table.c.name))
    )
    items = [serialize_legacy_row(row) for row in rows]
    return service_success({"items": items, "total": len(items)})


def send_product_activity_pending_email(
    *,
    product_id: str,
    date_value: str,
    turn: int,
    status: str,
    incident_name: str | None,
    recipient_user_ids: list[str],
    message: str,
) -> dict[str, object]:
    product_row = _fetch_product_by_id(product_id)
    if product_row is None:
        return service_failure("Produto não encontrado.", 404)

    user_table = legacy_tables["user"]
    recipients = _connection_select_rows(
        select(user_table.c.id, user_table.c.name, user_table.c.email)
        .where(and_(user_table.c.id.in_(tuple(dict.fromkeys(recipient_user_ids))), user_table.c.is_active.is_(True)))
        .order_by(asc(user_table.c.name))
    )

    recipient_ids = [str(row["id"]) for row in recipients]
    requested_ids = list(dict.fromkeys(recipient_user_ids))
    if len(recipient_ids) != len(requested_ids):
        return service_failure("Um ou mais destinatários não encontrados ou inativos.", 400)

    incident_suffix = f" - {incident_name}" if incident_name else ""
    subject = f"Pendências do turno - {product_row['name']}{incident_suffix} - {status} - {format_date_br(date_value)} {turn}h"
    for recipient in recipients:
        send_plain_email(
            to=str(recipient["email"] or ""),
            subject=subject,
            text=message,
        )

    return service_success({"sent": len(recipients)})


def upsert_product_activity(
    *,
    user_id: str,
    product_id: str,
    date_value: str | date,
    turn: int,
    status: str,
    description: str | None = None,
    intervention: str | None = None,
    problem_category_id: str | None = None,
) -> dict[str, object]:
    product_row = _fetch_product_by_id(product_id)
    if product_row is None:
        return service_failure("Produto não encontrado.", 404)

    activity_table = legacy_tables["product_activity"]
    history_table = legacy_tables["product_activity_history"]
    date_object = parse_date(date_value) if isinstance(date_value, str) else date_value
    if date_object is None:
        return service_failure("Data inválida.", 400)

    now = now_naive()
    existing = _connection_select_first(
        select(activity_table.c.id, activity_table.c.created_at, activity_table.c.updated_at).where(
            and_(
                activity_table.c.product_id == product_id,
                activity_table.c.date == date_object,
                activity_table.c.turn == turn,
            )
        )
    )

    values = {
        "id": existing["id"] if existing is not None else new_uuid(),
        "product_id": product_id,
        "user_id": user_id,
        "date": date_object,
        "turn": turn,
        "status": status,
        "description": description,
        "intervention": intervention,
        "problem_category_id": problem_category_id,
        "created_at": existing["created_at"] if existing is not None else now,
        "updated_at": now,
    }

    statement = (
        pg_insert(activity_table)
        .values(values)
        .on_conflict_do_update(
            index_elements=[activity_table.c.product_id, activity_table.c.date, activity_table.c.turn],
            set_={
                "user_id": user_id,
                "status": status,
                "description": description,
                "intervention": intervention,
                "problem_category_id": problem_category_id,
                "updated_at": now,
            },
        )
        .returning(activity_table)
    )
    row = _connection_execute_first(statement)
    if row is None:
        return service_failure("Erro ao salvar atividade.", 500)

    action = "created" if row["created_at"] == row["updated_at"] else "updated"
    _record_product_activity_history(
        history_table=history_table,
        activity_id=str(row["id"]),
        user_id=user_id,
        status=str(row["status"]),
        description=row.get("description"),
        intervention=row.get("intervention"),
    )
    return service_success({"activity": row, "action": action})


def update_product_activity(
    *,
    user_id: str,
    id: str,
    status: str,
    description: str | None = None,
    intervention: str | None = None,
    problem_category_id: str | None = None,
) -> dict[str, object]:
    activity_table = legacy_tables["product_activity"]
    history_table = legacy_tables["product_activity_history"]

    now = now_naive()
    row = _connection_execute_first(
        update(activity_table)
        .where(activity_table.c.id == id)
        .values(
            status=status,
            description=description,
            intervention=intervention,
            problem_category_id=problem_category_id,
            updated_at=now,
        )
        .returning(activity_table)
    )
    if row is None:
        return service_failure("Atividade não encontrada.", 404)

    _record_product_activity_history(
        history_table=history_table,
        activity_id=id,
        user_id=user_id,
        status=status,
        description=description,
        intervention=intervention,
    )
    return service_success({"activity": row})


def list_product_contacts(product_id: str) -> dict[str, object]:
    contact_table = legacy_tables["contact"]
    product_contact_table = legacy_tables["product_contact"]
    rows = _connection_select_rows(
        select(
            contact_table.c.id,
            contact_table.c.name,
            contact_table.c.role,
            contact_table.c.team,
            contact_table.c.email,
            contact_table.c.phone,
            contact_table.c.image,
            contact_table.c.active,
            product_contact_table.c.id.label("association_id"),
            product_contact_table.c.created_at,
        )
        .select_from(product_contact_table.join(contact_table, product_contact_table.c.contact_id == contact_table.c.id))
        .where(and_(product_contact_table.c.product_id == product_id, contact_table.c.active.is_(True)))
        .order_by(product_contact_table.c.created_at)
    )
    return service_success({"contacts": [serialize_legacy_row(row) for row in rows]})


def replace_product_contacts(*, product_id: str, contact_ids: list[str]) -> dict[str, object]:
    product_contact_table = legacy_tables["product_contact"]
    unique_contact_ids: list[str] = []
    for contact_id in contact_ids:
        if contact_id not in unique_contact_ids:
            unique_contact_ids.append(contact_id)

    _connection_execute(delete(product_contact_table).where(product_contact_table.c.product_id == product_id))
    if unique_contact_ids:
        _connection_execute(
            insert(product_contact_table),
            [
                {
                    "id": new_uuid(),
                    "product_id": product_id,
                    "contact_id": contact_id,
                    "created_at": now_naive(),
                }
                for contact_id in unique_contact_ids
            ],
        )
    _commit()
    return service_success(None)


def delete_product_contact_association(association_id: str) -> dict[str, object]:
    product_contact_table = legacy_tables["product_contact"]
    existing = _connection_select_first(select(product_contact_table.c.id).where(product_contact_table.c.id == association_id))
    if existing is None:
        return service_failure("Associação não encontrada.", 404)

    _connection_execute(delete(product_contact_table).where(product_contact_table.c.id == association_id))
    _commit()
    return service_success(None)


def list_product_dependencies(product_id: str) -> dict[str, object]:
    dependency_table = legacy_tables["product_dependency"]
    rows = _connection_select_rows(
        select(dependency_table).where(dependency_table.c.product_id == product_id).order_by(dependency_table.c.sort_key)
    )
    serialized = [serialize_legacy_row(row) for row in rows]
    return service_success(_build_dependency_tree(serialized))


def create_product_dependency(
    *,
    product_id: str,
    name: str,
    icon: str | None = None,
    description: str | None = None,
    parent_id: str | None = None,
) -> dict[str, object]:
    dependency_table = legacy_tables["product_dependency"]
    siblings = _connection_select_rows(
        select(dependency_table.c.id).where(
            and_(
                dependency_table.c.product_id == product_id,
                dependency_table.c.parent_id == parent_id if parent_id else dependency_table.c.parent_id.is_(None),
            )
        )
    )
    next_position = len(siblings)
    parent_row = _connection_select_first(select(dependency_table).where(dependency_table.c.id == parent_id)) if parent_id else None
    tree_path = _calculate_tree_path(parent_row.get("tree_path") if parent_row else None, next_position)
    sort_key = _calculate_sort_key(parent_row.get("sort_key") if parent_row else None, next_position)
    tree_depth = _calculate_tree_depth(parent_row.get("tree_depth") if parent_row else None)

    row = {
        "id": new_uuid(),
        "product_id": product_id,
        "name": name,
        "icon": icon,
        "description": description,
        "parent_id": parent_id,
        "tree_path": tree_path,
        "tree_depth": tree_depth,
        "sort_key": sort_key,
        "created_at": now_naive(),
        "updated_at": now_naive(),
    }
    created = _connection_execute_first(insert(dependency_table).values(row).returning(dependency_table))
    if created is None:
        return service_failure("Erro ao criar dependência.", 500)
    return service_success({"dependency": serialize_legacy_row(created)})


def update_product_dependency(
    *,
    id: str,
    name: str,
    icon: str | None = None,
    description: str | None = None,
    parent_id: str | None = None,
    new_position: int | None = None,
) -> dict[str, object]:
    dependency_table = legacy_tables["product_dependency"]
    existing = _connection_select_first(select(dependency_table).where(dependency_table.c.id == id))
    if existing is None:
        return service_failure("Dependência não encontrada.", 404)

    update_data: dict[str, Any] = {
        "name": name,
        "icon": icon,
        "description": description,
        "updated_at": now_naive(),
    }
    if new_position is not None:
        parent_row = _connection_select_first(select(dependency_table).where(dependency_table.c.id == parent_id)) if parent_id else None
        update_data["parent_id"] = parent_id
        update_data["tree_path"] = _calculate_tree_path(parent_row.get("tree_path") if parent_row else None, new_position)
        update_data["sort_key"] = _calculate_sort_key(parent_row.get("sort_key") if parent_row else None, new_position)
        update_data["tree_depth"] = _calculate_tree_depth(parent_row.get("tree_depth") if parent_row else None)

    updated = _connection_execute_first(
        update(dependency_table).where(dependency_table.c.id == id).values(**update_data).returning(dependency_table)
    )
    if updated is None:
        return service_failure("Dependência não encontrada.", 404)
    return service_success({"dependency": serialize_legacy_row(updated)})


def delete_product_dependency(id: str) -> dict[str, object]:
    dependency_table = legacy_tables["product_dependency"]
    existing = _connection_select_first(select(dependency_table.c.id).where(dependency_table.c.id == id))
    if existing is None:
        return service_failure("Dependência não encontrada.", 404)

    child = _connection_select_first(select(dependency_table.c.id).where(dependency_table.c.parent_id == id))
    if child is not None:
        return service_failure("Não é possível excluir uma dependência que possui itens filhos.", 400)

    _connection_execute(delete(dependency_table).where(dependency_table.c.id == id))
    _commit()
    return service_success(None)


def reorder_product_dependencies(
    *,
    product_id: str,
    items: list[dict[str, object]],
) -> dict[str, object]:
    dependency_table = legacy_tables["product_dependency"]
    existing_ids = {
        str(row["id"])
        for row in _connection_select_rows(select(dependency_table.c.id).where(dependency_table.c.product_id == product_id))
    }
    if any(str(item.get("id") or "") not in existing_ids for item in items):
        return service_failure("Alguns itens não pertencem a este produto", 400)

    _begin()
    try:
        for item in items:
            _connection_execute(
                update(dependency_table)
                .where(dependency_table.c.id == str(item.get("id")))
                .values(
                    parent_id=item.get("parentId"),
                    tree_path=item.get("treePath"),
                    tree_depth=item.get("treeDepth"),
                    sort_key=item.get("sortKey"),
                    updated_at=now_naive(),
                )
            )
        _commit()
    except Exception:
        _rollback()
        raise
    return service_success(None)


def get_product_manual(*, product_slug: str | None = None, product_id: str | None = None) -> dict[str, object]:
    product_table = legacy_tables["product"]
    manual_table = legacy_tables["product_manual"]

    if product_slug:
        row = _connection_select_first(
            select(manual_table)
            .select_from(product_table.outerjoin(manual_table, manual_table.c.product_id == product_table.c.id))
            .where(product_table.c.slug == product_slug)
            .limit(1)
        )
        manual = serialize_legacy_row(row) if row is not None and row["id"] is not None else None
        return service_success({"manual": manual})

    if product_id:
        row = _connection_select_first(select(manual_table).where(manual_table.c.product_id == product_id).limit(1))
        manual = serialize_legacy_row(row) if row is not None and row["id"] is not None else None
        return service_success({"manual": manual})

    return service_failure("productSlug ou productId é obrigatório", 400)


def upsert_product_manual(*, product_id: str, description: str) -> dict[str, object]:
    product_table = legacy_tables["product"]
    manual_table = legacy_tables["product_manual"]

    if _connection_select_first(select(product_table.c.id).where(product_table.c.id == product_id)) is None:
        return service_failure("Produto não encontrado", 404)

    existing = _connection_select_first(select(manual_table).where(manual_table.c.product_id == product_id).limit(1))
    if existing is not None:
        updated = _connection_execute_first(
            update(manual_table)
            .where(manual_table.c.product_id == product_id)
            .values(description=description, updated_at=now_naive())
            .returning(manual_table)
        )
        if updated is None:
            return service_failure("Erro ao salvar manual.", 500)
        manual_row = updated
    else:
        manual_row = _connection_execute_first(
            insert(manual_table)
            .values(
                id=new_uuid(),
                product_id=product_id,
                description=description,
                created_at=now_naive(),
                updated_at=now_naive(),
            )
            .returning(manual_table)
        )
        if manual_row is None:
            return service_failure("Erro ao salvar manual.", 500)

    _fire_and_forget(upsert_manual_chunks(str(manual_row["id"]), product_id, description))
    return service_success({"manual": serialize_legacy_row(manual_row)})


def list_product_problems(*, slug: str, page: int = 1, limit: int = 20) -> dict[str, object]:
    product_table = legacy_tables["product"]
    problem_table = legacy_tables["product_problem"]
    category_table = legacy_tables["product_problem_category"]
    user_table = legacy_tables["user"]

    product_row = _connection_select_first(select(product_table.c.id).where(product_table.c.slug == slug))
    if product_row is None:
        return service_failure("Produto não encontrado.", 404)

    offset = max(0, page - 1) * max(1, limit)
    rows = _connection_select_rows(
        select(
            problem_table.c.id,
            problem_table.c.product_id,
            problem_table.c.user_id,
            problem_table.c.title,
            problem_table.c.description,
            problem_table.c.problem_category_id,
            category_table.c.name.label("category_name"),
            category_table.c.color.label("category_color"),
            problem_table.c.created_at,
            problem_table.c.updated_at,
            user_table.c.name.label("user_name"),
        )
        .select_from(
            problem_table.outerjoin(user_table, problem_table.c.user_id == user_table.c.id).outerjoin(
                category_table, problem_table.c.problem_category_id == category_table.c.id
            )
        )
        .where(problem_table.c.product_id == product_row["id"])
        .order_by(desc(problem_table.c.created_at), desc(problem_table.c.id))
        .limit(limit)
        .offset(offset)
    )
    return service_success({"items": [serialize_legacy_row(row) for row in rows]})


def create_product_problem(
    *,
    product_id: str,
    user_id: str,
    title: str,
    description: str,
    problem_category_id: str,
) -> dict[str, object]:
    category_table = legacy_tables["product_problem_category"]
    problem_table = legacy_tables["product_problem"]

    if _connection_select_first(select(category_table.c.id).where(category_table.c.id == problem_category_id)) is None:
        return service_failure("Categoria não encontrada.", 400)

    problem_id = new_uuid()
    now = now_naive()
    _connection_execute(
        insert(problem_table).values(
            id=problem_id,
            product_id=product_id,
            user_id=user_id,
            title=title.strip(),
            description=description.strip(),
            problem_category_id=problem_category_id,
            created_at=now,
            updated_at=now,
        )
    )
    _commit()
    _fire_and_forget(upsert_problem_embedding(problem_id, title, description))
    return service_success(None)


def update_product_problem(
    *,
    id: str,
    title: str,
    description: str,
    problem_category_id: str,
) -> dict[str, object]:
    problem_table = legacy_tables["product_problem"]
    updated = _connection_execute_first(
        update(problem_table)
        .where(problem_table.c.id == id)
        .values(
            title=title.strip(),
            description=description.strip(),
            problem_category_id=problem_category_id,
            updated_at=now_naive(),
        )
        .returning(problem_table)
    )
    if updated is None:
        return service_failure("Problema não encontrado.", 404)
    _fire_and_forget(upsert_problem_embedding(id, title, description))
    return service_success(None)


def delete_product_problem(id: str) -> dict[str, object]:
    problem_table = legacy_tables["product_problem"]
    problem_image_table = legacy_tables["product_problem_image"]
    solution_table = legacy_tables["product_solution"]
    solution_checked_table = legacy_tables["product_solution_checked"]
    solution_image_table = legacy_tables["product_solution_image"]

    existing = _connection_select_first(select(problem_table.c.id).where(problem_table.c.id == id))
    if existing is None:
        return service_failure("Problema não encontrado.", 404)

    _begin()
    try:
        solution_rows = _connection_select_rows(select(solution_table.c.id).where(solution_table.c.product_problem_id == id))
        solution_ids = [str(row["id"]) for row in solution_rows]
        if solution_ids:
            _connection_execute(delete(solution_checked_table).where(solution_checked_table.c.product_solution_id.in_(tuple(solution_ids))))
            _connection_execute(delete(solution_image_table).where(solution_image_table.c.product_solution_id.in_(tuple(solution_ids))))
            _connection_execute(delete(solution_table).where(solution_table.c.product_problem_id == id))
        _connection_execute(delete(problem_image_table).where(problem_image_table.c.product_problem_id == id))
        _connection_execute(delete(problem_table).where(problem_table.c.id == id))
        _commit()
    except Exception:
        _rollback()
        raise
    return service_success(None)


def list_product_problem_images(problem_id: str) -> dict[str, object]:
    table = legacy_tables["product_problem_image"]
    rows = _connection_select_rows(select(table).where(table.c.product_problem_id == problem_id))
    return service_success({"items": [serialize_legacy_row(row) for row in rows]})


def create_product_problem_image(
    *,
    product_problem_id: str,
    image: str,
    description: str | None = None,
) -> dict[str, object]:
    table = legacy_tables["product_problem_image"]
    row = {
        "id": new_uuid(),
        "product_problem_id": product_problem_id,
        "image": image,
        "description": description or "",
    }
    created = _connection_execute_first(insert(table).values(row).returning(table))
    if created is None:
        return service_failure("Erro ao fazer upload.", 500)
    return service_success({"image": serialize_legacy_row(created)})


def delete_product_problem_image(id: str) -> dict[str, object]:
    table = legacy_tables["product_problem_image"]
    row = _connection_select_first(select(table).where(table.c.id == id))
    if row is None:
        return service_failure("Imagem não encontrada.", 404)
    _connection_execute(delete(table).where(table.c.id == id))
    _commit()
    return service_success({"image": serialize_legacy_row(row)})


def list_product_problem_categories(search: str | None = None) -> dict[str, object]:
    table = legacy_tables["product_problem_category"]
    statement = select(table)
    if search:
        statement = statement.where(table.c.name.ilike(f"%{search}%"))
    rows = _connection_select_rows(statement.order_by(table.c.name.asc()))
    return service_success({"items": [serialize_legacy_row(row) for row in rows]})


def create_product_problem_category(*, name: str, color: str | None = None) -> dict[str, object]:
    table = legacy_tables["product_problem_category"]
    existing = _connection_select_first(select(table.c.id).where(table.c.name == name.strip()))
    if existing is not None:
        return service_failure("Já existe outra categoria com esse nome.", 400)

    row = {
        "id": new_uuid(),
        "name": name.strip(),
        "color": color or None,
        "is_system": False,
        "sort_order": 0,
        "created_at": now_naive(),
        "updated_at": now_naive(),
    }
    created = _connection_execute_first(insert(table).values(row).returning(table))
    if created is None:
        return service_failure("Erro ao criar categoria.", 500)
    return service_success({"category": serialize_legacy_row(created)})


def update_product_problem_category(*, id: str, name: str, color: str | None = None) -> dict[str, object]:
    table = legacy_tables["product_problem_category"]
    existing = _connection_select_first(select(table).where(table.c.id == id))
    if existing is None:
        return service_failure("Categoria não encontrada.", 404)

    duplicate = _connection_select_first(
        select(table.c.id).where(and_(table.c.name == name.strip(), table.c.id != id))
    )
    if duplicate is not None:
        return service_failure("Já existe outra categoria com esse nome.", 400)

    updated = _connection_execute_first(
        update(table)
        .where(table.c.id == id)
        .values(name=name.strip(), color=color or None, updated_at=now_naive())
        .returning(table)
    )
    if updated is None:
        return service_failure("Categoria não encontrada.", 404)
    return service_success(None)


def delete_product_problem_category(id: str) -> dict[str, object]:
    table = legacy_tables["product_problem_category"]
    existing = _connection_select_first(select(table.c.id).where(table.c.id == id))
    if existing is None:
        return service_failure("Categoria não encontrada.", 404)
    _connection_execute(delete(table).where(table.c.id == id))
    _commit()
    return service_success(None)


def list_product_solutions(problem_id: str) -> dict[str, object]:
    solution_table = legacy_tables["product_solution"]
    checked_table = legacy_tables["product_solution_checked"]
    image_table = legacy_tables["product_solution_image"]
    user_table = legacy_tables["user"]

    solutions = _connection_select_rows(
        select(solution_table)
        .where(solution_table.c.product_problem_id == problem_id)
        .order_by(desc(solution_table.c.created_at), desc(solution_table.c.id))
    )
    if not solutions:
        return service_success({"items": []})

    solution_ids = [str(row["id"]) for row in solutions]
    users = _connection_select_rows(select(user_table).where(user_table.c.id.in_(tuple({str(row["user_id"]) for row in solutions}))))
    checked = _connection_select_rows(select(checked_table.c.product_solution_id).where(checked_table.c.product_solution_id.in_(tuple(solution_ids))))
    checked_ids = {str(row["product_solution_id"]) for row in checked}
    images = _connection_select_rows(select(image_table).where(image_table.c.product_solution_id.in_(tuple(solution_ids))))

    users_by_id = {str(row["id"]): row for row in users}
    images_by_solution: dict[str, list[dict[str, object]]] = {solution_id: [] for solution_id in solution_ids}
    for image_row in images:
        images_by_solution.setdefault(str(image_row["product_solution_id"]), []).append(serialize_legacy_row(image_row))

    items: list[dict[str, object]] = []
    for solution_row in solutions:
        user_row = users_by_id.get(str(solution_row["user_id"]))
        items.append(
            {
                "id": str(solution_row["id"]),
                "replyId": solution_row.get("reply_id"),
                "date": serialize_legacy_row(solution_row)["createdAt"],
                "description": solution_row["description"],
                "verified": str(solution_row["id"]) in checked_ids,
                "user": {
                    "id": str(solution_row["user_id"]),
                    "name": str((user_row or {}).get("name") or "Usuário desconhecido"),
                    "image": PROFILE_IMAGE_FALLBACK,
                },
                "images": images_by_solution.get(str(solution_row["id"]), []),
                "isMine": False,
            }
        )

    return service_success({"items": items})


def create_product_solution(
    *,
    user_id: str,
    problem_id: str,
    description: str,
    reply_id: str | None = None,
    image_url: str | None = None,
) -> dict[str, object]:
    solution_table = legacy_tables["product_solution"]
    image_table = legacy_tables["product_solution_image"]
    solution_id = new_uuid()
    now = now_naive()

    _connection_execute(
        insert(solution_table).values(
            id=solution_id,
            user_id=user_id,
            product_problem_id=problem_id,
            description=description.strip(),
            reply_id=reply_id,
            created_at=now,
            updated_at=now,
        )
    )
    if image_url:
        _connection_execute(
            insert(image_table).values(
                id=new_uuid(),
                product_solution_id=solution_id,
                image=image_url,
                description="",
            )
        )
    _commit()
    _fire_and_forget(upsert_solution_embedding(solution_id, description))
    return service_success(None)


def update_product_solution(
    *,
    user_id: str,
    id: str,
    description: str,
    image_url: str | None = None,
    remove_image: bool = False,
) -> dict[str, object]:
    solution_table = legacy_tables["product_solution"]
    image_table = legacy_tables["product_solution_image"]
    existing = _connection_select_first(select(solution_table).where(solution_table.c.id == id))
    if existing is None or str(existing["user_id"]) != user_id:
        return service_failure("Permissão negada.", 403)

    updated = _connection_execute_first(
        update(solution_table)
        .where(solution_table.c.id == id)
        .values(description=description.strip(), updated_at=now_naive())
        .returning(solution_table)
    )
    if updated is None:
        return service_failure("Solução não encontrada.", 404)

    if image_url:
        _connection_execute(delete(image_table).where(image_table.c.product_solution_id == id))
        _connection_execute(
            insert(image_table).values(
                id=new_uuid(),
                product_solution_id=id,
                image=image_url,
                description="",
            )
        )
        _commit()
    elif remove_image:
        _connection_execute(delete(image_table).where(image_table.c.product_solution_id == id))
        _commit()
    else:
        _commit()

    _fire_and_forget(upsert_solution_embedding(id, description))
    return service_success(None)


def delete_product_solution(*, user_id: str, id: str) -> dict[str, object]:
    solution_table = legacy_tables["product_solution"]
    checked_table = legacy_tables["product_solution_checked"]
    image_table = legacy_tables["product_solution_image"]

    existing = _connection_select_first(select(solution_table).where(solution_table.c.id == id))
    if existing is None or str(existing["user_id"]) != user_id:
        return service_failure("Permissão negada.", 403)

    _begin()
    try:
        child_ids = _collect_solution_descendants(id)
        all_ids = [id, *child_ids]
        if all_ids:
            _connection_execute(delete(checked_table).where(checked_table.c.product_solution_id.in_(tuple(all_ids))))
            _connection_execute(delete(image_table).where(image_table.c.product_solution_id.in_(tuple(all_ids))))
            _connection_execute(delete(solution_table).where(solution_table.c.id.in_(tuple(all_ids))))
        _commit()
    except Exception:
        _rollback()
        raise
    return service_success(None)


def count_product_solutions(problem_ids: list[str]) -> dict[str, object]:
    solution_table = legacy_tables["product_solution"]
    result = _connection_select_rows(
        select(solution_table.c.product_problem_id, func.count(solution_table.c.id).label("count"))
        .where(solution_table.c.product_problem_id.in_(tuple(problem_ids)))
        .group_by(solution_table.c.product_problem_id)
    )
    counts = {problem_id: 0 for problem_id in problem_ids}
    for row in result:
        counts[str(row["product_problem_id"])] = int(row["count"])
    return service_success(counts)


def get_product_solutions_summary(product_slug: str) -> dict[str, object]:
    product_table = legacy_tables["product"]
    problem_table = legacy_tables["product_problem"]
    solution_table = legacy_tables["product_solution"]

    product_row = _connection_select_first(select(product_table.c.id).where(product_table.c.slug == product_slug))
    if product_row is None:
        return service_success({"totalSolutions": 0, "lastUpdated": None})

    problems = _connection_select_rows(
        select(problem_table.c.id, problem_table.c.updated_at).where(problem_table.c.product_id == product_row["id"])
    )
    if not problems:
        return service_success({"totalSolutions": 0, "lastUpdated": None})

    problem_ids = [str(row["id"]) for row in problems]
    solutions = _connection_select_rows(
        select(solution_table.c.product_problem_id, solution_table.c.updated_at).where(solution_table.c.product_problem_id.in_(tuple(problem_ids)))
    )

    total_solutions = len(solutions)
    last_updated: datetime | None = None
    for problem_row in problems:
        candidate = problem_row["updated_at"]
        if isinstance(candidate, datetime) and (last_updated is None or candidate > last_updated):
            last_updated = candidate
    for solution_row in solutions:
        candidate = solution_row["updated_at"]
        if isinstance(candidate, datetime) and (last_updated is None or candidate > last_updated):
            last_updated = candidate

    return service_success(
        {
            "totalSolutions": total_solutions,
            "lastUpdated": format_local_datetime_text(last_updated) if last_updated is not None else None,
        }
    )


def list_product_solution_images(solution_id: str) -> dict[str, object]:
    table = legacy_tables["product_solution_image"]
    rows = _connection_select_rows(select(table).where(table.c.product_solution_id == solution_id))
    return service_success({"items": [serialize_legacy_row(row) for row in rows]})


def create_product_solution_image(
    *,
    product_solution_id: str,
    image: str,
    description: str | None = None,
) -> dict[str, object]:
    table = legacy_tables["product_solution_image"]
    created = _connection_execute_first(
        insert(table)
        .values(
            id=new_uuid(),
            product_solution_id=product_solution_id,
            image=image,
            description=description or "",
        )
        .returning(table)
    )
    if created is None:
        return service_failure("Erro ao fazer upload.", 500)
    return service_success({"image": serialize_legacy_row(created)})


def delete_product_solution_image(id: str) -> dict[str, object]:
    table = legacy_tables["product_solution_image"]
    row = _connection_select_first(select(table).where(table.c.id == id))
    if row is None:
        return service_failure("Imagem não encontrada.", 404)
    _connection_execute(delete(table).where(table.c.id == id))
    _commit()
    return service_success({"image": serialize_legacy_row(row)})


def list_product_data_flow_pipelines(
    *,
    product_slug: str,
    date_value: str | None = None,
    turn: str | None = None,
) -> dict[str, object]:
    if not product_slug.strip():
        return service_failure("Produto inválido.", 400)
    pipelines = get_product_data_flow_pipelines_from_kafka_rest_sync(
        slug=product_slug,
        date=date_value,
        turn=turn,
    )
    return service_success({"pipelines": pipelines})


def _record_product_activity_history(
    *,
    history_table,
    activity_id: str,
    user_id: str,
    status: str,
    description: str | None,
    intervention: str | None,
) -> None:
    try:
        _connection_execute(
            insert(history_table).values(
                id=new_uuid(),
                product_activity_id=activity_id,
                user_id=user_id,
                status=status,
                description=description,
                intervention=intervention,
                created_at=now_naive(),
            )
        )
        _commit()
    except Exception:
        _rollback()


def _collect_solution_descendants(parent_id: str) -> list[str]:
    solution_table = legacy_tables["product_solution"]
    direct_replies = _connection_select_rows(select(solution_table.c.id).where(solution_table.c.reply_id == parent_id))
    all_ids: list[str] = []
    for row in direct_replies:
        reply_id = str(row["id"])
        all_ids.append(reply_id)
        all_ids.extend(_collect_solution_descendants(reply_id))
    return all_ids


def _build_dependency_tree(items: list[dict[str, object]], parent_id: str | None = None) -> list[dict[str, object]]:
    children = [item for item in items if item.get("parentId") == parent_id]
    result: list[dict[str, object]] = []
    for item in children:
        node = dict(item)
        node["children"] = _build_dependency_tree(items, str(item.get("id")))
        result.append(node)
    return result


def _calculate_tree_path(parent_path: str | None, position: int) -> str:
    return f"{parent_path}/{position}" if parent_path else f"/{position}"


def _calculate_sort_key(parent_sort_key: str | None, position: int) -> str:
    position_key = str(position).zfill(3)
    return f"{parent_sort_key}.{position_key}" if parent_sort_key else position_key


def _calculate_tree_depth(parent_depth: int | None) -> int:
    return (parent_depth + 1) if parent_depth is not None else 0


def _date_to_datetime(value: str | date) -> datetime:
    if isinstance(value, date) and not isinstance(value, datetime):
        return datetime(value.year, value.month, value.day)
    if isinstance(value, datetime):
        return value
    parsed = parse_date(value)
    return datetime(parsed.year, parsed.month, parsed.day)


def _fetch_product_by_id(product_id: str) -> dict[str, object] | None:
    product_table = legacy_tables["product"]
    return _connection_select_first(select(product_table).where(product_table.c.id == product_id))


def _connection_select_rows(statement) -> list[dict[str, object]]:
    return list(_db().execute(statement).mappings().all())


def _connection_select_first(statement) -> dict[str, object] | tuple[Any, ...] | None:
    row = _db().execute(statement).mappings().first()
    return row


def _connection_execute(statement, values: object | None = None):
    connection = _db()
    if values is None:
        return connection.execute(statement)
    return connection.execute(statement, values)


def _connection_execute_first(statement) -> dict[str, object] | None:
    row = _db().execute(statement).mappings().first()
    return row


def _db() -> Connection:
    connection = _CURRENT_CONNECTION.get()
    if connection is None:
        raise RuntimeError("Connection binding is required")
    return connection


def _commit() -> None:
    _db().commit()


def _rollback() -> None:
    _db().rollback()


def _begin() -> None:
    _db().commit()


def _fire_and_forget(coro: Any) -> None:
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    loop.create_task(coro)
