from __future__ import annotations

from sqlalchemy import CheckConstraint

from silo.db.models import legacy_tables


def test_general_procedure_tables_expose_searchable_procedure_and_attachment_metadata() -> None:
    procedure = legacy_tables["general_procedure"]
    attachment = legacy_tables["general_procedure_attachment"]
    chunk = legacy_tables["general_procedure_attachment_chunk"]

    assert {"id", "title", "content", "category", "active", "user_id"}.issubset(
        procedure.c.keys()
    )
    assert {"id", "procedure_id", "kind", "original_name", "stored_filename"}.issubset(
        attachment.c.keys()
    )
    assert {
        "mime_type",
        "size_bytes",
        "sha256",
        "extraction_status",
        "image_description",
    }.issubset(attachment.c.keys())
    assert {
        "id",
        "attachment_id",
        "content",
        "chunk_index",
        "page_number",
        "slide_number",
        "embedding",
        "embedding_content_hash",
    }.issubset(chunk.c.keys())


def test_general_procedure_attachment_status_has_explicit_check_constraint() -> None:
    attachment = legacy_tables["general_procedure_attachment"]
    constraints = [
        constraint.sqltext.text
        for constraint in attachment.constraints
        if isinstance(constraint, CheckConstraint)
    ]

    assert any("pending" in constraint and "processing" in constraint for constraint in constraints)
    assert any("ready" in constraint and "error" in constraint for constraint in constraints)
