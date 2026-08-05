from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.engine import Connection

from silo.api.dependencies import CurrentUser, get_current_user, get_db, require_permission
from silo.api.responses import build_success_payload, json_error_response
from silo.services.dataflow_portal import get_monitoring_products_from_kafka_rest
from silo.services.legacy_utils import new_uuid
from silo.services.monitoring_data import (
    create_picture_page,
    delete_picture_link,
    delete_picture_page,
    delete_radar,
    delete_radar_group,
    list_picture_pages,
    list_radar_groups,
    list_radars,
    upsert_picture_link,
    upsert_picture_page,
    upsert_radar,
    upsert_radar_group,
)

router = APIRouter(prefix="/api/monitoring", tags=["monitoring"])


@router.get("/picture-pages")
async def get_picture_pages(
    _current_user: object = Depends(require_permission("picturePages", "view")),
    db: Connection = Depends(get_db),
):
    try:
        items = list_picture_pages(db)
        return build_success_payload({"items": items})
    except Exception:
        return json_error_response(500, "Erro ao buscar páginas.")


@router.post("/picture-pages")
async def post_picture_page(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("picturePages", "manage")),
    db: Connection = Depends(get_db),
):
    validation = _validate_picture_page_payload(payload, require_id=False)
    if isinstance(validation, JSONResponse):
        return validation

    page_id = new_uuid()
    try:
        create_picture_page(db, {"id": page_id, **validation})
        return JSONResponse(
            status_code=201,
            content=build_success_payload({"id": page_id}, message="Página criada com sucesso"),
        )
    except Exception:
        return json_error_response(500, "Erro ao criar página.")


@router.put("/picture-pages")
async def put_picture_page(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("picturePages", "manage")),
    db: Connection = Depends(get_db),
):
    validation = _validate_picture_page_payload(payload, require_id=True)
    if isinstance(validation, JSONResponse):
        return validation

    try:
        upsert_picture_page(db, validation)
        return build_success_payload(message="Página salva com sucesso")
    except Exception:
        return json_error_response(500, "Erro ao salvar página.")


@router.delete("/picture-pages")
async def delete_picture_page_route(
    id: str | None = Query(default=None),
    _current_user: object = Depends(require_permission("picturePages", "manage")),
    db: Connection = Depends(get_db),
):
    if not _required_text(id):
        return json_error_response(400, "ID é obrigatório.")
    try:
        delete_picture_page(db, id)
        return build_success_payload(message="Página excluída com sucesso")
    except Exception:
        return json_error_response(500, "Erro ao excluir página.")


@router.put("/picture-links")
async def put_picture_link(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("picturePages", "manage")),
    db: Connection = Depends(get_db),
):
    validation = _validate_picture_link_payload(payload)
    if isinstance(validation, JSONResponse):
        return validation

    try:
        upsert_picture_link(db, validation)
        return build_success_payload(message="Link salvo com sucesso")
    except LookupError as exc:
        return json_error_response(400, str(exc))
    except ValueError as exc:
        return json_error_response(400, str(exc))
    except Exception:
        return json_error_response(500, "Erro ao salvar link.")


@router.delete("/picture-links")
async def delete_picture_link_route(
    id: str | None = Query(default=None),
    _current_user: object = Depends(require_permission("picturePages", "manage")),
    db: Connection = Depends(get_db),
):
    if not _required_text(id):
        return json_error_response(400, "ID é obrigatório.")
    try:
        delete_picture_link(db, id)
        return build_success_payload(message="Link excluído com sucesso")
    except Exception:
        return json_error_response(500, "Erro ao excluir link.")


@router.get("/radar-groups")
async def get_radar_groups(
    _current_user: object = Depends(require_permission("radarGroups", "view")),
    db: Connection = Depends(get_db),
):
    try:
        items = list_radar_groups(db)
        return build_success_payload({"items": items})
    except Exception:
        return json_error_response(500, "Erro ao buscar grupos de radares.")


@router.post("/radar-groups")
async def post_radar_group(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("radarGroups", "manage")),
    db: Connection = Depends(get_db),
):
    validation = _validate_radar_group_payload(payload)
    if isinstance(validation, JSONResponse):
        return validation
    try:
        upsert_radar_group(db, validation)
        return build_success_payload(message="Grupo criado com sucesso")
    except Exception:
        return json_error_response(500, "Erro ao criar grupo.")


@router.put("/radar-groups")
async def put_radar_group(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("radarGroups", "manage")),
    db: Connection = Depends(get_db),
):
    validation = _validate_radar_group_payload(payload)
    if isinstance(validation, JSONResponse):
        return validation
    try:
        upsert_radar_group(db, validation)
        return build_success_payload(message="Grupo atualizado com sucesso")
    except Exception:
        return json_error_response(500, "Erro ao atualizar grupo.")


@router.delete("/radar-groups")
async def delete_radar_group_route(
    id: str | None = Query(default=None),
    _current_user: object = Depends(require_permission("radarGroups", "manage")),
    db: Connection = Depends(get_db),
):
    if not _required_text(id):
        return json_error_response(400, "ID é obrigatório.")
    try:
        delete_radar_group(db, id)
        return build_success_payload(message="Grupo excluído com sucesso")
    except LookupError as exc:
        return json_error_response(400, str(exc))
    except Exception:
        return json_error_response(500, "Erro ao excluir grupo.")


@router.get("/radars")
async def get_radars(
    _current_user: object = Depends(require_permission("radars", "view")),
    db: Connection = Depends(get_db),
):
    try:
        items = list_radars(db)
        return build_success_payload({"items": items})
    except Exception:
        return json_error_response(500, "Erro ao buscar radares.")


@router.put("/radars")
async def put_radar(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("radars", "manage")),
    db: Connection = Depends(get_db),
):
    validation = _validate_radar_payload(payload)
    if isinstance(validation, JSONResponse):
        return validation
    try:
        upsert_radar(db, validation)
        return build_success_payload(message="Radar salvo com sucesso")
    except LookupError as exc:
        return json_error_response(400, str(exc))
    except ValueError as exc:
        return json_error_response(400, str(exc))
    except Exception:
        return json_error_response(500, "Erro ao salvar radar.")


@router.delete("/radars")
async def delete_radar_route(
    id: str | None = Query(default=None),
    _current_user: object = Depends(require_permission("radars", "manage")),
    db: Connection = Depends(get_db),
):
    if not _required_text(id):
        return json_error_response(400, "ID é obrigatório.")
    try:
        delete_radar(db, id)
        return build_success_payload(message="Radar excluído com sucesso")
    except Exception:
        return json_error_response(500, "Erro ao excluir radar.")


@router.post("/seed-radars")
async def seed_radars(_current_user: object = Depends(require_permission("radars", "manage"))):
    return build_success_payload(message="Seed de monitoramento executado com sucesso")


@router.post("/products")
async def monitoring_products(
    payload: dict[str, object],
    _current_user: CurrentUser = Depends(get_current_user),
):
    products = payload.get("products")
    active_products = products if isinstance(products, list) else []
    try:
        data = await get_monitoring_products_from_kafka_rest(active_products)
        return build_success_payload(data)
    except Exception:
        return json_error_response(500, "Erro ao carregar dados de monitoramento")


def _validate_picture_page_payload(payload: dict[str, object], *, require_id: bool) -> dict[str, object] | JSONResponse:
    identifier = _required_text(payload.get("id"))
    if require_id and not identifier:
        return json_error_response(400, "ID é obrigatório")

    slug = _required_text(payload.get("slug"))
    name = _required_text(payload.get("name"))
    url = _required_text(payload.get("url"))
    if not slug or not name or not url:
        return json_error_response(400, "Dados inválidos")

    return {
        **({"id": identifier} if identifier else {}),
        "slug": slug,
        "name": name,
        "url": url,
        "description": _optional_text(payload.get("description")),
        "checkMode": _optional_text(payload.get("checkMode")),
        "status": _optional_text(payload.get("status")),
        "delay": _optional_text(payload.get("delay")),
        "delayMinutes": payload.get("delayMinutes"),
        "delayedLinks": payload.get("delayedLinks"),
        "offlineLinks": payload.get("offlineLinks"),
    }


def _validate_picture_link_payload(payload: dict[str, object]) -> dict[str, object] | JSONResponse:
    identifier = _required_text(payload.get("id"))
    page_id = _required_text(payload.get("pageId"))
    slug = _required_text(payload.get("slug"))
    url = _required_text(payload.get("url"))
    if not identifier or not page_id or not slug or not url:
        return json_error_response(400, "Dados inválidos")

    return {
        "id": identifier,
        "pageId": page_id,
        "slug": slug,
        "name": _optional_text(payload.get("name")) or slug,
        "url": url,
        "size": _optional_text(payload.get("size")),
        "lastUpdate": _optional_text(payload.get("lastUpdate")),
        "delay": _optional_text(payload.get("delay")),
        "delayMinutes": payload.get("delayMinutes"),
        "status": _optional_text(payload.get("status")),
    }


def _validate_radar_group_payload(payload: dict[str, object]) -> dict[str, object] | JSONResponse:
    identifier = _required_text(payload.get("id"))
    slug = _required_text(payload.get("slug"))
    name = _required_text(payload.get("name"))
    if not identifier or not slug or not name:
        return json_error_response(400, "Dados inválidos")

    return {
        "id": identifier,
        "slug": slug,
        "name": name,
        "sortOrder": _optional_int(payload.get("sortOrder")) or 0,
    }


def _validate_radar_payload(payload: dict[str, object]) -> dict[str, object] | JSONResponse:
    identifier = _required_text(payload.get("id"))
    slug = _required_text(payload.get("slug"))
    group_id = _required_text(payload.get("groupId"))
    name = _required_text(payload.get("name"))
    if not identifier or not slug or not group_id or not name:
        return json_error_response(400, "Dados inválidos")

    return {
        "id": identifier,
        "slug": slug,
        "groupId": group_id,
        "name": name,
        "description": _optional_text(payload.get("description")),
        "webhookUrl": _optional_text(payload.get("webhookUrl")),
        "logUrl": _optional_text(payload.get("logUrl")),
        "status": _optional_text(payload.get("status")),
        "delay": _optional_text(payload.get("delay")),
        "delayMinutes": payload.get("delayMinutes"),
        "logDate": _optional_text(payload.get("logDate")),
        "active": _optional_bool(payload.get("active"), default=True),
    }


def _required_text(value: object | None) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _optional_text(value: object | None) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _optional_int(value: object | None) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            return int(text)
        except ValueError:
            return None
    return None


def _optional_bool(value: object | None, *, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes", "y", "on"}:
            return True
        if normalized in {"false", "0", "no", "n", "off"}:
            return False
    return default
