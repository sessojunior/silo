from __future__ import annotations

import pytest
from pydantic import ValidationError

from silo.api.schemas import CamelModel, FlexibleCamelModel, to_camel


class StrictPayload(CamelModel):
    created_at: str
    retry_after_seconds: int


class FlexiblePayload(FlexibleCamelModel):
    created_at: str


def test_camel_model_accepts_and_serializes_camel_case_aliases() -> None:
    payload = StrictPayload.model_validate(
        {"createdAt": "2026-07-22T12:00:00.000Z", "retryAfterSeconds": 30}
    )

    assert payload.created_at == "2026-07-22T12:00:00.000Z"
    assert payload.model_dump() == {
        "createdAt": "2026-07-22T12:00:00.000Z",
        "retryAfterSeconds": 30,
    }


def test_strict_camel_model_forbids_unexpected_contract_fields() -> None:
    with pytest.raises(ValidationError):
        StrictPayload.model_validate(
            {
                "createdAt": "2026-07-22T12:00:00.000Z",
                "retryAfterSeconds": 30,
                "unexpectedField": True,
            }
        )


def test_flexible_camel_model_allows_legacy_extra_fields_when_needed() -> None:
    payload = FlexiblePayload.model_validate(
        {"createdAt": "2026-07-22T12:00:00.000Z", "legacyField": "kept"}
    )

    assert payload.model_dump() == {
        "createdAt": "2026-07-22T12:00:00.000Z",
        "legacyField": "kept",
    }


def test_to_camel_is_deterministic_for_contract_generation() -> None:
    assert to_camel("retry_after_seconds") == "retryAfterSeconds"
    assert to_camel("id") == "id"
