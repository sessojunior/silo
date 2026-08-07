"""Testes para cobrir branches simples em arquivos near-100%."""

from __future__ import annotations

from silo.api.responses import build_error_payload
from silo.services.legacy_utils import optional_int, parse_iso_date, parse_date_range_value, is_uuid_like


class TestErrorPayload:
    def test_with_reset_flow_true(self) -> None:
        result = build_error_payload("ops", reset_flow=True)
        assert result["success"] is False
        assert result["error"] == "ops"
        assert result["resetFlow"] is True

    def test_with_reset_flow_false(self) -> None:
        result = build_error_payload("ops", reset_flow=False)
        assert result["success"] is False
        assert result["resetFlow"] is False

    def test_with_field(self) -> None:
        result = build_error_payload("ops", field="email")
        assert result["field"] == "email"

    def test_with_retry_after(self) -> None:
        result = build_error_payload("ops", retry_after_seconds=30)
        assert result["retryAfterSeconds"] == 30


class TestLegacyUtils:
    def test_optional_int_empty_string(self) -> None:
        assert optional_int("   ") is None

    def test_optional_int_whitespace(self) -> None:
        assert optional_int("\t\n") is None

    def test_parse_iso_date_empty_string(self) -> None:
        assert parse_iso_date("   ") is None

    def test_parse_iso_date_whitespace(self) -> None:
        assert parse_iso_date("\t\n ") is None

    def test_parse_date_range_empty_string(self) -> None:
        assert parse_date_range_value("   ") is None

    def test_parse_date_range_whitespace(self) -> None:
        assert parse_date_range_value("\t\n ") is None

    def test_is_uuid_valid(self) -> None:
        assert is_uuid_like("550e8400-e29b-41d4-a716-446655440000") is True

    def test_is_uuid_invalid(self) -> None:
        assert is_uuid_like("not-a-uuid") is False

    def test_is_uuid_empty(self) -> None:
        assert is_uuid_like("") is False
