from __future__ import annotations

import logging
from collections.abc import Iterable

from sqlalchemy import create_engine, delete, insert, update

from silo.ai.chunking import chunk_markdown
from silo.ai.embeddings import generate_embedding
from silo.config import load_settings
from silo.db.models import legacy_tables
from silo.db.url import sqlalchemy_database_url

logger = logging.getLogger(__name__)


async def upsert_problem_embedding(problem_id: str, title: str, description: str) -> None:
    try:
        payload = " ".join(part for part in (title, description) if part)
        embedding = await generate_embedding(payload)
        _execute_statement(
            update(legacy_tables["product_problem"])
            .where(legacy_tables["product_problem"].c.id == problem_id)
            .values(embedding=list(embedding))
        )
    except Exception as exc:  # pragma: no cover - fire-and-forget logging path
        logger.warning("Falha ao gerar embedding do problema %s: %s", problem_id, exc)


async def upsert_solution_embedding(solution_id: str, description: str) -> None:
    try:
        embedding = await generate_embedding(description)
        _execute_statement(
            update(legacy_tables["product_solution"])
            .where(legacy_tables["product_solution"].c.id == solution_id)
            .values(embedding=list(embedding))
        )
    except Exception as exc:  # pragma: no cover - fire-and-forget logging path
        logger.warning("Falha ao gerar embedding da solução %s: %s", solution_id, exc)


async def upsert_help_embedding(description: str) -> None:
    try:
        if not description or not description.strip():
            return
        embedding = await generate_embedding(description[:3000])
        _execute_statement(
            update(legacy_tables["help"])
            .where(legacy_tables["help"].c.id == "system-help")
            .values(embedding=list(embedding))
        )
    except Exception as exc:  # pragma: no cover - fire-and-forget logging path
        logger.warning("Falha ao gerar embedding da ajuda: %s", exc)


async def upsert_manual_chunks(manual_id: str, product_id: str, markdown: str) -> None:
    try:
        table = legacy_tables["product_manual_chunk"]
        statements = [delete(table).where(table.c.product_manual_id == manual_id)]
        chunks = _chunk_markdown(markdown)
        if not chunks:
            _execute_statements(statements)
            return

        for index, chunk in enumerate(chunks):
            try:
                embedding = await generate_embedding(chunk["content"])
                chunk_id = f"{manual_id}_chunk_{index}"
                statements.append(
                    insert(table).values(
                        id=chunk_id,
                        product_manual_id=manual_id,
                        product_id=product_id,
                        chunk_index=index,
                        content=chunk["content"],
                        token_count=chunk["token_count"],
                        embedding=list(embedding),
                    )
                )
            except Exception as chunk_exc:  # pragma: no cover - fire-and-forget logging path
                logger.warning("Falha no chunk %s do manual %s: %s", index, manual_id, chunk_exc)
        _execute_statements(statements)
    except Exception as exc:  # pragma: no cover - fire-and-forget logging path
        logger.warning("Falha ao processar manual %s: %s", manual_id, exc)


def _execute_statement(statement) -> None:
    _execute_statements([statement])


def _execute_statements(statements: Iterable[object]) -> None:
    settings = load_settings()
    engine = create_engine(sqlalchemy_database_url(settings.database_url.get_secret_value()), pool_pre_ping=True)
    try:
        with engine.begin() as connection:
            for statement in statements:
                connection.execute(statement)
    finally:
        engine.dispose()


def _chunk_markdown(markdown: str) -> list[dict[str, object]]:
    return [
        {
            "content": chunk.content,
            "token_count": chunk.token_count,
            "index": chunk.index,
        }
        for chunk in chunk_markdown(markdown)
    ]
