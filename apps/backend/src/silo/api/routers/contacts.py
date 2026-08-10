from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy import and_, delete, select
from sqlalchemy.engine import Connection

from silo.api.dependencies import get_db, require_permission
from silo.api.responses import build_success_payload
from silo.db.models import legacy_tables
from silo.db.serialization import serialize_legacy_row
from silo.services.common import is_service_error, service_error_response, service_failure, service_success
from silo.storage.uploads import delete_upload_file, is_safe_filename, is_upload_kind

router = APIRouter(prefix="/api/contacts", tags=["contacts"])


@router.get("")
@router.get("/")
async def list_contacts(
    search: str | None = Query(default=None),
    status: str | None = Query(default=None),
    _current_user: object = Depends(require_permission("contacts", "view")),
    db: Connection = Depends(get_db),
):
    items = _list_contacts(db, search=search, status=status)
    return build_success_payload({"items": items["items"], "total": items["total"]})


@router.post("")
@router.post("/")
async def create_contact(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("contacts", "manage")),
    db: Connection = Depends(get_db),
):
    result = _create_contact(db, payload)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao criar contato.")
        assert response is not None
        return response

    created = result["data"]
    return JSONResponse(
        status_code=201,
        content=build_success_payload(created, message="Contato criado com sucesso"),
    )


@router.put("")
@router.put("/")
async def update_contact(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("contacts", "manage")),
    db: Connection = Depends(get_db),
):
    result = _update_contact(db, payload)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao atualizar contato.")
        assert response is not None
        return response
    return build_success_payload(message="Contato atualizado com sucesso")


@router.delete("")
@router.delete("/")
async def delete_contact(
    id: str | None = Query(default=None),
    _current_user: object = Depends(require_permission("contacts", "manage")),
    db: Connection = Depends(get_db),
):
    contact_id = id
    if not contact_id:
        return service_error_response(service_failure("ID é obrigatório.", 400, field="id"), "Erro ao excluir contato.")

    result = _delete_contact(db, contact_id)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao excluir contato.")
        assert response is not None
        return response
    return build_success_payload(message="Contato excluído com sucesso")


def _list_contacts(db: Connection, *, search: str | None, status: str | None) -> dict[str, object]:
    contact_table = legacy_tables["contact"]

    conditions = []
    if search:
        pattern = f"%{search.strip()}%"
        conditions.append(
            contact_table.c.name.ilike(pattern)
            | contact_table.c.email.ilike(pattern)
            | contact_table.c.role.ilike(pattern)
            | contact_table.c.team.ilike(pattern)
        )
    if status == "active":
        conditions.append(contact_table.c.active.is_(True))
    elif status == "inactive":
        conditions.append(contact_table.c.active.is_(False))

    statement = select(contact_table).order_by(contact_table.c.name.asc())
    if conditions:
        statement = statement.where(and_(*conditions))

    rows = db.execute(statement).mappings().all()
    items = [serialize_legacy_row(row) for row in rows]
    return {"items": items, "total": len(items)}


def _create_contact(db: Connection, payload: dict[str, object]) -> dict[str, object]:
    contact_table = legacy_tables["contact"]
    normalized_email = _normalize_email(payload.get("email"))
    if normalized_email is None:
        return service_failure("Email inválido.", 400, field="email")

    existing = db.execute(
        select(contact_table.c.id).where(contact_table.c.email == normalized_email).limit(1)
    ).first()
    if existing is not None:
        return service_failure("Este email já está em uso", 400, field="email")

    name = _require_text(payload.get("name"), "name")
    role = _require_text(payload.get("role"), "role")
    team = _require_text(payload.get("team"), "team")
    if name is None or role is None or team is None:
        return service_failure("Dados inválidos.", 400)

    row = {
        "id": _new_uuid(),
        "name": name,
        "role": role,
        "team": team,
        "email": normalized_email,
        "phone": _optional_str(payload.get("phone")) or None,
        "image": _optional_str(payload.get("imageUrl")) or None,
        "active": bool(payload.get("active", True)),
    }
    db.execute(contact_table.insert().values(row))
    db.commit()
    return service_success({"id": row["id"]})


def _update_contact(db: Connection, payload: dict[str, object]) -> dict[str, object]:
    contact_table = legacy_tables["contact"]
    product_contact_table = legacy_tables["product_contact"]

    contact_id = _require_text(payload.get("id"), "id")
    name = _require_text(payload.get("name"), "name")
    role = _require_text(payload.get("role"), "role")
    team = _require_text(payload.get("team"), "team")
    normalized_email = _normalize_email(payload.get("email"))
    if contact_id is None or name is None or role is None or team is None or normalized_email is None:
        return service_failure("Dados inválidos.", 400)

    current = db.execute(
        select(contact_table).where(contact_table.c.id == contact_id).limit(1)
    ).mappings().first()
    if current is None:
        return service_failure("Contato não encontrado.", 404)

    if normalized_email != str(current["email"]):
        existing = db.execute(
            select(contact_table.c.id)
            .where(and_(contact_table.c.email == normalized_email, contact_table.c.id != contact_id))
            .limit(1)
        ).first()
        if existing is not None:
            return service_failure("Este email já está em uso", 400, field="email")

    image_value = _optional_str(payload.get("imageUrl"))
    remove_image = bool(payload.get("removeImage", False))
    current_image = _optional_str(current.get("image"))
    if image_value:
        image_path = image_value
    elif remove_image:
        image_path = None
        _delete_upload_from_url(current_image)
    else:
        image_path = current_image

    db.execute(
        contact_table.update()
        .where(contact_table.c.id == contact_id)
        .values(
            name=name,
            role=role,
            team=team,
            email=normalized_email,
            phone=_optional_str(payload.get("phone")) or None,
            image=image_path,
            active=bool(payload.get("active", True)),
            updated_at=select_now(db),
        )
    )
    db.commit()
    return service_success(None)


def _delete_contact(db: Connection, contact_id: str) -> dict[str, object]:
    contact_table = legacy_tables["contact"]
    product_contact_table = legacy_tables["product_contact"]

    current = db.execute(
        select(contact_table).where(contact_table.c.id == contact_id).limit(1)
    ).mappings().first()
    if current is None:
        return service_failure("Contato não encontrado.", 404)

    db.execute(product_contact_table.delete().where(product_contact_table.c.contact_id == contact_id))
    db.execute(contact_table.delete().where(contact_table.c.id == contact_id))
    db.commit()

    current_image = _optional_str(current.get("image"))
    _delete_upload_from_url(current_image)
    return service_success(None)


def _delete_upload_from_url(image_url: str | None) -> None:
    if not image_url:
        return

    clean = image_url.split("?", maxsplit=1)[0].split("#", maxsplit=1)[0]
    if not clean.startswith("/uploads/"):
        return

    parts = clean.removeprefix("/uploads/").split("/", maxsplit=1)
    if len(parts) != 2:
        return

    kind, filename = parts
    if is_upload_kind(kind) and is_safe_filename(filename):
        delete_upload_file(kind, filename)


def _normalize_email(value: object | None) -> str | None:
    text = _optional_str(value)
    if text is None:
        return None
    normalized = text.strip().lower()
    return normalized or None


def _require_text(value: object | None, field_name: str) -> str | None:
    text = _optional_str(value)
    if text is None:
        return None
    normalized = text.strip()
    return normalized if normalized else None


def _optional_str(value: object | None) -> str | None:
    return value if isinstance(value, str) else None


def _new_uuid() -> str:
    import uuid

    return str(uuid.uuid4())


def select_now(db: Connection):
    from datetime import datetime

    return datetime.now()
