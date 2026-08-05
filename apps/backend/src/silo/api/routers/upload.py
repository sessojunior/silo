from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from fastapi.responses import FileResponse, JSONResponse
from starlette.formparsers import MultiPartException

from silo.api.dependencies import get_current_user, require_admin
from silo.api.responses import build_success_payload, json_error_response
from silo.api.upload_io import is_multipart_content_type, parse_multipart_form, read_upload_bytes, select_upload_from_form
from silo.storage.uploads import (
    MAX_FILE_SIZE_BYTES,
    delete_upload_file,
    get_content_type_from_filename,
    is_safe_filename,
    is_upload_kind,
    resolve_upload_path,
    store_buffer_as_webp,
)

router = APIRouter(prefix="/api/upload", tags=["upload"])

KIND_ALIASES: dict[str, str] = {
    "avatar": "avatars",
    "contact": "contacts",
    "problem": "problems",
    "solution": "solutions",
}


def _normalize_kind(kind: str) -> str:
    return KIND_ALIASES.get(kind, kind)


@router.post("/{kind}")
async def upload_file(
    kind: str,
    request: Request,
    _current_user: object = Depends(get_current_user),
):
    normalized_kind = _normalize_kind(kind)
    if not is_upload_kind(normalized_kind):
        return json_error_response(400, f"Tipo de upload inválido: {normalized_kind}")

    if not is_multipart_content_type(request.headers.get("content-type")):
        return json_error_response(400, "Requisição deve ser multipart/form-data")

    try:
        form = await parse_multipart_form(request, max_files=1)
    except MultiPartException:
        return json_error_response(400, "Envie apenas um arquivo.")

    upload = select_upload_from_form(form, ("file", "fileToUpload"))
    if upload is None:
        return json_error_response(400, "Nenhum arquivo enviado.")

    buffer = await read_upload_bytes(upload, max_bytes=MAX_FILE_SIZE_BYTES)
    if buffer is None:
        return json_error_response(400, "Arquivo muito grande. Máximo 4MB.")

    result = store_buffer_as_webp(
        normalized_kind,
        upload.filename or "upload",
        buffer,
        mode="square" if normalized_kind in {"avatars", "contacts"} else "inside",
        size=200 if normalized_kind in {"avatars", "contacts"} else 128,
        max_width=1200,
        max_height=1200,
        quality=85,
    )
    if isinstance(result, dict):
        return json_error_response(400, result.get("error", "Erro ao processar upload"))

    return JSONResponse(
        status_code=201,
        content=build_success_payload({"url": result.url, "filename": result.filename}),
    )


@router.get("/serve/{kind}/{filename}")
async def serve_upload(
    kind: str,
    filename: str,
    _current_user: object = Depends(get_current_user),
):
    normalized_kind = _normalize_kind(kind)
    if not is_upload_kind(normalized_kind) or not is_safe_filename(filename):
        return json_error_response(404, "Arquivo não encontrado.")

    file_path = resolve_upload_path(normalized_kind, filename)
    if file_path is None or not file_path.exists():
        return json_error_response(404, "Arquivo não encontrado.")

    return FileResponse(
        file_path,
        media_type=get_content_type_from_filename(filename),
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
        filename=filename,
    )


@router.delete("/serve/{kind}/{filename}")
async def delete_upload(
    kind: str,
    filename: str,
    _current_user: object = Depends(require_admin),
):
    normalized_kind = _normalize_kind(kind)
    if not is_upload_kind(normalized_kind) or not is_safe_filename(filename):
        return json_error_response(404, "Arquivo não encontrado.")

    file_path = resolve_upload_path(normalized_kind, filename)
    if file_path is None or not file_path.exists():
        return json_error_response(404, "Arquivo não encontrado.")

    deleted = delete_upload_file(normalized_kind, filename)
    if not deleted:
        return json_error_response(404, "Arquivo não encontrado.")

    return build_success_payload(None)
