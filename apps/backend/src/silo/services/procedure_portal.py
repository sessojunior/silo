from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable, Mapping

from sqlalchemy import delete, insert, select, update
from sqlalchemy.engine import Connection

from silo.db.models import legacy_tables
from silo.db.serialization import serialize_legacy_row
from silo.services.common import service_failure, service_success
from silo.services.embedding_write import (
    upsert_procedure_attachment_embeddings,
    upsert_procedure_embedding,
)
from silo.services.legacy_utils import new_uuid, now_naive, required_text
from silo.services.procedure_attachment_storage import (
    delete_procedure_attachment_file,
    store_procedure_attachment,
)
from silo.services.procedure_extraction import extract_document
from silo.storage.uploads import get_uploads_root

logger = logging.getLogger(__name__)


def list_general_procedures(
    db: Connection,
    *,
    search: str | None = None,
    active: bool | None = True,
    page: int = 1,
    limit: int = 20,
) -> dict[str, object]:
    procedure_table = legacy_tables["general_procedure"]
    statement = select(procedure_table).order_by(
        procedure_table.c.updated_at.desc(), procedure_table.c.id.desc()
    )
    filters = []
    if active is not None:
        filters.append(procedure_table.c.active.is_(active))
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        filters.append(
            procedure_table.c.title.ilike(pattern)
            | procedure_table.c.category.ilike(pattern)
            | procedure_table.c.content.ilike(pattern)
        )
    if filters:
        statement = statement.where(*filters)

    offset = max(0, page - 1) * max(1, limit)
    rows = db.execute(statement.limit(max(1, limit)).offset(offset)).mappings().all()
    items = [_procedure_payload(db, row) for row in rows]
    return service_success({"items": items, "total": len(items)})


def get_general_procedure(db: Connection, *, id: str) -> dict[str, object]:
    table = legacy_tables["general_procedure"]
    row = db.execute(select(table).where(table.c.id == id).limit(1)).mappings().first()
    if row is None:
        return service_failure("Procedimento não encontrado.", 404)
    return service_success({"procedure": _procedure_payload(db, row)})


def create_general_procedure(
    db: Connection,
    *,
    user_id: str,
    title: object,
    content: object,
    category: object | None = None,
    active: object = True,
) -> dict[str, object]:
    normalized_title = required_text(title, "title")
    normalized_content = required_text(content, "content")
    if normalized_title is None:
        return service_failure("Título é obrigatório.", 400, field="title")
    if normalized_content is None:
        return service_failure("Conteúdo é obrigatório.", 400, field="content")

    procedure_table = legacy_tables["general_procedure"]
    procedure_id = new_uuid()
    now = now_naive()
    row = {
        "id": procedure_id,
        "user_id": user_id,
        "title": normalized_title,
        "content": normalized_content,
        "category": required_text(category, "category"),
        "active": bool(active),
        "created_at": now,
        "updated_at": now,
    }
    db.execute(insert(procedure_table).values(row))
    db.commit()
    created = db.execute(
        select(procedure_table).where(procedure_table.c.id == procedure_id).limit(1)
    ).mappings().first()
    assert created is not None
    _schedule_embedding(
        lambda: upsert_procedure_embedding(
            procedure_id,
            str(created["title"]),
            str(created["content"]),
        )
    )
    return service_success({"procedure": _procedure_payload(db, created)})


def update_general_procedure(
    db: Connection,
    *,
    id: str,
    title: object,
    content: object,
    category: object | None = None,
    active: object = True,
) -> dict[str, object]:
    normalized_title = required_text(title, "title")
    normalized_content = required_text(content, "content")
    if normalized_title is None:
        return service_failure("Título é obrigatório.", 400, field="title")
    if normalized_content is None:
        return service_failure("Conteúdo é obrigatório.", 400, field="content")

    procedure_table = legacy_tables["general_procedure"]
    updated = db.execute(
        update(procedure_table)
        .where(procedure_table.c.id == id)
        .values(
            title=normalized_title,
            content=normalized_content,
            category=required_text(category, "category"),
            active=bool(active),
            updated_at=now_naive(),
        )
        .returning(procedure_table)
    ).mappings().first()
    if updated is None:
        return service_failure("Procedimento não encontrado.", 404)
    db.commit()
    _schedule_embedding(
        lambda: upsert_procedure_embedding(
            id,
            str(updated["title"]),
            str(updated["content"]),
        )
    )
    return service_success({"procedure": _procedure_payload(db, updated)})


def delete_general_procedure(db: Connection, *, id: str) -> dict[str, object]:
    procedure_table = legacy_tables["general_procedure"]
    attachment_table = legacy_tables["general_procedure_attachment"]
    row = db.execute(select(procedure_table.c.id).where(procedure_table.c.id == id)).first()
    if row is None:
        return service_failure("Procedimento não encontrado.", 404)

    attachment_rows = db.execute(
        select(attachment_table.c.stored_filename).where(attachment_table.c.procedure_id == id)
    ).mappings().all()
    db.execute(delete(procedure_table).where(procedure_table.c.id == id))
    db.commit()

    for attachment in attachment_rows:
        delete_procedure_attachment_file(get_uploads_root(), str(attachment["stored_filename"]))
    return service_success(None)


def create_general_procedure_attachment(
    db: Connection,
    *,
    procedure_id: str,
    original_name: str,
    mime_type: str,
    content: bytes,
    image_description: str | None = None,
) -> dict[str, object]:
    procedure_table = legacy_tables["general_procedure"]
    attachment_table = legacy_tables["general_procedure_attachment"]
    procedure = db.execute(
        select(procedure_table.c.id).where(procedure_table.c.id == procedure_id).limit(1)
    ).first()
    if procedure is None:
        return service_failure("Procedimento não encontrado.", 404)

    stored = store_procedure_attachment(get_uploads_root(), original_name, content, mime_type)
    attachment_id = new_uuid()
    try:
        db.execute(
            insert(attachment_table).values(
                id=attachment_id,
                procedure_id=procedure_id,
                kind="image" if mime_type.startswith("image/") else "document",
                original_name=original_name,
                stored_filename=stored.filename,
                storage_kind="procedures",
                mime_type=mime_type,
                size_bytes=stored.size_bytes,
                sha256=stored.sha256,
                extraction_status="pending",
                image_description=(image_description or "").strip() or None,
                created_at=now_naive(),
                updated_at=now_naive(),
            )
        )
        db.commit()
        processed = process_general_procedure_attachment(db, attachment_id=attachment_id)
        if processed.get("ok") is False:
            return processed
    except Exception:
        db.rollback()
        delete_procedure_attachment_file(get_uploads_root(), stored.filename)
        raise

    attachment = db.execute(
        select(attachment_table).where(attachment_table.c.id == attachment_id).limit(1)
    ).mappings().first()
    assert attachment is not None
    return service_success({"attachment": _attachment_payload(attachment)})


def process_general_procedure_attachment(
    db: Connection, *, attachment_id: str
) -> dict[str, object]:
    attachment_table = legacy_tables["general_procedure_attachment"]
    chunk_table = legacy_tables["general_procedure_attachment_chunk"]
    attachment = db.execute(
        select(attachment_table).where(attachment_table.c.id == attachment_id).limit(1)
    ).mappings().first()
    if attachment is None:
        return service_failure("Anexo não encontrado.", 404)

    path = get_uploads_root() / str(attachment["storage_kind"]) / str(attachment["stored_filename"])
    try:
        db.execute(
            update(attachment_table)
            .where(attachment_table.c.id == attachment_id)
            .values(extraction_status="processing", extraction_error=None, updated_at=now_naive())
        )
        db.commit()
        if str(attachment["kind"]) == "document":
            extracted = extract_document(
                str(attachment["original_name"]),
                str(attachment["mime_type"]),
                path.read_bytes(),
            )
            db.execute(delete(chunk_table).where(chunk_table.c.attachment_id == attachment_id))
            for chunk in extracted.chunks:
                db.execute(
                    insert(chunk_table).values(
                        id=new_uuid(),
                        attachment_id=attachment_id,
                        chunk_index=chunk.index,
                        content=chunk.content,
                        page_number=chunk.page_number,
                        slide_number=chunk.slide_number,
                        token_count=chunk.token_count,
                        created_at=now_naive(),
                        updated_at=now_naive(),
                    )
                )
        elif str(attachment.get("image_description") or "").strip():
            description = str(attachment["image_description"]).strip()
            db.execute(delete(chunk_table).where(chunk_table.c.attachment_id == attachment_id))
            db.execute(
                insert(chunk_table).values(
                    id=new_uuid(),
                    attachment_id=attachment_id,
                    chunk_index=0,
                    content=description,
                    token_count=max(1, len(description.split())),
                    created_at=now_naive(),
                    updated_at=now_naive(),
                )
            )
        db.execute(
            update(attachment_table)
            .where(attachment_table.c.id == attachment_id)
            .values(extraction_status="ready", extraction_error=None, updated_at=now_naive())
        )
        db.commit()
        chunks = db.execute(
            select(chunk_table).where(chunk_table.c.attachment_id == attachment_id)
        ).mappings().all()
        _schedule_embedding(
            lambda: upsert_procedure_attachment_embeddings(attachment_id, chunks)
        )
        return service_success(None)
    except Exception as exc:
        db.rollback()
        db.execute(
            update(attachment_table)
            .where(attachment_table.c.id == attachment_id)
            .values(extraction_status="error", extraction_error=str(exc), updated_at=now_naive())
        )
        db.commit()
        return service_failure(
            "Não foi possível processar o anexo.",
            422,
            data={"detail": str(exc)},
        )


def delete_general_procedure_attachment(db: Connection, *, id: str) -> dict[str, object]:
    attachment_table = legacy_tables["general_procedure_attachment"]
    row = db.execute(
        select(attachment_table.c.stored_filename).where(attachment_table.c.id == id).limit(1)
    ).mappings().first()
    if row is None:
        return service_failure("Anexo não encontrado.", 404)
    db.execute(delete(attachment_table).where(attachment_table.c.id == id))
    db.commit()
    delete_procedure_attachment_file(get_uploads_root(), str(row["stored_filename"]))
    return service_success(None)


def _procedure_payload(db: Connection, row: Mapping[str, object]) -> dict[str, object]:
    payload = serialize_legacy_row(row)
    attachment_table = legacy_tables["general_procedure_attachment"]
    attachments = db.execute(
        select(attachment_table)
        .where(attachment_table.c.procedure_id == row["id"])
        .order_by(attachment_table.c.sort_order.asc(), attachment_table.c.created_at.asc())
    ).mappings().all()
    payload["attachments"] = [_attachment_payload(attachment) for attachment in attachments]
    return payload


def _attachment_payload(row: Mapping[str, object]) -> dict[str, object]:
    payload = serialize_legacy_row(row)
    payload["url"] = f"/uploads/procedures/{row['stored_filename']}"
    return payload


def _schedule_embedding(factory: Callable[[], object]) -> None:
    """Start indexing without delaying the CRUD response."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    task = loop.create_task(factory())  # type: ignore[arg-type]
    task.add_done_callback(_log_embedding_failure)


def _log_embedding_failure(task: asyncio.Task[object]) -> None:
    try:
        result = task.result()
    except Exception:
        logger.exception("Falha inesperada ao indexar procedimento")
        return
    if getattr(result, "status", None) in {"failed", "partial"}:
        logger.warning("Indexação de procedimento incompleta: %s", result)
