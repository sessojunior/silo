from __future__ import annotations

from collections import OrderedDict
from typing import Final

from sqlalchemy import text

from silo.ai.assistant_runtime import create_embedding_runtime
from silo.ai.ports import EmbeddingPort
from silo.config import load_settings

_EMBEDDING_CACHE_MAX_SIZE: Final[int] = 256
_embedding_cache: OrderedDict[str, tuple[float, ...]] = OrderedDict()
_embedding_provider: EmbeddingPort | None = None


async def generate_embedding(text_value: str) -> tuple[float, ...]:
    key = text_value.strip()
    if not key:
        return tuple(0.0 for _ in range(768))

    cached = _embedding_cache.get(key)
    if cached is not None:
        _embedding_cache.move_to_end(key)
        return cached

    provider = get_embedding_provider()
    vector = await provider.embed(key)
    _embedding_cache[key] = vector
    _embedding_cache.move_to_end(key)
    while len(_embedding_cache) > _EMBEDDING_CACHE_MAX_SIZE:
        _embedding_cache.popitem(last=False)
    return vector


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if len(left) != len(right) or not left:
        return 0.0

    dot = 0.0
    norm_left = 0.0
    norm_right = 0.0
    for left_value, right_value in zip(left, right, strict=True):
        dot += left_value * right_value
        norm_left += left_value * left_value
        norm_right += right_value * right_value

    magnitude = (norm_left ** 0.5) * (norm_right ** 0.5)
    if magnitude == 0:
        return 0.0
    return dot / magnitude


def to_vector_literal(embedding: tuple[float, ...] | list[float]) -> str:
    values = ",".join(f"{float(value)}::float8" for value in embedding)
    return f"ARRAY[{values}]::vector"


def update_embedding_sql(
    table_name: str,
    column_name: str,
    row_id: str,
    embedding: tuple[float, ...] | list[float],
) -> object:
    safe_table_name = _validate_identifier(table_name)
    safe_column_name = _validate_identifier(column_name)
    statement = text(
        f"UPDATE {safe_table_name} "
        f"SET {safe_column_name} = :embedding "
        f"WHERE id = :row_id"
    )
    return statement.bindparams(row_id=row_id, embedding=list(embedding))


def get_embedding_provider() -> EmbeddingPort:
    global _embedding_provider
    if _embedding_provider is None:
        _embedding_provider = create_embedding_runtime(load_settings())
    return _embedding_provider


def set_embedding_provider_for_test(provider: EmbeddingPort | None) -> None:
    global _embedding_provider
    _embedding_provider = provider
    _embedding_cache.clear()


def _validate_identifier(value: str) -> str:
    if not value or not value.replace("_", "").isalnum() or value[0].isdigit():
        raise ValueError(f"Identificador SQL inválido: {value!r}")
    return value
