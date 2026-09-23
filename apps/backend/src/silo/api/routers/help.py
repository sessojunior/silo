from __future__ import annotations

import asyncio
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.engine import Connection

from silo.api.dependencies import get_db, require_permission
from silo.api.responses import ApiResponse, build_success_payload
from silo.db.models import legacy_tables
from silo.db.serialization import serialize_legacy_row
from silo.services.common import service_error_response, service_failure
from silo.services.embedding_write import upsert_help_embedding
from silo.storage.uploads import delete_upload_file, is_safe_filename, list_upload_files

router = APIRouter(prefix="/api/help", tags=["help"])

HELP_ID = "system-help"


@router.get("")
@router.get("/")
async def get_help(
    _current_user: object = Depends(require_permission("help", "view")),
    db: Connection = Depends(get_db),
) -> ApiResponse:
    help_doc = _get_help(db)
    return build_success_payload(help_doc)


@router.put("")
@router.put("/")
async def update_help(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("help", "manage")),
    db: Connection = Depends(get_db),
) -> ApiResponse:
    description = _extract_description(payload)
    _update_help(db, description)
    background_task = asyncio.create_task(upsert_help_embedding(description))
    if background_task is not None:
        background_task.add_done_callback(lambda task: task.exception())
    return build_success_payload(message="Documentação atualizada com sucesso")


@router.get("/images")
async def list_help_images(
    _current_user: object = Depends(require_permission("help", "view")),
) -> ApiResponse:
    items = list_upload_files("help")
    return build_success_payload({"items": items})


@router.delete("/images")
async def delete_help_image(
    filename: str | None = Query(default=None),
    _current_user: object = Depends(require_permission("help", "manage")),
) -> ApiResponse:
    if not filename or not is_safe_filename(filename):
        response = service_error_response(
            service_failure("Nome de arquivo inválido", 400),
            "Erro ao excluir imagem",
        )
        assert response is not None
        return response

    delete_upload_file("help", filename)
    return build_success_payload(message="Imagem excluída com sucesso")


def _get_help(db: Connection) -> dict[str, object]:
    help_table = legacy_tables["help"]

    row = (
        db.execute(select(help_table).where(help_table.c.id == HELP_ID).limit(1)).mappings().first()
    )
    if row is None:
        db.execute(help_table.insert().values(id=HELP_ID, description=""))
        db.commit()
        row = (
            db.execute(select(help_table).where(help_table.c.id == HELP_ID).limit(1))
            .mappings()
            .first()
        )
    assert row is not None
    return serialize_legacy_row(row)


def _update_help(db: Connection, description: str) -> None:
    help_table = legacy_tables["help"]

    existing = db.execute(
        select(help_table.c.id).where(help_table.c.id == HELP_ID).limit(1)
    ).first()
    if existing is None:
        db.execute(help_table.insert().values(id=HELP_ID, description=description or ""))
    else:
        db.execute(
            help_table.update()
            .where(help_table.c.id == HELP_ID)
            .values(description=description or "", updated_at=_now_naive())
        )
    db.commit()


def _extract_description(payload: dict[str, object]) -> str:
    description = payload.get("description")
    if isinstance(description, str):
        return description
    return ""


def _now_naive() -> datetime:
    return datetime.now()
