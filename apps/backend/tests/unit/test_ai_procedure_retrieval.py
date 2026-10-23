from __future__ import annotations

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
