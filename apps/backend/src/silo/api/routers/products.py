from __future__ import annotations

import unicodedata
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy import and_, delete, desc, func, insert, or_, select, update
from sqlalchemy.engine import Connection

from silo.api.dependencies import get_db, require_permission
from silo.api.responses import build_success_payload
from silo.db.models import legacy_tables
from silo.db.serialization import serialize_legacy_row
from silo.services.common import is_service_error, service_error_response, service_failure, service_success
from silo.storage.uploads import delete_upload_file, is_safe_filename, is_upload_kind

router = APIRouter(prefix="/api/products", tags=["products"])

PRODUCT_PRIORITY_VALUES = ("low", "normal", "high", "urgent")
SHIFT_CODES = ("0", "6", "12", "18")


@router.get("")
@router.get("/")
async def list_products(
    slug: str | None = Query(default=None),
    name: str | None = Query(default=None),
    page: int | None = Query(default=None),
    limit: int | None = Query(default=None),
    available: bool | None = Query(default=None),
    _current_user: object = Depends(require_permission("products", "view")),
    db: Connection = Depends(get_db),
):
    items = _list_products(db, slug=slug, name=name, page=page or 1, limit=limit or 40, available=available)
    if slug:
        return build_success_payload({"products": items["items"]})
    return build_success_payload({"items": items["items"]})


@router.post("")
@router.post("/")
async def create_product(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("products", "manage")),
    db: Connection = Depends(get_db),
):
    result = _create_product(db, payload)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao criar produto.")
        assert response is not None
        return response
    return JSONResponse(
        status_code=201,
        content=build_success_payload(result["data"], message="Produto criado com sucesso"),
    )


@router.put("")
@router.put("/")
async def update_product(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("products", "manage")),
    db: Connection = Depends(get_db),
):
    result = _update_product(db, payload)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao atualizar produto.")
        assert response is not None
        return response
    return build_success_payload(result["data"], message="Produto atualizado com sucesso")


@router.delete("")
@router.delete("/")
async def delete_product(
    id: str | None = Query(default=None),
    _current_user: object = Depends(require_permission("products", "manage")),
    db: Connection = Depends(get_db),
):
    if not id:
        return service_error_response(service_failure("ID do produto é obrigatório.", 400, field="id"), "Erro ao excluir produto.")

    result = _delete_product(db, id)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao excluir produto.")
        assert response is not None
        return response
    return build_success_payload(message="Produto excluído com sucesso")


def _list_products(
    db: Connection,
    *,
    slug: str | None,
    name: str | None,
    page: int,
    limit: int,
    available: bool | None,
) -> dict[str, object]:
    product_table = legacy_tables["product"]

    if slug:
        row = db.execute(select(product_table).where(product_table.c.slug == slug.strip()).limit(1)).mappings().first()
        items = [serialize_legacy_row(row)] if row is not None else []
        if available is True:
            items = [item for item in items if bool(item.get("available"))]
        return {"items": items, "total": len(items)}

    conditions = []
    if name:
        pattern = f"%{name.strip()}%"
        conditions.append(product_table.c.name.ilike(pattern))
    if available is True:
        conditions.append(product_table.c.available.is_(True))
    elif available is False:
        conditions.append(product_table.c.available.is_(False))

    statement = select(product_table).order_by(product_table.c.name.asc())
    if conditions:
        statement = statement.where(and_(*conditions))
    offset = max(0, page - 1) * max(1, limit)
    rows = db.execute(statement.limit(limit).offset(offset)).mappings().all()
    items = [serialize_legacy_row(row) for row in rows]
    return {"items": items, "total": len(items)}


def _create_product(db: Connection, payload: dict[str, object]) -> dict[str, object]:
    product_table = legacy_tables["product"]

    name = _require_text(payload.get("name"))
    if not name:
        return service_failure("Dados inválidos.", 400)

    slug_input = _optional_str(payload.get("slug")) or name
    slug = format_slug(slug_input)
    if not slug:
        return service_failure("Slug inválido.", 400, field="slug")

    existing = db.execute(select(product_table.c.id).where(product_table.c.slug == slug).limit(1)).first()
    if existing is not None:
        return service_failure("Já existe um produto com este slug.", 400, field="name")

    now = _now_naive()
    new_row = {
        "id": _new_uuid(),
        "name": name.strip(),
        "slug": slug,
        "available": bool(payload.get("available", True)),
        "priority": _normalize_priority(payload.get("priority")) or "normal",
        "turns": _normalize_turns(payload.get("turns")),
        "description": _nullable_text(payload.get("description")),
        "url_product_flow": _normalize_url(payload.get("url_product_flow") or payload.get("urlProductFlow")),
        "created_at": now,
        "updated_at": now,
    }

    db.execute(insert(product_table).values(new_row))
    db.commit()
    return service_success(serialize_legacy_row(new_row))


def _update_product(db: Connection, payload: dict[str, object]) -> dict[str, object]:
    product_table = legacy_tables["product"]

    product_id = _require_text(payload.get("id"))
    name = _require_text(payload.get("name"))
    if not product_id or not name:
        return service_failure("Dados inválidos.", 400)

    current = db.execute(select(product_table).where(product_table.c.id == product_id).limit(1)).mappings().first()
    if current is None:
        return service_failure("Produto não encontrado.", 404)

    slug_input = _optional_str(payload.get("slug")) or name
    slug = format_slug(slug_input)
    if not slug:
        return service_failure("Slug inválido.", 400, field="slug")

    duplicate = db.execute(
        select(product_table.c.id)
        .where(and_(product_table.c.slug == slug, product_table.c.id != product_id))
        .limit(1)
    ).first()
    if duplicate is not None:
        return service_failure("Já existe um produto com este slug.", 400, field="slug")

    updated_row = {
        "id": product_id,
        "name": name.strip(),
        "slug": slug,
        "available": bool(payload.get("available", current["available"])),
        "priority": _normalize_priority(payload.get("priority")) or str(current["priority"]),
        "turns": _normalize_turns(payload.get("turns")) or current["turns"],
        "description": _nullable_text(payload.get("description")) if "description" in payload else current["description"],
        "url_product_flow": _normalize_url(payload.get("url_product_flow") or payload.get("urlProductFlow"))
        if ("url_product_flow" in payload or "urlProductFlow" in payload)
        else current["url_product_flow"],
        "updated_at": _now_naive(),
    }

    db.execute(update(product_table).where(product_table.c.id == product_id).values(**updated_row))
    db.commit()
    return service_success(serialize_legacy_row(updated_row))


def _delete_product(db: Connection, product_id: str) -> dict[str, object]:
    product_table = legacy_tables["product"]
    activity_table = legacy_tables["product_activity"]
    activity_history_table = legacy_tables["product_activity_history"]
    availability_table = legacy_tables["product_availability_exception"]
    contact_table = legacy_tables["product_contact"]
    dependency_table = legacy_tables["product_dependency"]
    manual_table = legacy_tables["product_manual"]
    manual_chunk_table = legacy_tables["product_manual_chunk"]
    problem_table = legacy_tables["product_problem"]
    problem_image_table = legacy_tables["product_problem_image"]
    solution_table = legacy_tables["product_solution"]
    solution_checked_table = legacy_tables["product_solution_checked"]
    solution_image_table = legacy_tables["product_solution_image"]

    existing = db.execute(select(product_table.c.id).where(product_table.c.id == product_id).limit(1)).first()
    if existing is None:
        return service_failure("Produto não encontrado.", 404)

    problem_images = db.execute(
        select(problem_image_table.c.image).select_from(problem_image_table.join(problem_table, problem_table.c.id == problem_image_table.c.product_problem_id))
        .where(problem_table.c.product_id == product_id)
    ).all()
    solution_images = db.execute(
        select(solution_image_table.c.image).select_from(solution_image_table.join(solution_table, solution_table.c.id == solution_image_table.c.product_solution_id))
        .where(solution_table.c.product_problem_id.in_(select(problem_table.c.id).where(problem_table.c.product_id == product_id)))
    ).all()

    db.rollback()
    with db.begin():
        activity_ids = [row[0] for row in db.execute(select(activity_table.c.id).where(activity_table.c.product_id == product_id)).all()]
        if activity_ids:
            db.execute(delete(activity_history_table).where(activity_history_table.c.product_activity_id.in_(activity_ids)))
        db.execute(delete(activity_table).where(activity_table.c.product_id == product_id))

        problem_ids = [row[0] for row in db.execute(select(problem_table.c.id).where(problem_table.c.product_id == product_id)).all()]
        if problem_ids:
            solution_ids = [row[0] for row in db.execute(select(solution_table.c.id).where(solution_table.c.product_problem_id.in_(problem_ids))).all()]
            if solution_ids:
                db.execute(delete(solution_checked_table).where(solution_checked_table.c.product_solution_id.in_(solution_ids)))
                db.execute(delete(solution_image_table).where(solution_image_table.c.product_solution_id.in_(solution_ids)))
            db.execute(delete(solution_table).where(solution_table.c.product_problem_id.in_(problem_ids)))
            db.execute(delete(problem_image_table).where(problem_image_table.c.product_problem_id.in_(problem_ids)))
            db.execute(delete(problem_table).where(problem_table.c.product_id == product_id))

        db.execute(delete(availability_table).where(availability_table.c.product_id == product_id))
        db.execute(delete(dependency_table).where(dependency_table.c.product_id == product_id))
        db.execute(delete(manual_chunk_table).where(manual_chunk_table.c.product_id == product_id))
        db.execute(delete(manual_table).where(manual_table.c.product_id == product_id))
        db.execute(delete(contact_table).where(contact_table.c.product_id == product_id))
        db.execute(delete(product_table).where(product_table.c.id == product_id))

    for row in problem_images:
        _delete_upload_url(row[0])
    for row in solution_images:
        _delete_upload_url(row[0])

    return service_success(None)


def format_slug(input_value: str) -> str:
    normalized = unicodedata.normalize("NFD", input_value.strip().lower())
    without_marks = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
    slug = "".join(char if char.isalnum() else "-" for char in without_marks)
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug.strip("-")


def _normalize_turns(value: object | None) -> list[str]:
    if not isinstance(value, list):
        return list(SHIFT_CODES)

    turns: list[str] = []
    for item in value:
        if isinstance(item, str):
            candidate = item.strip()
        elif isinstance(item, int):
            candidate = str(item)
        else:
            continue
        if candidate in SHIFT_CODES and candidate not in turns:
            turns.append(candidate)
    return turns or list(SHIFT_CODES)


def _normalize_priority(value: object | None) -> str | None:
    text = _optional_str(value)
    if text is None:
        return None
    candidate = text.strip()
    return candidate if candidate in PRODUCT_PRIORITY_VALUES else None


def _normalize_url(value: object | None) -> str | None:
    text = _optional_str(value)
    if text is None:
        return None
    stripped = text.strip()
    return stripped or None


def _nullable_text(value: object | None) -> str | None:
    text = _optional_str(value)
    if text is None:
        return None
    stripped = text.strip()
    return stripped or None


def _require_text(value: object | None) -> str | None:
    text = _optional_str(value)
    if text is None:
        return None
    stripped = text.strip()
    return stripped or None


def _optional_str(value: object | None) -> str | None:
    return value if isinstance(value, str) else None


def _delete_upload_url(image_url: object | None) -> None:
    text = _optional_str(image_url)
    if not text:
        return
    clean = text.split("?", maxsplit=1)[0].split("#", maxsplit=1)[0]
    if not clean.startswith("/uploads/"):
        return
    parts = clean.removeprefix("/uploads/").split("/", maxsplit=1)
    if len(parts) != 2:
        return
    kind, filename = parts
    if is_upload_kind(kind) and is_safe_filename(filename):
        delete_upload_file(kind, filename)


def _new_uuid() -> str:
    import uuid

    return str(uuid.uuid4())


def _now_naive() -> datetime:
    return datetime.now()
