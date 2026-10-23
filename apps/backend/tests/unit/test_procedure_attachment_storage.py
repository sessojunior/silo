from __future__ import annotations

import io

import pytest
from PIL import Image

from silo.services.procedure_attachment_storage import (
    ProcedureAttachmentStorageError,
    delete_procedure_attachment_file,
    store_procedure_attachment,
)


def _png_bytes() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (4, 4), color=(20, 40, 60)).save(buffer, format="PNG")
    return buffer.getvalue()


def test_stores_original_image_with_safe_generated_filename_and_hash(tmp_path) -> None:
    stored = store_procedure_attachment(
        tmp_path,
        "screenshots/../diagnostico.png",
        _png_bytes(),
        "image/png",
    )

    assert stored.original_name == "screenshots/../diagnostico.png"
    assert stored.filename != "screenshots/../diagnostico.png"
    assert "/" not in stored.filename
    assert ".." not in stored.filename
    assert stored.sha256
    assert stored.path.read_bytes() == _png_bytes()
    assert stored.url == f"/uploads/procedures/{stored.filename}"


def test_rejects_mismatched_image_and_document_bytes(tmp_path) -> None:
    with pytest.raises(ProcedureAttachmentStorageError, match="imagem inválida"):
        store_procedure_attachment(tmp_path, "broken.png", b"not-an-image", "image/png")

    with pytest.raises(ProcedureAttachmentStorageError, match="MIME incompatível"):
        store_procedure_attachment(tmp_path, "guide.pdf", b"plain text", "text/plain")


def test_deletes_stored_file_and_rejects_oversized_payload(tmp_path) -> None:
    stored = store_procedure_attachment(tmp_path, "guide.txt", b"procedimento", "text/plain")

    assert delete_procedure_attachment_file(tmp_path, stored.filename)
    assert not stored.path.exists()
    assert not delete_procedure_attachment_file(tmp_path, stored.filename)

    with pytest.raises(ProcedureAttachmentStorageError, match="grande"):
        store_procedure_attachment(
            tmp_path,
            "guide.txt",
            b"x" * (20 * 1024 * 1024 + 1),
            "text/plain",
        )
