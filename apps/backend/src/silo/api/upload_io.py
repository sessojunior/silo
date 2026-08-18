from __future__ import annotations

from collections.abc import Sequence

from fastapi import Request

# O parser de multipart (starlette 1.3) produz starlette.datastructures.UploadFile;
# fastapi.UploadFile e uma subclasse, mas o isinstance contra a classe do fastapi
# falha para valores vindos de request.form() -> "Arquivo não enviado".
from starlette.datastructures import FormData, UploadFile

from silo.storage.uploads import MAX_FILE_SIZE_BYTES


def is_multipart_content_type(value: str | None) -> bool:
    return bool(value and value.lower().startswith("multipart/"))


async def parse_multipart_form(
    request: Request,
    *,
    max_files: int = 1,
    max_fields: int = 32,
    max_part_size: int = MAX_FILE_SIZE_BYTES,
) -> FormData:
    return await request.form(
        max_files=max_files,
        max_fields=max_fields,
        max_part_size=max_part_size,
    )


def select_upload_from_form(form: FormData, field_names: Sequence[str]) -> UploadFile | None:
    for field_name in field_names:
        value = form.get(field_name)
        if isinstance(value, UploadFile):
            return value
    return None


async def read_upload_bytes(
    upload: UploadFile,
    *,
    max_bytes: int = MAX_FILE_SIZE_BYTES,
    chunk_size: int = 64 * 1024,
) -> bytes | None:
    total = 0
    chunks: list[bytes] = []
    try:
        while True:
            chunk = await upload.read(chunk_size)
            if not chunk:
                break
            total += len(chunk)
            if total > max_bytes:
                return None
            chunks.append(chunk)
        return b"".join(chunks)
    finally:
        await upload.close()
