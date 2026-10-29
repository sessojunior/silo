from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    MetaData,
    String,
    Table,
    create_engine,
    update,
)

from silo.ai import assistant_service, assistant_tools
from silo.ai.procedure_knowledge import prioritize_knowledge_candidates


def test_attachment_is_prioritized_over_body_of_same_procedure() -> None:
    ranked = prioritize_knowledge_candidates(
        [
            {
                "id": "body-1",
                "source": "procedure",
                "baseSimilarity": 0.80,
                "similarity": 0.80,
                "content": "Texto resumido do procedimento",
            },
            {
                "id": "attachment-1",
                "source": "procedure_attachment",
                "baseSimilarity": 0.80,
                "similarity": 0.80,
                "content": "Passos detalhados do PDF",
                "attachmentName": "manual-operacao.pdf",
                "pageNumber": 4,
            },
        ]
    )

    assert [item["id"] for item in ranked] == ["attachment-1", "body-1"]
    assert ranked[0]["priorityBoost"] > ranked[1]["priorityBoost"]
    assert ranked[0]["pageNumber"] == 4


def test_inactive_or_failed_procedure_sources_are_not_returned() -> None:
    ranked = prioritize_knowledge_candidates(
        [
            {
                "id": "inactive",
                "source": "procedure",
                "active": False,
                "similarity": 0.99,
                "baseSimilarity": 0.99,
                "content": "Não deve aparecer",
            },
            {
                "id": "failed",
                "source": "procedure_attachment",
                "extractionStatus": "error",
                "similarity": 0.99,
                "baseSimilarity": 0.99,
                "content": "Não deve aparecer",
            },
            {
                "id": "ready",
                "source": "procedure_attachment",
                "extractionStatus": "ready",
                "similarity": 0.60,
                "baseSimilarity": 0.60,
                "content": "Pode aparecer",
            },
        ]
    )

    assert [item["id"] for item in ranked] == ["ready"]


def test_knowledge_search_returns_procedure_attachment_before_body(monkeypatch) -> None:
    monkeypatch.setattr(
        assistant_tools,
        "_generate_query_embedding_for_search",
        lambda query: (0.0,) * 768,
    )
    monkeypatch.setattr(
        assistant_tools, "_search_pgvector_candidates", lambda *args, **kwargs: None
    )
    monkeypatch.setattr(
        assistant_tools,
        "_search_knowledge_lexical_fallback",
        lambda *args, **kwargs: [
            {
                "id": "body-1",
                "source": "procedure",
                "content": "Texto do procedimento",
                "similarity": 0.8,
                "baseSimilarity": 0.8,
                "contentSimilarity": 0.8,
                "vectorSimilarity": 0.0,
            },
            {
                "id": "attachment-1",
                "source": "procedure_attachment",
                "content": "Detalhes do PDF",
                "similarity": 0.8,
                "baseSimilarity": 0.8,
                "contentSimilarity": 0.8,
                "vectorSimilarity": 0.0,
                "attachmentName": "operacao.pdf",
                "pageNumber": 3,
            },
        ],
    )

    result = assistant_tools.search_silo_knowledge(object(), query="como resolver", limit=5)

    assert [item["id"] for item in result["items"]] == ["attachment-1", "body-1"]
    assert result["items"][0]["attachmentName"] == "operacao.pdf"


def test_authorized_procedure_citation_keeps_attachment_location() -> None:
    authorized = assistant_service._authorized_knowledge_item(
        "models",
        {
            "source": "procedure_attachment",
            "id": "chunk-1",
            "content": "Passo detalhado",
            "similarity": 0.9,
            "attachmentName": "operacao.pdf",
            "pageNumber": 3,
            "procedureTitle": "Reiniciar serviço",
        },
    )

    assert authorized is not None
    assert authorized["attachmentName"] == "operacao.pdf"
    assert authorized["pageNumber"] == 3


def test_procedure_attachment_follows_parent_ai_availability(monkeypatch) -> None:
    metadata = MetaData()
    tables = {
        "help": Table(
            "help",
            metadata,
            Column("id", String, primary_key=True),
            Column("description", String),
            Column("embedding", JSON),
            Column("created_at", DateTime),
            Column("updated_at", DateTime),
        ),
        "product_manual_chunk": Table(
            "product_manual_chunk",
            metadata,
            Column("id", String, primary_key=True),
            Column("content", String),
            Column("product_id", String),
            Column("embedding", JSON),
            Column("created_at", DateTime),
            Column("updated_at", DateTime),
        ),
        "product": Table(
            "product",
            metadata,
            Column("id", String, primary_key=True),
            Column("name", String),
        ),
        "product_problem": Table(
            "product_problem",
            metadata,
            Column("id", String, primary_key=True),
            Column("product_id", String),
            Column("title", String),
            Column("description", String),
            Column("embedding", JSON),
            Column("created_at", DateTime),
            Column("updated_at", DateTime),
        ),
        "product_solution": Table(
            "product_solution",
            metadata,
            Column("id", String, primary_key=True),
            Column("description", String),
            Column("embedding", JSON),
            Column("created_at", DateTime),
            Column("updated_at", DateTime),
        ),
        "general_procedure": Table(
            "general_procedure",
            metadata,
            Column("id", String, primary_key=True),
            Column("title", String),
            Column("category", String),
            Column("content", String),
            Column("active", Boolean),
            Column("embedding", JSON),
            Column("created_at", DateTime),
            Column("updated_at", DateTime),
        ),
        "general_procedure_attachment": Table(
            "general_procedure_attachment",
            metadata,
            Column("id", String, primary_key=True),
            Column("procedure_id", String),
            Column("original_name", String),
            Column("extraction_status", String),
        ),
        "general_procedure_attachment_chunk": Table(
            "general_procedure_attachment_chunk",
            metadata,
            Column("id", String, primary_key=True),
            Column("attachment_id", String),
            Column("content", String),
            Column("page_number", String),
            Column("slide_number", String),
            Column("embedding", JSON),
            Column("created_at", DateTime),
            Column("updated_at", DateTime),
        ),
    }
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    metadata.create_all(engine)
    monkeypatch.setattr(assistant_tools, "legacy_tables", tables)
    monkeypatch.setattr(assistant_tools, "_generate_query_embedding_for_search", lambda query: ())
    monkeypatch.setattr(
        assistant_tools, "_search_pgvector_candidates", lambda *args, **kwargs: None
    )
    timestamp = datetime(2026, 10, 28, 12, 0)

    with engine.begin() as connection:
        connection.execute(
            tables["general_procedure"].insert(),
            {
                "id": "procedure-1",
                "title": "Reinício de serviço",
                "category": "infraestrutura",
                "content": "Procedimento de reinício.",
                "active": True,
                "created_at": timestamp,
                "updated_at": timestamp,
            },
        )
        connection.execute(
            tables["general_procedure_attachment"].insert(),
            {
                "id": "attachment-1",
                "procedure_id": "procedure-1",
                "original_name": "passos.txt",
                "extraction_status": "ready",
            },
        )
        connection.execute(
            tables["general_procedure_attachment_chunk"].insert(),
            {
                "id": "chunk-1",
                "attachment_id": "attachment-1",
                "content": "Pare o serviço, valide os logs e reinicie o serviço.",
                "page_number": "1",
                "created_at": timestamp,
                "updated_at": timestamp,
            },
        )

        enabled = assistant_tools.search_silo_knowledge(
            connection,
            query="como reiniciar o serviço e validar os logs",
            limit=5,
        )
        assert any(item["id"] == "chunk-1" for item in enabled["items"])

        connection.execute(
            update(tables["general_procedure"])
            .where(tables["general_procedure"].c.id == "procedure-1")
            .values(active=False)
        )
        disabled = assistant_tools.search_silo_knowledge(
            connection,
            query="como reiniciar o serviço e validar os logs",
            limit=5,
        )
        assert all(item["id"] != "chunk-1" for item in disabled["items"])
