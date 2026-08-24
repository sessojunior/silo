from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy import and_, delete, insert, select, update
from sqlalchemy.engine import Connection

from silo.api.dependencies import get_db, require_admin
from silo.api.responses import build_success_payload
from silo.db.models import legacy_tables
from silo.db.serialization import serialize_legacy_row
from silo.services.common import is_service_error, service_error_response, service_failure, service_success
from silo.storage.uploads import decode_base64_data_uri, delete_upload_file, is_safe_filename, list_upload_files, store_buffer_as_webp

router = APIRouter(prefix="/api/incidents", tags=["incidents"])

NO_INCIDENTS_CATEGORY_ID = "no-incidents"


@router.get("")
@router.get("/")
async def list_incidents(
    _current_user: object = Depends(require_admin),
    db: Connection = Depends(get_db),
):
    items = _list_incidents(db)
    return build_success_payload(items)


@router.post("")
@router.post("/")
async def create_incident(
    payload: dict[str, object],
    _current_user: object = Depends(require_admin),
    db: Connection = Depends(get_db),
):
    result = _create_incident(db, payload)
    if is_service_error(result):
        response = service_error_response(result, "Erro interno ao criar incidente")
        assert response is not None
        return response
    return build_success_payload(result["data"])


@router.put("")
@router.put("/")
async def update_incident(
    payload: dict[str, object],
    _current_user: object = Depends(require_admin),
    db: Connection = Depends(get_db),
):
    result = _update_incident(db, payload)
    if is_service_error(result):
        response = service_error_response(result, "Erro interno ao atualizar incidente")
        assert response is not None
        return response
    return build_success_payload(message="Incidente atualizado com sucesso")


@router.delete("")
@router.delete("/")
async def delete_incident(
    id: str | None = Query(default=None),
    _current_user: object = Depends(require_admin),
    db: Connection = Depends(get_db),
):
    if not id:
        return service_error_response(service_failure("ID do incidente é obrigatório.", 400), "Erro interno ao excluir incidente")

    result = _delete_incident(db, id)
    if is_service_error(result):
        response = service_error_response(result, "Erro interno ao excluir incidente")
        assert response is not None
        return response
    return build_success_payload({"success": True})


@router.get("/usage")
async def get_usage(
    incidentId: str | None = Query(default=None),
    _current_user: object = Depends(require_admin),
    db: Connection = Depends(get_db),
):
    if not incidentId:
        return service_error_response(service_failure("ID do incidente é obrigatório.", 400), "Erro interno")

    result = _get_incident_usage(db, incidentId)
    if is_service_error(result):
        response = service_error_response(result, "Erro interno")
        assert response is not None
        return response

    return build_success_payload(result["data"])


@router.get("/images")
async def list_images(
    _current_user: object = Depends(require_admin),
):
    items = list_upload_files("incidents")
    return build_success_payload({"items": items})


@router.post("/images")
async def create_image(
    payload: dict[str, object],
    _current_user: object = Depends(require_admin),
):
    image = payload.get("image")
    filename = payload.get("filename")
    if not isinstance(image, str) or not isinstance(filename, str):
        return service_error_response(service_failure("Dados inválidos", 400), "Erro ao salvar imagem")

    buffer = decode_base64_data_uri(image)
    stored = store_buffer_as_webp("incidents", filename, buffer)
    if isinstance(stored, dict):
        return service_error_response(service_failure(stored["error"], 400), "Erro ao salvar imagem")

    return build_success_payload({"filename": stored.filename, "url": stored.url})


@router.delete("/images")
async def delete_image(
    filename: str | None = Query(default=None),
    _current_user: object = Depends(require_admin),
):
    if not filename:
        return service_error_response(service_failure("Nome de arquivo inválido", 400), "Erro ao excluir imagem")
    result = _delete_incident_image(filename)
    if is_service_error(result):
        response = service_error_response(result, "Erro ao excluir imagem")
        assert response is not None
        return response
    return build_success_payload(message="Imagem excluída com sucesso")


def _list_incidents(db: Connection) -> list[dict[str, object]]:
    category_table = legacy_tables["product_problem_category"]
    rows = db.execute(
        select(category_table)
        .where(category_table.c.id != NO_INCIDENTS_CATEGORY_ID)
        .order_by(category_table.c.sort_order.asc(), category_table.c.name.asc())
    ).mappings().all()
    return [serialize_legacy_row(row) for row in rows]


def _create_incident(db: Connection, payload: dict[str, object]) -> dict[str, object]:
    category_table = legacy_tables["product_problem_category"]

    name = _optional_str(payload.get("name"))
    color = _optional_str(payload.get("color"))
    if not name or len(name.strip()) < 2:
        return service_failure("Nome do incidente é obrigatório e deve ter pelo menos 2 caracteres.", 400)

    normalized_name = name.strip()
    existing = db.execute(
        select(category_table.c.id).where(category_table.c.name == normalized_name).limit(1)
    ).first()
    if existing is not None:
        return service_failure("Nome de incidente já existe.", 400)

    new_incident = {
        "id": _new_uuid(),
        "name": normalized_name,
        "color": color or "#6B7280",
        "is_system": False,
        "sort_order": 999,
    }
    db.execute(insert(category_table).values(new_incident))
    db.commit()
    return service_success(serialize_legacy_row(new_incident))


def _update_incident(db: Connection, payload: dict[str, object]) -> dict[str, object]:
    category_table = legacy_tables["product_problem_category"]

    incident_id = _optional_str(payload.get("id"))
    name = _optional_str(payload.get("name"))
    color = _optional_str(payload.get("color"))
    if not incident_id or not name or len(name.strip()) < 2:
        return service_failure("ID e nome do incidente são obrigatórios.", 400)
    if incident_id == NO_INCIDENTS_CATEGORY_ID:
        return service_failure("Não é possível editar esta categoria.", 400)

    normalized_name = name.strip()
    existing = db.execute(
        select(category_table.c.id)
        .where(and_(category_table.c.name == normalized_name, category_table.c.id != incident_id))
        .limit(1)
    ).first()
    if existing is not None:
        return service_failure("Nome de incidente já existe.", 400)

    db.execute(
        update(category_table)
        .where(category_table.c.id == incident_id)
        .values(name=normalized_name, color=color or "#6B7280", updated_at=_now_naive())
    )
    db.commit()
    return service_success(None)


def _delete_incident(db: Connection, incident_id: str) -> dict[str, object]:
    category_table = legacy_tables["product_problem_category"]
    activity_table = legacy_tables["product_activity"]
    problem_table = legacy_tables["product_problem"]

    category = db.execute(
        select(category_table.c.id, category_table.c.is_system, category_table.c.name)
        .where(category_table.c.id == incident_id)
        .limit(1)
    ).first()
    if category is None:
        return service_failure("Incidente não encontrado.", 404)
    if bool(category.is_system):
        return service_failure(f'"{category.name}" é uma categoria do sistema e não pode ser excluída.', 400)

    usage_in_activities = db.execute(
        select(activity_table.c.id).where(activity_table.c.problem_category_id == incident_id)
    ).all()
    usage_in_problems = db.execute(
        select(problem_table.c.id).where(problem_table.c.problem_category_id == incident_id)
    ).all()
    total_usage = len(usage_in_activities) + len(usage_in_problems)
    if total_usage > 0:
        if total_usage == 1:
            return service_failure("Este incidente está sendo usado em 1 registro e não pode ser excluído.", 400)
        return service_failure(
            f"Este incidente está sendo usado em {total_usage} registros e não pode ser excluído.",
            400,
        )

    db.execute(delete(category_table).where(category_table.c.id == incident_id))
    db.commit()
    return service_success(None)


def _get_incident_usage(db: Connection, incident_id: str) -> dict[str, object]:
    activity_table = legacy_tables["product_activity"]
    problem_table = legacy_tables["product_problem"]

    activities = db.execute(
        select(activity_table.c.id).where(activity_table.c.problem_category_id == incident_id)
    ).all()
    problems = db.execute(
        select(problem_table.c.id).where(problem_table.c.problem_category_id == incident_id)
    ).all()
    total_usage = len(activities) + len(problems)

    return service_success(
        {
            "inUse": total_usage > 0,
            "usageCount": total_usage,
            "usageDetails": {
                "activities": len(activities),
                "problems": len(problems),
            },
        }
    )


def _delete_incident_image(filename: str) -> dict[str, object]:
    if not is_safe_filename(filename):
        return service_failure("Nome de arquivo inválido", 400)
    delete_upload_file("incidents", filename)
    return service_success(None)


def _optional_str(value: object | None) -> str | None:
    return value if isinstance(value, str) else None


def _new_uuid() -> str:
    import uuid

    return str(uuid.uuid4())


def _now_naive():
    from datetime import datetime

    return datetime.now()
