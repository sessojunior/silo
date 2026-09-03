from __future__ import annotations

from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine

from silo.ai import assistant_service
from silo.ai.assistant_registry import (
    MAX_TOTAL_REGISTRY_BYTES,
    DatasetRegistry,
    DatasetRegistryError,
)


class _StructuredSynthesisRuntime:
    def __init__(self, response: str) -> None:
        self.response = response

    async def complete_with_metadata(self, _messages):
        return SimpleNamespace(content=self.response), SimpleNamespace(
            prompt_eval_count=12,
            output_token_count=8,
            latency_ms=1,
        )


def _fake_runtime_context(connection, *, model_runtime) -> SimpleNamespace:
    return SimpleNamespace(
        connection=connection,
        settings=SimpleNamespace(
            vllm=SimpleNamespace(
                model="mistral",
                embedding_model="nomic-embed-text:v1.5",
                timeout_ms=30_000,
                max_concurrent_requests=1,
            )
        ),
        model_runtime=model_runtime,
        embedding_provider=SimpleNamespace(),
    )


def test_dataset_registry_rejects_total_size_limit() -> None:
    registry = DatasetRegistry()
    registry._total_bytes = MAX_TOTAL_REGISTRY_BYTES - 1

    with pytest.raises(DatasetRegistryError) as exc_info:
        registry.register(
            "dataset-teste",
            {"value": "x"},
            schema_id="report.v1",
            source_kind="report",
        )

    assert exc_info.value.code == "DATASET_REGISTRY_TOO_LARGE"


def test_dataset_registry_project_missing_raises() -> None:
    registry = DatasetRegistry()

    with pytest.raises(DatasetRegistryError) as exc_info:
        registry.project(
            "dataset-ausente",
            lambda data: data,
            name="dataset-projetado",
            schema_id="report.v1",
            source_kind="report",
        )

    assert exc_info.value.code == "DATASET_NOT_FOUND"


@pytest.mark.asyncio
async def test_synthesize_once_rejects_malformed_structured_output() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    with engine.connect() as connection:
        runtime_context = _fake_runtime_context(
            connection,
            model_runtime=_StructuredSynthesisRuntime(response="not-json-at-all"),
        )
        runtime = SimpleNamespace(context=runtime_context)
        state = {
            "question": "Pergunta de teste",
            "scope": "general",
            "required_results": {},
            "supplemental_results": {},
            "response_base": "Resumo base preservado",
            "answer": "",
            "progress": [],
            "final_response": {},
            "ranges": {"start": "2026-07-01", "end": "2026-07-23"},
            "citations": [],
            "suggested_questions": [],
            "artifact_result": {},
            "visualization": {},
            "synthesis_context_summary": "",
            "prompt_eval_count": 0,
        }

        await assistant_service._node_synthesize_once(state, runtime)

    assert "formato inválido" in state["answer"]
    assert state["generation"]["status"] == "error"
