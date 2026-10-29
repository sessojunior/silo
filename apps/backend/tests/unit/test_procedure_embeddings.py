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
    assert "attachment_id" in str(statements[0])
    assert "attachment-1" in str(statements[0].compile().params.values())


@pytest.mark.asyncio
async def test_upsert_procedure_attachment_embeddings_preserves_chunk_when_embedding_fails(
    monkeypatch,
) -> None:
    statements: list[object] = []

    async def fake_embedding(value: str) -> tuple[float, ...]:
        if value == "Passo com falha":
            raise RuntimeError("embedding indisponível")
        return (0.5,) * 768

    monkeypatch.setattr(embedding_write, "generate_embedding", fake_embedding)
    monkeypatch.setattr(embedding_write, "_execute_statements", statements.extend)

    result = await embedding_write.upsert_procedure_attachment_embeddings(
        "attachment-1",
        [
            {
                "id": "chunk-ok",
                "content": "Passo indexado",
                "chunk_index": 0,
                "page_number": 1,
                "slide_number": None,
                "token_count": 2,
            },
            {
                "id": "chunk-failed",
                "content": "Passo com falha",
                "chunk_index": 1,
                "page_number": 2,
                "slide_number": None,
                "token_count": 3,
            },
        ],
    )

    assert result.status == "partial"
    assert result.updated_count == 1
    assert result.failed_count == 1
    assert len(statements) == 3
    assert statements[2].compile().params["id"] == "chunk-failed"
    assert statements[2].compile().params["content"] == "Passo com falha"
