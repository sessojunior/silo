from __future__ import annotations

from collections.abc import Iterable

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy import and_, delete, desc, func, insert, not_, select, update
from sqlalchemy.engine import Connection

from silo.api.dependencies import get_db, require_permission
from silo.api.responses import build_success_payload
from silo.db.models import legacy_tables
from silo.db.serialization import serialize_legacy_row
from silo.services.common import is_service_error, service_error_response, service_failure, service_success

router = APIRouter(prefix="/api/groups", tags=["groups"])

DEFAULT_GROUP_PERMISSIONS: tuple[tuple[str, str], ...] = (
    ("products", "view"),
    ("projects", "view"),
    ("projectActivities", "view"),
    ("projectTasks", "view"),
    ("productActivities", "view"),
)


@router.get("")
@router.get("/")
async def list_groups(
    search: str | None = Query(default=None),
    status: str | None = Query(default=None),
    _current_user: object = Depends(require_permission("groups", "view")),
    db: Connection = Depends(get_db),
):
    items = _list_groups(db, search=search, status=status)
    return build_success_payload(items)


@router.post("")
@router.post("/")
async def create_group(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("groups", "manage")),
    db: Connection = Depends(get_db),
):
    result = _create_group(db, payload)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao criar grupo.")
        assert response is not None
        return response

    return JSONResponse(
        status_code=201,
        content=build_success_payload(result["data"], message="Grupo criado com sucesso."),
    )


@router.put("")
@router.put("/")
async def update_group(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("groups", "manage")),
    db: Connection = Depends(get_db),
):
    result = _update_group(db, payload)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao atualizar grupo.")
        assert response is not None
        return response

    return build_success_payload(result["data"], message="Grupo atualizado com sucesso.")


@router.delete("")
@router.delete("/")
async def delete_group(
    id: str | None = Query(default=None),
    _current_user: object = Depends(require_permission("groups", "manage")),
    db: Connection = Depends(get_db),
):
    if not id:
        return service_error_response(service_failure("ID é obrigatório.", 400, field="id"), "Erro ao excluir grupo.")

    result = _delete_group(db, id)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao excluir grupo.")
        assert response is not None
        return response

    return build_success_payload(message="Grupo excluído com sucesso.")


@router.get("/permissions")
async def get_group_permissions(
    groupId: str | None = Query(default=None),
    _current_user: object = Depends(require_permission("groups", "view")),
    db: Connection = Depends(get_db),
):
    if not groupId:
        return service_error_response(
            service_failure("groupId é obrigatório.", 400, field="groupId"),
            "Erro ao carregar permissões.",
        )

    result = _get_group_permissions(db, groupId)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao carregar permissões.")
        assert response is not None
        return response

    return build_success_payload(result["data"])


@router.put("/permissions")
async def update_group_permission(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("groups", "manage")),
    db: Connection = Depends(get_db),
):
    result = _update_group_permission(db, payload)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao atualizar permissão.")
        assert response is not None
        return response

    payload_data = result["data"]
    return build_success_payload(payload_data, message=result.get("message"))


@router.delete("/users")
async def remove_user_from_group(
    userId: str | None = Query(default=None),
    groupId: str | None = Query(default=None),
    _current_user: object = Depends(require_permission("groups", "manage")),
    db: Connection = Depends(get_db),
):
    if not userId or not groupId:
        return service_error_response(
            service_failure("userId e groupId são obrigatórios.", 400),
            "Erro interno do servidor.",
        )

    _remove_user_from_group(db, userId, groupId)
    return build_success_payload(message="Usuário removido do grupo com sucesso.")


def _list_groups(db: Connection, *, search: str | None, status: str | None) -> dict[str, object]:
    group_table = legacy_tables["group"]
    user_group_table = legacy_tables["user_group"]

    conditions = []
    if search:
        pattern = f"%{search.strip()}%"
        conditions.append(group_table.c.name.ilike(pattern))
    if status == "active":
        conditions.append(group_table.c.active.is_(True))
    elif status == "inactive":
        conditions.append(group_table.c.active.is_(False))

    statement = select(group_table).order_by(group_table.c.is_default.desc(), group_table.c.created_at.desc())
    if conditions:
        statement = statement.where(and_(*conditions))

    groups = [serialize_legacy_row(row) for row in db.execute(statement).mappings().all()]
    counts = dict(
        db.execute(
            select(
                user_group_table.c.group_id,
                func.count(user_group_table.c.user_id),
            ).group_by(user_group_table.c.group_id)
        ).all()
    )

    for group in groups:
        group["userCount"] = int(counts.get(group["id"], 0))
    return {"items": groups, "total": len(groups)}


def _create_group(db: Connection, payload: dict[str, object]) -> dict[str, object]:
    group_table = legacy_tables["group"]
    group_permission_table = legacy_tables["group_permissions"]

    name = _require_text(payload.get("name"))
    if not name:
        return service_failure("Dados inválidos.", 400)

    normalized_name = name.strip()
    role = _optional_str(payload.get("role"))
    if role == "admin":
        return service_failure("Não é possível criar grupos com permissões de administrador.", 400, field="role")

    existing = db.execute(
        select(group_table.c.id).where(group_table.c.name == normalized_name).limit(1)
    ).first()
    if existing is not None:
        return service_failure("Já existe um grupo com este nome.", 400, field="name")

    is_default = bool(payload.get("isDefault", False))
    new_group = {
        "id": _new_uuid(),
        "name": normalized_name,
        "description": _nullable_text(payload.get("description")),
        "icon": _optional_str(payload.get("icon")) or "icon-[lucide--users]",
        "color": _optional_str(payload.get("color")) or "#3B82F6",
        "role": "user",
        "active": bool(payload.get("active", True)),
        "is_default": is_default,
        "created_at": now_naive(),
        "updated_at": now_naive(),
    }

    db.rollback()
    with db.begin():
        if is_default:
            db.execute(
                update(group_table)
                .values(is_default=False, updated_at=now_naive())
                .where(group_table.c.is_default.is_(True))
            )
        db.execute(insert(group_table).values(new_group))
        if DEFAULT_GROUP_PERMISSIONS:
            db.execute(
                insert(group_permission_table),
                [
                    {
                        "id": _new_uuid(),
                        "group_id": new_group["id"],
                        "resource": resource,
                        "action": action,
                        "created_at": now_naive(),
                        "updated_at": now_naive(),
                    }
                    for resource, action in DEFAULT_GROUP_PERMISSIONS
                ],
            )

    return service_success(serialize_legacy_row(new_group))


def _update_group(db: Connection, payload: dict[str, object]) -> dict[str, object]:
    group_table = legacy_tables["group"]

    group_id = _require_text(payload.get("id"))
    name = _require_text(payload.get("name"))
    if not group_id or not name:
        return service_failure("Dados inválidos.", 400)

    current = db.execute(select(group_table).where(group_table.c.id == group_id).limit(1)).mappings().first()
    if current is None:
        return service_failure("Grupo não encontrado.", 404)

    normalized_name = name.strip()
    if current["role"] == "admin":
        if payload.get("active") is False:
            return service_failure("Não é possível desativar o grupo de administradores.", 400, field="active")
        if payload.get("isDefault") is True:
            return service_failure("Não é possível tornar grupos administrativos como padrão.", 400, field="isDefault")

    if current["name"] == "Administradores" and normalized_name != "Administradores":
        return service_failure("Não é possível alterar o nome do grupo Administradores.", 400, field="name")

    duplicate = db.execute(
        select(group_table.c.id)
        .where(and_(group_table.c.name == normalized_name, group_table.c.id != group_id))
        .limit(1)
    ).first()
    if duplicate is not None:
        return service_failure("Já existe outro grupo com este nome.", 400, field="name")

    if payload.get("isDefault") is False:
        current_defaults = db.execute(
            select(group_table).where(group_table.c.is_default.is_(True))
        ).mappings().all()
        if len(current_defaults) == 1 and current_defaults[0]["id"] == group_id:
            return service_failure("Não é possível desmarcar o último grupo padrão.", 400, field="isDefault")

    role = _optional_str(payload.get("role"))
    if role == "admin":
        return service_failure("Não é possível alterar um grupo para ter permissões de administrador.", 400, field="role")

    is_default = bool(payload.get("isDefault", current["is_default"]))
    if is_default:
        db.execute(update(group_table).values(is_default=False, updated_at=now_naive()).where(group_table.c.is_default.is_(True)))

    updated_data = {
        "name": normalized_name,
        "description": _nullable_text(payload.get("description")) if "description" in payload else current["description"],
        "icon": _optional_str(payload.get("icon")) or current["icon"],
        "color": _optional_str(payload.get("color")) or current["color"],
        "role": current["role"] if role is None or role == "admin" else role,
        "active": bool(payload.get("active", current["active"])),
        "is_default": is_default,
        "updated_at": now_naive(),
    }

    db.execute(update(group_table).where(group_table.c.id == group_id).values(**updated_data))
    db.commit()
    return service_success({"id": group_id, **updated_data})


def _get_group_permissions(db: Connection, group_id: str) -> dict[str, object]:
    group_table = legacy_tables["group"]
    group_permission_table = legacy_tables["group_permissions"]

    existing_group = db.execute(
        select(group_table.c.id, group_table.c.role).where(group_table.c.id == group_id).limit(1)
    ).first()
    if existing_group is None:
        return service_failure("Grupo não encontrado.", 404)

    rows = db.execute(
        select(group_permission_table.c.resource, group_permission_table.c.action)
        .where(group_permission_table.c.group_id == group_id)
    ).mappings().all()

    existing_set = {f"{row['resource']}:{row['action']}" for row in rows}
    missing = [
        {"resource": resource, "action": action}
        for resource, action in DEFAULT_GROUP_PERMISSIONS
        if f"{resource}:{action}" not in existing_set
    ]
    if missing:
        db.execute(
            insert(group_permission_table),
            [
                {
                    "id": _new_uuid(),
                    "group_id": group_id,
                    "resource": item["resource"],
                    "action": item["action"],
                    "created_at": now_naive(),
                    "updated_at": now_naive(),
                }
                for item in missing
            ],
        )
        db.commit()
        rows = db.execute(
            select(group_permission_table.c.resource, group_permission_table.c.action)
            .where(group_permission_table.c.group_id == group_id)
        ).mappings().all()

    permissions: dict[str, list[str]] = {}
    for row in rows:
        permissions.setdefault(str(row["resource"]), []).append(str(row["action"]))

    return service_success({"permissions": permissions})


def _update_group_permission(db: Connection, payload: dict[str, object]) -> dict[str, object]:
    group_table = legacy_tables["group"]
    group_permission_table = legacy_tables["group_permissions"]

    group_id = _require_text(payload.get("groupId"))
    resource = _require_text(payload.get("resource"))
    action = _require_text(payload.get("action"))
    enabled = payload.get("enabled")
    if not group_id or not resource or not action or not isinstance(enabled, bool):
        return service_failure("Dados inválidos.", 400)

    existing_group = db.execute(
        select(group_table.c.id, group_table.c.role).where(group_table.c.id == group_id).limit(1)
    ).first()
    if existing_group is None:
        return service_failure("Grupo não encontrado.", 404)
    if existing_group[1] == "admin":
        return service_failure("Não é possível alterar permissões do grupo administrador.", 400)

    immutable = any(resource == default_resource and action == default_action for default_resource, default_action in DEFAULT_GROUP_PERMISSIONS)
    if not enabled and immutable:
        return service_failure("Esta permissão é obrigatória e não pode ser desativada.", 400)

    if enabled:
        existing = db.execute(
            select(group_permission_table.c.id)
            .where(
                and_(
                    group_permission_table.c.group_id == group_id,
                    group_permission_table.c.resource == resource,
                    group_permission_table.c.action == action,
                )
            )
            .limit(1)
        ).first()
        if existing is None:
            db.execute(
                insert(group_permission_table).values(
                    id=_new_uuid(),
                    group_id=group_id,
                    resource=resource,
                    action=action,
                    created_at=now_naive(),
                    updated_at=now_naive(),
                )
            )
    else:
        db.execute(
            delete(group_permission_table).where(
                and_(
                    group_permission_table.c.group_id == group_id,
                    group_permission_table.c.resource == resource,
                    group_permission_table.c.action == action,
                )
            )
        )

    db.commit()
    return service_success(
        {"groupId": group_id, "resource": resource, "action": action, "enabled": enabled},
        message="Permissão atualizada com sucesso.",
    )


def _remove_user_from_group(db: Connection, user_id: str, group_id: str) -> None:
    user_group_table = legacy_tables["user_group"]
    db.execute(
        delete(user_group_table).where(
            and_(
                user_group_table.c.user_id == user_id,
                user_group_table.c.group_id == group_id,
            )
        )
    )
    db.commit()


def _delete_group(db: Connection, group_id: str) -> dict[str, object]:
    group_table = legacy_tables["group"]
    user_group_table = legacy_tables["user_group"]
    chat_message_table = legacy_tables["chat_message"]

    current = db.execute(
        select(group_table).where(group_table.c.id == group_id).limit(1)
    ).mappings().first()
    if current is None:
        return service_failure("Grupo não encontrado.", 404)
    if current["is_default"]:
        return service_failure("Não é possível excluir o grupo padrão.", 400)
    if current["role"] == "admin":
        return service_failure("Não é possível excluir o grupo de administradores.", 400)

    db.rollback()
    with db.begin():
        default_group = db.execute(
            select(group_table)
            .where(group_table.c.is_default.is_(True))
            .order_by(group_table.c.updated_at.desc())
            .limit(1)
        ).mappings().first()
        if default_group is None:
            raise RuntimeError("Grupo padrão não encontrado.")

        users_in_group = db.execute(
            select(user_group_table.c.user_id).where(user_group_table.c.group_id == group_id)
        ).all()
        if users_in_group:
            user_ids = [row[0] for row in users_in_group]
            users_in_other = db.execute(
                select(user_group_table.c.user_id)
                .where(
                    and_(
                        user_group_table.c.group_id != group_id,
                        user_group_table.c.user_id.in_(user_ids),
                    )
                )
            ).all()
            in_other = {row[0] for row in users_in_other}
            to_move = [user_id for user_id in user_ids if user_id not in in_other]
            if to_move:
                db.execute(
                    insert(user_group_table),
                    [
                        {
                            "id": _new_uuid(),
                            "user_id": user_id,
                            "group_id": default_group["id"],
                            "joined_at": now_naive(),
                            "created_at": now_naive(),
                        }
                        for user_id in to_move
                    ],
                )

        db.execute(delete(user_group_table).where(user_group_table.c.group_id == group_id))
        db.execute(delete(chat_message_table).where(chat_message_table.c.receiver_group_id == group_id))
        db.execute(delete(group_table).where(group_table.c.id == group_id))

    return service_success(None)


def _require_text(value: object | None) -> str | None:
    return value if isinstance(value, str) and value.strip() else None


def _optional_str(value: object | None) -> str | None:
    return value if isinstance(value, str) else None


def _nullable_text(value: object | None) -> str | None:
    text = _optional_str(value)
    if text is None:
        return None
    stripped = text.strip()
    return stripped or None


def now_naive():
    from datetime import datetime

    return datetime.now()


def _new_uuid() -> str:
    import uuid

    return str(uuid.uuid4())
