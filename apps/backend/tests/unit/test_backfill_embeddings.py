from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import Column, Integer, JSON, MetaData, String, Table, create_engine, func, select, update
from sqlalchemy.pool import StaticPool

from silo.ai import backfill_embeddings
from silo.ai.ports import AiRuntimeProbe, RuntimeMode
from silo.config import load_settings


@dataclass(frozen=True, slots=True)
class _TestTables:
    product_problem: Table
    product_solution: Table
    product_manual: Table
    product_manual_chunk: Table
    help: Table

    def as_mapping(self) -> dict[str, Table]:
        return {
            "product_problem": self.product_problem,
            "product_solution": self.product_solution,
            "product_manual": self.product_manual,
            "product_manual_chunk": self.product_manual_chunk,
            "help": self.help,
        }


def _make_tables(metadata: MetaData) -> _TestTables:
    problem = Table(
        "product_problem",
        metadata,
        Column("id", String, primary_key=True),
        Column("title", String, nullable=False),
        Column("description", String, nullable=False),
        Column("embedding", String, nullable=True),
    )
    solution = Table(
        "product_solution",
        metadata,
        Column("id", String, primary_key=True),
        Column("description", String, nullable=False),
        Column("embedding", String, nullable=True),
    )
    manual = Table(
        "product_manual",
        metadata,
        Column("id", String, primary_key=True),
        Column("product_id", String, nullable=False),
        Column("description", String, nullable=False),
    )
    manual_chunk = Table(
        "product_manual_chunk",
        metadata,
        Column("id", String, primary_key=True),
        Column("product_manual_id", String, nullable=False),
        Column("product_id", String, nullable=False),
        Column("chunk_index", Integer, nullable=False),
        Column("content", String, nullable=False),
        Column("token_count", Integer, nullable=False),
        Column("embedding", JSON, nullable=True),
    )
    help_table = Table(
        "help",
        metadata,
        Column("id", String, primary_key=True),
        Column("description", String, nullable=False),
        Column("embedding", String, nullable=True),
    )
    return _TestTables(problem, solution, manual, manual_chunk, help_table)


@pytest.mark.asyncio
async def test_backfill_embeddings_is_dry_run_capable_and_idempotent(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    db_path = tmp_path / "backfill.sqlite3"
    database_url = f"sqlite+pysqlite:///{db_path}"
    engine = create_engine(
        database_url,
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    metadata = MetaData()
    tables = _make_tables(metadata)
    metadata.create_all(engine)

    with engine.begin() as connection:
        connection.execute(
            tables.product_problem.insert(),
            [
                {
                    "id": "problem-1",
                    "title": "Falha de ingestão",
                    "description": "Ingestão atrasada na rodada do modelo.",
                    "embedding": None,
                },
                {
                    "id": "problem-2",
                    "title": "Falha de execução",
                    "description": "Execução interrompida antes do término.",
                    "embedding": None,
                },
            ],
        )
        connection.execute(
            tables.product_solution.insert(),
            [
                {
                    "id": "solution-1",
                    "description": "Ajustar horário de subida e repetir a rodada.",
                    "embedding": None,
                }
            ],
        )
        connection.execute(
            tables.product_manual.insert(),
            [
                {
                    "id": "manual-1",
                    "product_id": "product-1",
                    "description": "# Manual\n\n" + ("Texto de manual para teste. " * 300),
                }
            ],
        )
        connection.execute(
            tables.help.insert(),
            [
                {
                    "id": "system-help",
                    "description": "H" * 3500,
                    "embedding": None,
                }
            ],
        )

    captured_texts: list[str] = []

    async def _fake_generate_embedding(text_value: str) -> tuple[float, ...]:
        captured_texts.append(text_value)
        return tuple(float(index) / 1000.0 for index in range(768))

    async def _fake_probe(_settings):
        return AiRuntimeProbe(
            provider="ollama",
            model="qwen2.5:1.5b-instruct-q4_K_M",
            mode=RuntimeMode.OLLAMA,
            latency_ms=5,
            checked_at="2026-07-23T15:00:00Z",
            fallback_reason=None,
            embedding_model="nomic-embed-text:v1.5",
            embedding_mode=RuntimeMode.OLLAMA,
            embedding_latency_ms=5,
            chat_digest="chat-digest",
            embedding_digest="embedding-digest",
        )

    def _fake_update_embedding_sql(table_name: str, column_name: str, row_id: str, embedding: tuple[float, ...]):
        table = tables.as_mapping()[table_name]
        return update(table).where(table.c.id == row_id).values(embedding=json.dumps(list(embedding)))

    monkeypatch.setattr(backfill_embeddings, "legacy_tables", tables.as_mapping())
    monkeypatch.setattr(backfill_embeddings, "generate_embedding", _fake_generate_embedding)
    monkeypatch.setattr(backfill_embeddings, "probe_ollama_runtime", _fake_probe)
    monkeypatch.setattr(backfill_embeddings, "update_embedding_sql", _fake_update_embedding_sql)

    settings = load_settings(
        {
            "DATABASE_URL": "postgresql://test-user:test-pass@localhost:5432/silo",
            "OLLAMA_URL": "http://ollama.local:11434",
            "OLLAMA_MODEL": "qwen2.5:1.5b-instruct-q4_K_M",
            "OLLAMA_EMBEDDING_MODEL": "nomic-embed-text:v1.5",
        }
    )

    dry_run_summary = await backfill_embeddings.run_backfill(
        settings,
        database_url=database_url,
        batch_size=1,
        dry_run=True,
        help_char_limit=3000,
    )

    assert dry_run_summary.dry_run is True
    assert dry_run_summary.problems_processed == 2
    assert dry_run_summary.solutions_processed == 1
    assert dry_run_summary.manuals_processed == 1
    assert dry_run_summary.help_processed == 1
    assert dry_run_summary.problems_updated == 0
    assert dry_run_summary.manual_chunks_written == len(
        backfill_embeddings.chunk_markdown("# Manual\n\n" + ("Texto de manual para teste. " * 300))
    )

    with engine.connect() as connection:
        assert (
            connection.execute(
                select(func.count()).select_from(tables.product_manual_chunk)
            ).scalar_one()
            == 0
        )
        assert (
            connection.execute(
                select(tables.product_problem.c.embedding).where(
                    tables.product_problem.c.id == "problem-1"
                )
            ).scalar_one()
            is None
        )

    first_run = await backfill_embeddings.run_backfill(
        settings,
        database_url=database_url,
        batch_size=1,
        sleep_ms=0,
        help_char_limit=3000,
    )

    second_run = await backfill_embeddings.run_backfill(
        settings,
        database_url=database_url,
        batch_size=1,
        sleep_ms=0,
        help_char_limit=3000,
    )

    assert first_run.problems_updated == 2
    assert first_run.solutions_updated == 1
    assert first_run.help_updated == 1
    assert second_run.problems_processed == 0
    assert second_run.solutions_processed == 0

    with engine.connect() as connection:
        problem_embedding = connection.execute(
            select(tables.product_problem.c.embedding).where(
                tables.product_problem.c.id == "problem-1"
            )
        ).scalar_one()
        manual_chunk_count = connection.execute(
            select(func.count()).select_from(tables.product_manual_chunk)
        ).scalar_one()
        help_embedding = connection.execute(
            select(tables.help.c.embedding).where(tables.help.c.id == "system-help")
        ).scalar_one()

    assert problem_embedding is not None
    assert len(json.loads(problem_embedding)) == 768
    assert manual_chunk_count > 0
    assert help_embedding is not None
    assert len(json.loads(help_embedding)) == 768
    assert any(len(text_value) == 3000 for text_value in captured_texts)
