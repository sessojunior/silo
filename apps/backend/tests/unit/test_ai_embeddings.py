from __future__ import annotations

from dataclasses import dataclass

import pytest

from silo.ai import embeddings


@dataclass
class _FakeEmbeddingProvider:
    vectors: list[tuple[float, ...]]
    calls: list[str]

    async def embed(self, text: str) -> tuple[float, ...]:
        self.calls.append(text)
        return self.vectors[len(self.calls) - 1]


@pytest.mark.asyncio
async def test_embedding_helpers_cover_cache_similarity_and_sql(monkeypatch: pytest.MonkeyPatch) -> None:
    provider = _FakeEmbeddingProvider(
        vectors=[
            tuple(0.25 for _ in range(768)),
            tuple(0.5 for _ in range(768)),
        ],
        calls=[],
    )
    embeddings.set_embedding_provider_for_test(provider)
    try:
        assert embeddings.cosine_similarity([1.0, 0.0], [1.0, 0.0]) == 1.0
        assert embeddings.cosine_similarity([], []) == 0.0
        assert embeddings.cosine_similarity([1.0], [1.0, 2.0]) == 0.0

        assert embeddings.to_vector_literal((1.0, 2.0)) == "ARRAY[1.0::float8,2.0::float8]::vector"

        statement = embeddings.update_embedding_sql(
            "product_problem",
            "embedding",
            "row-1",
            (1.0, 2.0),
        )
        compiled = str(statement)
        assert "product_problem" in compiled
        assert "embedding" in compiled

        first = await embeddings.generate_embedding("  texto  ")
        second = await embeddings.generate_embedding("texto")
        empty = await embeddings.generate_embedding("   ")

        assert first == second == tuple(0.25 for _ in range(768))
        assert empty == tuple(0.0 for _ in range(768))
        assert provider.calls == ["texto"]

        embeddings.set_embedding_provider_for_test(None)
        monkeypatch.setattr(
            embeddings,
            "load_settings",
            lambda: type("Settings", (), {"ai_runtime_mode": "ollama", "ollama": object(), "vllm": object()})(),
        )

        class _FakeRuntime:
            def __init__(self, _settings) -> None:
                self.settings = _settings

        monkeypatch.setattr(embeddings, "create_embedding_runtime", _FakeRuntime)
        provider_instance = embeddings.get_embedding_provider()
        assert isinstance(provider_instance, _FakeRuntime)
    finally:
        embeddings.set_embedding_provider_for_test(None)


def test_embedding_identifier_validation_rejects_bad_names() -> None:
    assert embeddings._validate_identifier("table_name") == "table_name"  # noqa: SLF001

    with pytest.raises(ValueError, match="Identificador SQL inv\\u00e1lido"):
        embeddings._validate_identifier("1bad")  # noqa: SLF001

    with pytest.raises(ValueError, match="Identificador SQL inv\\u00e1lido"):
        embeddings._validate_identifier("bad-name")  # noqa: SLF001
