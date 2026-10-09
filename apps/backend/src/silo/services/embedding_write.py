from __future__ import annotations

import logging
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Literal, TypedDict

from sqlalchemy import create_engine, delete, insert, update
from sqlalchemy.sql import Executable

from silo.ai.chunking import chunk_markdown
from silo.ai.embeddings import embedding_content_hash, embedding_model_digest, generate_embedding
from silo.config import load_settings
from silo.db.models import legacy_tables
from silo.db.url import sqlalchemy_database_url

logger = logging.getLogger(__name__)


class MarkdownChunk(TypedDict):
    content: str
    token_count: int
    index: int


@dataclass(frozen=True, slots=True)
class EmbeddingWriteResult:
    status: Literal["updated", "partial", "failed", "skipped"]
    updated_count: int = 0
    failed_count: int = 0
    errors: tuple[str, ...] = ()


async def upsert_problem_embedding(
    problem_id: str, title: str, description: str
) -> EmbeddingWriteResult:
    try:
        payload = " ".join(part for part in (title, description) if part)
        embedding = await generate_embedding(payload)
        table = legacy_tables["product_problem"]
        _execute_statement(
            update(table)
            .where(table.c.id == problem_id)
            .values(**_embedding_values(table, payload, embedding))
        )
        return EmbeddingWriteResult(status="updated", updated_count=1)
    except Exception as exc:  # pragma: no cover - fire-and-forget logging path
        logger.warning("Falha ao gerar embedding do problema %s: %s", problem_id, exc)
        return EmbeddingWriteResult(status="failed", failed_count=1, errors=(str(exc),))


async def upsert_solution_embedding(
    solution_id: str, description: str
) -> EmbeddingWriteResult:
    try:
        embedding = await generate_embedding(description)
        table = legacy_tables["product_solution"]
        _execute_statement(
            update(table)
            .where(table.c.id == solution_id)
            .values(**_embedding_values(table, description, embedding))
        )
        return EmbeddingWriteResult(status="updated", updated_count=1)
    except Exception as exc:  # pragma: no cover - fire-and-forget logging path
        logger.warning("Falha ao gerar embedding da solução %s: %s", solution_id, exc)
        return EmbeddingWriteResult(status="failed", failed_count=1, errors=(str(exc),))


async def upsert_help_embedding(description: str) -> EmbeddingWriteResult:
    try:
        if not description or not description.strip():
            return EmbeddingWriteResult(status="skipped")
        embedding = await generate_embedding(description[:3000])
        table = legacy_tables["help"]
        _execute_statement(
            update(table)
            .where(table.c.id == "system-help")
            .values(**_embedding_values(table, description[:3000], embedding))
        )
        return EmbeddingWriteResult(status="updated", updated_count=1)
    except Exception as exc:  # pragma: no cover - fire-and-forget logging path
        logger.warning("Falha ao gerar embedding da ajuda: %s", exc)
        return EmbeddingWriteResult(status="failed", failed_count=1, errors=(str(exc),))


async def upsert_manual_chunks(
    manual_id: str, product_id: str, markdown: str
) -> EmbeddingWriteResult:
    errors: list[str] = []
    generated_count = 0
    try:
        table = legacy_tables["product_manual_chunk"]
        statements: list[Executable] = [delete(table).where(table.c.product_manual_id == manual_id)]
        chunks = _chunk_markdown(markdown)
        if not chunks:
            _execute_statements(statements)
            return EmbeddingWriteResult(status="updated")

        for index, chunk in enumerate(chunks):
            try:
                embedding = await generate_embedding(chunk["content"])
                chunk_id = f"{manual_id}_chunk_{index}"
                statements.append(
                    insert(table).values(
                        **_embedding_values(
                            table,
                            chunk["content"],
                            embedding,
                            extra_values={
                                "id": chunk_id,
                                "product_manual_id": manual_id,
                                "product_id": product_id,
                                "chunk_index": index,
                                "content": chunk["content"],
                                "token_count": chunk["token_count"],
                            },
                        )
                    )
                )
                generated_count += 1
            except Exception as chunk_exc:  # pragma: no cover - fire-and-forget logging path
                logger.warning("Falha no chunk %s do manual %s: %s", index, manual_id, chunk_exc)
                errors.append(f"chunk {index}: {chunk_exc}")
        try:
            _execute_statements(statements)
        except Exception as persist_exc:  # pragma: no cover - fire-and-forget logging path
            logger.warning("Falha ao persistir chunks do manual %s: %s", manual_id, persist_exc)
            errors.append(f"persistência: {persist_exc}")
            return EmbeddingWriteResult(
                status="failed",
                failed_count=max(1, len(errors)),
                errors=tuple(errors),
            )
        if errors:
            return EmbeddingWriteResult(
                status="partial",
                updated_count=generated_count,
                failed_count=len(errors),
                errors=tuple(errors),
            )
        return EmbeddingWriteResult(status="updated", updated_count=generated_count)
    except Exception as exc:  # pragma: no cover - fire-and-forget logging path
        logger.warning("Falha ao processar manual %s: %s", manual_id, exc)
        return EmbeddingWriteResult(
            status="failed",
            updated_count=generated_count,
            failed_count=max(1, len(errors)),
            errors=tuple((*errors, str(exc))),
        )


def _execute_statement(statement: Executable) -> None:
    _execute_statements([statement])


def _execute_statements(statements: Iterable[Executable]) -> None:
    settings = load_settings()
    engine = create_engine(
        sqlalchemy_database_url(settings.database_url.get_secret_value()), pool_pre_ping=True
    )
    try:
        with engine.begin() as connection:
            for statement in statements:
                connection.execute(statement)
    finally:
        engine.dispose()


def _chunk_markdown(markdown: str) -> list[MarkdownChunk]:
    return [
        {
            "content": chunk.content,
            "token_count": chunk.token_count,
            "index": chunk.index,
        }
        for chunk in chunk_markdown(markdown)
    ]


def _embedding_values(
    table: Any,
    text_value: str,
    embedding: tuple[float, ...],
    *,
    extra_values: dict[str, object] | None = None,
) -> dict[str, object]:
    values: dict[str, object] = {"embedding": list(embedding)}
    if extra_values:
        values.update(extra_values)
    if all(getattr(table.c, name, None) is not None for name in _EMBEDDING_METADATA_COLUMNS):
        settings = load_settings()
        model = settings.vllm.embedding_model
        values.update(
            {
                "embedding_model": model,
                "embedding_digest": embedding_model_digest(model),
                "embedding_content_hash": embedding_content_hash(text_value),
                "embedding_updated_at": datetime.now(UTC).replace(tzinfo=None),
            }
        )
    return values


_EMBEDDING_METADATA_COLUMNS = (
    "embedding_model",
    "embedding_digest",
    "embedding_content_hash",
    "embedding_updated_at",
)
