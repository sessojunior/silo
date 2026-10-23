from __future__ import annotations

import pytest

from silo.services import embedding_write


@pytest.mark.asyncio
async def test_upsert_procedure_embedding_persists_embedding_and_provenance(monkeypatch) -> None:
    statements: list[object] = []

    async def fake_embedding(value: str) -> tuple[float, ...]:
        assert value == "Backup\nPasso a passo"
        return (0.25,) * 768

    monkeypatch.setattr(embedding_write, "generate_embedding", fake_embedding)
    monkeypatch.setattr(embedding_write, "_execute_statements", statements.extend)

    result = await embedding_write.upsert_procedure_embedding(
        "procedure-1", "Backup", "Passo a passo"
    )

    assert result.status == "updated"
    assert result.updated_count == 1
    assert "general_procedure" in str(statements[0])
    assert "embedding_content_hash" in str(statements[0])


@pytest.mark.asyncio
async def test_upsert_procedure_attachment_embeddings_replaces_chunks(monkeypatch) -> None:
    statements: list[object] = []

    async def fake_embedding(value: str) -> tuple[float, ...]:
        return (0.5,) * 768 if value else (0.0,) * 768

    monkeypatch.setattr(embedding_write, "generate_embedding", fake_embedding)
    monkeypatch.setattr(embedding_write, "_execute_statements", statements.extend)

    result = await embedding_write.upsert_procedure_attachment_embeddings(
        "attachment-1",
        [
            {
                "id": "chunk-1",
                "content": "Passo um",
                "chunk_index": 0,
                "page_number": 2,
                "slide_number": None,
                "token_count": 2,
            }
        ],
    )

    assert result.status == "updated"
    assert result.updated_count == 1
    assert len(statements) == 2
    assert "general_procedure_attachment_chunk" in str(statements[1])
