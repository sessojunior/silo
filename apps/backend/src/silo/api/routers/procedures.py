from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy.engine import Connection
from starlette.formparsers import MultiPartException

from silo.api.dependencies import get_db, require_permission
from silo.api.responses import ApiResponse, build_success_payload
from silo.services.common import is_service_error, service_error_response
from silo.services.procedure_attachment_storage import MAX_PROCEDURE_ATTACHMENT_SIZE_BYTES
from silo.services.procedure_portal import (
    create_general_procedure,
    create_general_procedure_attachment,
    delete_general_procedure,
    delete_general_procedure_attachment,
    get_general_procedure,
    list_general_procedures,
    process_general_procedure_attachment,
    update_general_procedure,
)
from silo.storage.uploads import get_content_type_from_filename

router = APIRouter(prefix="/api/procedures", tags=["procedures"])


@router.get("")
@router.get("/")
async def get_procedures(
    search: str | None = Query(default=None),
    active: bool | None = Query(default=True),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    _current_user: object = Depends(require_permission("procedures", "view")),
    db: Connection = Depends(get_db),
) -> ApiResponse:
    result = list_general_procedures(db, search=search, active=active, page=page, limit=limit)
    return _result_response(result, "Erro ao listar procedimentos.")


@router.get("/{id}")
async def get_procedure(
    id: str,
    _current_user: object = Depends(require_permission("procedures", "view")),
    db: Connection = Depends(get_db),
) -> ApiResponse:
    result = get_general_procedure(db, id=id)
    return _result_response(result, "Erro ao consultar procedimento.")


@router.post("")
@router.post("/")
async def post_procedure(
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("procedures", "manage")),
    db: Connection = Depends(get_db),
) -> ApiResponse:
    result = create_general_procedure(
        db,
        user_id=str(getattr(_current_user, "id", "")),
        title=payload.get("title"),
        content=payload.get("content"),
        category=payload.get("category"),
        active=payload.get("active", True),
    )
    return _result_response(
        result,
        "Erro ao criar procedimento.",
        success_status=201,
        message="Procedimento criado com sucesso.",
    )


@router.put("/{id}")
async def put_procedure(
    id: str,
    payload: dict[str, object],
    _current_user: object = Depends(require_permission("procedures", "manage")),
    db: Connection = Depends(get_db),
) -> ApiResponse:
    result = update_general_procedure(
        db,
        id=id,
        title=payload.get("title"),
        content=payload.get("content"),
        category=payload.get("category"),
        active=payload.get("active", True),
    )
    return _result_response(
        result,
        "Erro ao atualizar procedimento.",
        message="Procedimento atualizado com sucesso.",
    )


@router.delete("/{id}")
async def delete_procedure(
    id: str,
    _current_user: object = Depends(require_permission("procedures", "manage")),
    db: Connection = Depends(get_db),
) -> ApiResponse:
    result = delete_general_procedure(db, id=id)
    return _result_response(
        result,
        "Erro ao excluir procedimento.",
        message="Procedimento excluído com sucesso.",
    )


@router.post("/{procedure_id}/attachments")
async def upload_procedure_attachment(
    procedure_id: str,
    request: Request,
    _current_user: object = Depends(require_permission("procedures", "manage")),
    db: Connection = Depends(get_db),
) -> ApiResponse:
    try:
        form = await request.form(
            max_files=1,
            max_fields=4,
            max_part_size=MAX_PROCEDURE_ATTACHMENT_SIZE_BYTES,
        )
    except MultiPartException:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Não foi possível ler o anexo enviado."},
        )
    upload = form.get("file") or form.get("fileToUpload")
    if upload is None or not hasattr(upload, "read"):
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Nenhum arquivo enviado."},
        )

    content = await upload.read()
    original_name = str(getattr(upload, "filename", None) or "attachment")
    mime_type = str(
        getattr(upload, "content_type", None)
        or get_content_type_from_filename(original_name)
    )
    result = create_general_procedure_attachment(
        db,
        procedure_id=procedure_id,
        original_name=original_name,
        mime_type=mime_type,
        content=content,
        image_description=str(form.get("description") or "").strip() or None,
    )
    return _result_response(
        result,
        "Erro ao adicionar anexo.",
        success_status=201,
        message="Anexo adicionado com sucesso.",
    )


@router.delete("/{procedure_id}/attachments/{attachment_id}")
async def delete_procedure_attachment(
    procedure_id: str,
    attachment_id: str,
    _current_user: object = Depends(require_permission("procedures", "manage")),
    db: Connection = Depends(get_db),
) -> ApiResponse:
    del procedure_id
    result = delete_general_procedure_attachment(db, id=attachment_id)
    return _result_response(result, "Erro ao excluir anexo.", message="Anexo excluído com sucesso.")


@router.post("/{procedure_id}/attachments/{attachment_id}/reprocess")
async def reprocess_procedure_attachment(
    procedure_id: str,
    attachment_id: str,
    _current_user: object = Depends(require_permission("procedures", "manage")),
    db: Connection = Depends(get_db),
) -> ApiResponse:
    del procedure_id
    result = process_general_procedure_attachment(db, attachment_id=attachment_id)
    return _result_response(
        result,
        "Erro ao reprocessar anexo.",
        message="Anexo enviado para processamento.",
    )


def _result_response(
    result: dict[str, Any],
    fallback: str,
    *,
    success_status: int = 200,
    message: str | None = None,
) -> ApiResponse:
    if is_service_error(result):
        response = service_error_response(result, fallback)
        assert response is not None
        return response
    data = result.get("data")
    return JSONResponse(
        status_code=success_status,
        content=build_success_payload(data, message=message),
    )
