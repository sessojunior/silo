from __future__ import annotations

import hashlib
import io
import re
import uuid
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, UnidentifiedImageError

MAX_PROCEDURE_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024
PROCEDURE_UPLOAD_KIND = "procedures"


class ProcedureAttachmentStorageError(ValueError):
    """Raised when an attachment cannot be safely persisted."""


@dataclass(frozen=True, slots=True)
class StoredProcedureAttachment:
    filename: str
    original_name: str
    mime_type: str
    size_bytes: int
    sha256: str
    url: str
    path: Path


def store_procedure_attachment(
    uploads_root: Path,
    original_name: str,
    content: bytes,
    mime_type: str,
) -> StoredProcedureAttachment:
    if len(content) > MAX_PROCEDURE_ATTACHMENT_SIZE_BYTES:
        raise ProcedureAttachmentStorageError("Arquivo muito grande.")

    suffix = Path(original_name).suffix.lower()
    _validate_content(suffix, mime_type, content)
    safe_stem = re.sub(r"[^a-zA-Z0-9_-]", "", Path(original_name).stem)[:40]
    prefix = f"{safe_stem}-" if safe_stem else ""
    filename = f"{prefix}{uuid.uuid4().hex}{suffix}"
    directory = (uploads_root / PROCEDURE_UPLOAD_KIND).resolve()
    directory.mkdir(parents=True, exist_ok=True)
    path = (directory / filename).resolve()
    path.relative_to(directory)
    path.write_bytes(content)

    return StoredProcedureAttachment(
        filename=filename,
        original_name=original_name,
        mime_type=mime_type,
        size_bytes=len(content),
        sha256=hashlib.sha256(content).hexdigest(),
        url=f"/uploads/{PROCEDURE_UPLOAD_KIND}/{filename}",
        path=path,
    )


def delete_procedure_attachment_file(uploads_root: Path, filename: str) -> bool:
    if not filename or filename != Path(filename).name or ".." in filename:
        return False
    directory = (uploads_root / PROCEDURE_UPLOAD_KIND).resolve()
    path = (directory / filename).resolve()
    try:
        path.relative_to(directory)
    except ValueError:
        return False
    if not path.is_file() or path.is_symlink():
        return False
    path.unlink()
    return True


def _validate_content(suffix: str, mime_type: str, content: bytes) -> None:
    if suffix in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
        try:
            with Image.open(io.BytesIO(content)) as image:
                image.verify()
        except (OSError, UnidentifiedImageError) as exc:
            raise ProcedureAttachmentStorageError("imagem inválida.") from exc
        expected = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".webp": "image/webp",
            ".gif": "image/gif",
        }[suffix]
        if mime_type != expected:
            raise ProcedureAttachmentStorageError("MIME incompatível com a extensão do arquivo.")
        return

    expected = {
        ".pdf": "application/pdf",
        ".txt": "text/plain",
        ".md": "text/markdown",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    }.get(suffix)
    if expected is None or mime_type != expected:
        raise ProcedureAttachmentStorageError("MIME incompatível com a extensão do arquivo.")
    if suffix == ".pdf" and not content.startswith(b"%PDF-"):
        raise ProcedureAttachmentStorageError("PDF inválido.")
    if suffix in {".docx", ".pptx"} and not content.startswith(b"PK"):
        raise ProcedureAttachmentStorageError("Documento Office inválido.")
