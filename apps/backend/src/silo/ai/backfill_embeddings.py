from __future__ import annotations

import argparse
import asyncio
import json
import sys
from dataclasses import asdict, dataclass
from datetime import UTC, datetime

from sqlalchemy import Table, create_engine, delete, insert, select
from sqlalchemy.engine import Connection

from silo.ai.assistant_runtime import probe_ai_runtime
from silo.ai.chunking import TextChunk, chunk_markdown
from silo.ai.embeddings import (
    embedding_content_hash,
    embedding_model_digest,
    generate_embedding,
    update_embedding_sql,
)
from silo.config import Settings, load_settings
from silo.db.models import legacy_tables
from silo.db.url import sqlalchemy_database_url

DEFAULT_BATCH_SIZE = 50
DEFAULT_HELP_CHAR_LIMIT = 3_000


@dataclass(frozen=True, slots=True)
class BackfillSummary:
    dry_run: bool
    database_url: str
    chat_model: str
    embedding_model: str
    chat_digest: str | None
    embedding_digest: str | None
    problems_processed: int = 0
    problems_updated: int = 0
    solutions_processed: int = 0
    solutions_updated: int = 0
    manuals_processed: int = 0
    manual_chunks_written: int = 0
    help_processed: int = 0
    help_updated: int = 0


async def run_backfill(
    settings: Settings,
    *,
    database_url: str | None = None,
    batch_size: int = DEFAULT_BATCH_SIZE,
    sleep_ms: int = 0,
    limit: int | None = None,
    resume_after_id: str | None = None,
    dry_run: bool = False,
    help_char_limit: int = DEFAULT_HELP_CHAR_LIMIT,
) -> BackfillSummary:
    probe = await probe_ai_runtime(settings)
    if probe.fallback_reason is not None:
        raise RuntimeError(probe.fallback_reason)

    effective_database_url = database_url or settings.database_url.get_secret_value()
    engine = create_engine(sqlalchemy_database_url(effective_database_url), pool_pre_ping=True)
    summary = BackfillSummary(
        dry_run=dry_run,
        database_url=effective_database_url,
        chat_model=settings.vllm.model,
        embedding_model=settings.vllm.embedding_model,
        chat_digest=probe.chat_digest,
        embedding_digest=probe.embedding_digest
        or embedding_model_digest(settings.vllm.embedding_model),
    )
    try:
        with engine.begin() as connection:
            summary = await _run_backfill_with_connection(
                connection,
                summary,
                batch_size=batch_size,
                sleep_ms=sleep_ms,
                limit=limit,
                resume_after_id=resume_after_id,
                dry_run=dry_run,
                help_char_limit=help_char_limit,
            )
    finally:
        engine.dispose()
    return summary


async def _run_backfill_with_connection(
    connection: Connection,
    summary: BackfillSummary,
    *,
    batch_size: int,
    sleep_ms: int,
    limit: int | None,
    resume_after_id: str | None,
    dry_run: bool,
    help_char_limit: int,
) -> BackfillSummary:
    problems_processed, problems_updated = await _backfill_embeddings_for_table(
        connection,
        table_name="product_problem",
        text_columns=("title", "description"),
        batch_size=batch_size,
        limit=limit,
        resume_after_id=resume_after_id,
        dry_run=dry_run,
        sleep_ms=sleep_ms,
        embedding_model=summary.embedding_model,
        embedding_digest=summary.embedding_digest
        or embedding_model_digest(summary.embedding_model),
    )
    solutions_processed, solutions_updated = await _backfill_embeddings_for_table(
        connection,
        table_name="product_solution",
        text_columns=("description",),
        batch_size=batch_size,
        limit=limit,
        resume_after_id=resume_after_id,
        dry_run=dry_run,
        sleep_ms=sleep_ms,
        embedding_model=summary.embedding_model,
        embedding_digest=summary.embedding_digest
        or embedding_model_digest(summary.embedding_model),
    )
    manuals_processed, manual_chunks_written = await _backfill_manuals(
        connection,
        dry_run=dry_run,
        sleep_ms=sleep_ms,
        limit=limit,
        embedding_model=summary.embedding_model,
        embedding_digest=summary.embedding_digest
        or embedding_model_digest(summary.embedding_model),
    )
    help_processed, help_updated = await _backfill_help(
        connection,
        dry_run=dry_run,
        help_char_limit=help_char_limit,
        embedding_model=summary.embedding_model,
        embedding_digest=summary.embedding_digest
        or embedding_model_digest(summary.embedding_model),
    )

    return BackfillSummary(
        dry_run=dry_run,
        database_url=summary.database_url,
        chat_model=summary.chat_model,
        embedding_model=summary.embedding_model,
        chat_digest=summary.chat_digest,
        embedding_digest=summary.embedding_digest,
        problems_processed=problems_processed,
        problems_updated=problems_updated,
        solutions_processed=solutions_processed,
        solutions_updated=solutions_updated,
        manuals_processed=manuals_processed,
        manual_chunks_written=manual_chunks_written,
        help_processed=help_processed,
        help_updated=help_updated,
    )


async def _backfill_embeddings_for_table(
    connection: Connection,
    *,
    table_name: str,
    text_columns: tuple[str, ...],
    batch_size: int,
    limit: int | None,
    resume_after_id: str | None,
    dry_run: bool,
    sleep_ms: int,
    embedding_model: str,
    embedding_digest: str,
) -> tuple[int, int]:
    table = legacy_tables[table_name]
    has_metadata = _has_embedding_metadata(table)
    processed = 0
    updated = 0
    last_id = resume_after_id

    while True:
        statement = select(table).order_by(table.c.id.asc())
        if not has_metadata:
            statement = statement.where(table.c.embedding.is_(None))
        if last_id:
            statement = statement.where(table.c.id > last_id)
        if limit is not None:
            remaining = max(limit - processed, 0)
            if remaining == 0:
                break
            statement = statement.limit(min(batch_size, remaining))
        else:
            statement = statement.limit(batch_size)

        rows = list(connection.execute(statement).mappings().all())
        if not rows:
            break

        for row in rows:
            row_dict = dict(row)
            text = " ".join(
                part.strip()
                for column_name in text_columns
                if isinstance((part := row_dict.get(column_name)), str) and part.strip()
            )
            if has_metadata and _embedding_metadata_matches(
                row_dict,
                text,
                embedding_model=embedding_model,
                embedding_digest=embedding_digest,
            ):
                processed += 1
                last_id = str(row_dict["id"])
                continue
            embedding = await generate_embedding(text)
            _validate_embedding_vector(embedding)
            processed += 1
            last_id = str(row_dict["id"])
            if not dry_run:
                connection.execute(
                    update_embedding_sql(
                        table_name,
                        "embedding",
                        str(row_dict["id"]),
                        embedding,
                    )
                )
                _persist_embedding_metadata(
                    connection,
                    table,
                    str(row_dict["id"]),
                    text,
                    embedding_model=embedding_model,
                    embedding_digest=embedding_digest,
                )
                updated += 1

        if sleep_ms > 0:
            await asyncio.sleep(sleep_ms / 1000)

    return processed, updated


async def _backfill_manuals(
    connection: Connection,
    *,
    dry_run: bool,
    sleep_ms: int,
    limit: int | None,
    embedding_model: str,
    embedding_digest: str,
) -> tuple[int, int]:
    manual_table = legacy_tables["product_manual"]
    chunk_table = legacy_tables["product_manual_chunk"]
    rows = list(
        connection.execute(select(manual_table).order_by(manual_table.c.id.asc())).mappings().all()
    )
    processed = 0
    chunks_written = 0

    for row in rows:
        if limit is not None and processed >= limit:
            break

        manual = dict(row)
        processed += 1
        chunks = chunk_markdown(str(manual.get("description") or ""))
        if _manual_chunks_are_current(
            connection,
            chunk_table,
            str(manual["id"]),
            chunks,
            embedding_model=embedding_model,
            embedding_digest=embedding_digest,
        ):
            continue
        if dry_run:
            chunks_written += len(chunks)
            continue

        connection.execute(
            delete(chunk_table).where(chunk_table.c.product_manual_id == manual["id"])
        )
        for chunk in chunks:
            embedding = await generate_embedding(chunk.content)
            _validate_embedding_vector(embedding)
            connection.execute(
                insert(chunk_table).values(
                    _with_embedding_metadata(
                        {
                        "id": f"{manual['id']}_chunk_{chunk.index}",
                        "product_manual_id": manual["id"],
                        "product_id": manual["product_id"],
                        "chunk_index": chunk.index,
                        "content": chunk.content,
                        "token_count": chunk.token_count,
                        "embedding": list(embedding),
                        },
                        chunk.content,
                        embedding_model=embedding_model,
                        embedding_digest=embedding_digest,
                        table=chunk_table,
                    )
                )
            )
            chunks_written += 1

        if sleep_ms > 0:
            await asyncio.sleep(sleep_ms / 1000)

    return processed, chunks_written


async def _backfill_help(
    connection: Connection,
    *,
    dry_run: bool,
    help_char_limit: int,
    embedding_model: str,
    embedding_digest: str,
) -> tuple[int, int]:
    help_table = legacy_tables["help"]
    row = (
        connection.execute(select(help_table).where(help_table.c.id == "system-help").limit(1))
        .mappings()
        .first()
    )
    if row is None:
        return 0, 0

    description = str(row["description"] or "")
    if not description.strip():
        return 1, 0

    truncated = description[:help_char_limit]
    if _embedding_metadata_matches(
        dict(row),
        truncated,
        embedding_model=embedding_model,
        embedding_digest=embedding_digest,
    ):
        return 1, 0
    embedding = await generate_embedding(truncated)
    _validate_embedding_vector(embedding)
    if dry_run:
        return 1, 0

    connection.execute(update_embedding_sql("help", "embedding", "system-help", embedding))
    _persist_embedding_metadata(
        connection,
        help_table,
        "system-help",
        truncated,
        embedding_model=embedding_model,
        embedding_digest=embedding_digest,
    )
    return 1, 1


def _has_embedding_metadata(table: Table) -> bool:
    return all(getattr(table.c, name, None) is not None for name in _EMBEDDING_METADATA_COLUMNS)


_EMBEDDING_METADATA_COLUMNS = (
    "embedding_model",
    "embedding_digest",
    "embedding_content_hash",
    "embedding_updated_at",
)


def _embedding_metadata_matches(
    row: dict[str, object],
    text: str,
    *,
    embedding_model: str,
    embedding_digest: str,
) -> bool:
    return bool(
        row.get("embedding") is not None
        and row.get("embedding_model") == embedding_model
        and row.get("embedding_digest") == embedding_digest
        and row.get("embedding_content_hash") == embedding_content_hash(text)
    )


def _with_embedding_metadata(
    values: dict[str, object],
    text: str,
    *,
    embedding_model: str,
    embedding_digest: str,
    table: Table,
) -> dict[str, object]:
    if _has_embedding_metadata(table):
        values.update(
            {
                "embedding_model": embedding_model,
                "embedding_digest": embedding_digest,
                "embedding_content_hash": embedding_content_hash(text),
                "embedding_updated_at": datetime.now(UTC).replace(tzinfo=None),
            }
        )
    return values


def _persist_embedding_metadata(
    connection: Connection,
    table: Table,
    row_id: str,
    text: str,
    *,
    embedding_model: str,
    embedding_digest: str,
) -> None:
    values = _with_embedding_metadata(
        {},
        text,
        embedding_model=embedding_model,
        embedding_digest=embedding_digest,
        table=table,
    )
    if values:
        connection.execute(table.update().where(table.c.id == row_id).values(**values))


def _manual_chunks_are_current(
    connection: Connection,
    chunk_table: Table,
    manual_id: str,
    chunks: list[TextChunk],
    *,
    embedding_model: str,
    embedding_digest: str,
) -> bool:
    if not _has_embedding_metadata(chunk_table):
        return False
    rows = list(
        connection.execute(
            select(chunk_table).where(chunk_table.c.product_manual_id == manual_id)
        ).mappings()
    )
    if len(rows) != len(chunks):
        return False
    by_index = {int(row["chunk_index"]): dict(row) for row in rows}
    return all(
        _embedding_metadata_matches(
            by_index.get(int(chunk.index), {}),
            str(chunk.content),
            embedding_model=embedding_model,
            embedding_digest=embedding_digest,
        )
        and by_index[int(chunk.index)].get("content") == chunk.content
        for chunk in chunks
    )


def _validate_embedding_vector(embedding: tuple[float, ...]) -> None:
    if len(embedding) != 768:
        raise RuntimeError(
            f"Embedding inválido: esperado 768 dimensões, recebido {len(embedding)}."
        )
    for value in embedding:
        if value != value or value in (float("inf"), float("-inf")):
            raise RuntimeError("Embedding contém NaN ou Infinity.")


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill idempotente de embeddings do SILO.")
    parser.add_argument("--database-url", default="", help="URL PostgreSQL opcional.")
    parser.add_argument(
        "--batch-size", type=int, default=DEFAULT_BATCH_SIZE, help="Tamanho do lote."
    )
    parser.add_argument(
        "--sleep-ms", type=int, default=0, help="Pausa entre lotes para rate limit."
    )
    parser.add_argument("--limit", type=int, default=None, help="Limite máximo por tabela.")
    parser.add_argument("--resume-after-id", default=None, help="Retomar a partir do ID informado.")
    parser.add_argument("--dry-run", action="store_true", help="Validar sem gravar nada.")
    parser.add_argument(
        "--help-char-limit",
        type=int,
        default=DEFAULT_HELP_CHAR_LIMIT,
        help="Teto de caracteres aplicado ao texto da ajuda antes do embedding.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(sys.argv[1:] if argv is None else argv)
    settings = load_settings()
    summary = asyncio.run(
        run_backfill(
            settings,
            database_url=args.database_url or None,
            batch_size=args.batch_size,
            sleep_ms=args.sleep_ms,
            limit=args.limit,
            resume_after_id=args.resume_after_id,
            dry_run=args.dry_run,
            help_char_limit=args.help_char_limit,
        )
    )
    print(json.dumps(asdict(summary), ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
