from __future__ import annotations

from types import SimpleNamespace

import pytest

from silo.services import embedding_write


async def _fake_embedding(_text: str) -> tuple[float, ...]:
    return tuple(0.25 for _ in range(768))


@pytest.mark.asyncio
async def test_embedding_write_covers_success_paths(monkeypatch: pytest.MonkeyPatch) -> None:
    executed_single: list[object] = []
    executed_many: list[list[object]] = []

    async def fake_generate_embedding(text: str) -> tuple[float, ...]:
        return await _fake_embedding(text)

    monkeypatch.setattr(embedding_write, "generate_embedding", fake_generate_embedding)
    monkeypatch.setattr(
        embedding_write,
        "_execute_statement",
        lambda statement: executed_single.append(statement),
    )
    monkeypatch.setattr(
        embedding_write,
        "_execute_statements",
        lambda statements: executed_many.append(list(statements)),
    )
    monkeypatch.setattr(
        embedding_write,
        "chunk_markdown",
        lambda markdown: [
            SimpleNamespace(content="chunk 1", token_count=2, index=0),
            SimpleNamespace(content="chunk 2", token_count=3, index=1),
        ],
    )

    await embedding_write.upsert_help_embedding("   ")
    assert executed_single == []

    await embedding_write.upsert_problem_embedding("problem-1", "Titulo", "Descricao")
    await embedding_write.upsert_solution_embedding("solution-1", "Descricao da solucao")
    await embedding_write.upsert_help_embedding("Descricao da ajuda")
    await embedding_write.upsert_manual_chunks("manual-1", "product-1", "# Manual")

    assert [statement.table.name for statement in executed_single] == [
        "product_problem",
        "product_solution",
        "help",
    ]
    assert len(executed_many) == 1
    assert [statement.table.name for statement in executed_many[0]] == [
        "product_manual_chunk",
        "product_manual_chunk",
        "product_manual_chunk",
    ]


@pytest.mark.asyncio
async def test_embedding_write_swallow_errors_without_raising(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_generate_embedding(_text: str) -> tuple[float, ...]:
        raise RuntimeError("boom")

    monkeypatch.setattr(embedding_write, "generate_embedding", fake_generate_embedding)
    monkeypatch.setattr(embedding_write, "_execute_statement", lambda statement: None)
    monkeypatch.setattr(embedding_write, "_execute_statements", lambda statements: None)
    monkeypatch.setattr(
        embedding_write,
        "chunk_markdown",
        lambda markdown: (_ for _ in ()).throw(RuntimeError("chunk boom")),
    )

    await embedding_write.upsert_problem_embedding("problem-1", "Titulo", "Descricao")
    await embedding_write.upsert_solution_embedding("solution-1", "Descricao")
    await embedding_write.upsert_help_embedding("Descricao")
    await embedding_write.upsert_manual_chunks("manual-1", "product-1", "# Manual")

