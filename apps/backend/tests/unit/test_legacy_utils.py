from __future__ import annotations

from datetime import date
from uuid import UUID

from silo.services.legacy_utils import (
    is_uuid_like,
    new_uuid,
    normalize_slug,
    normalize_turn_list,
    normalize_whitespace,
    optional_int,
    optional_str,
    parse_date_range_value,
    parse_iso_date,
    required_text,
    safe_int,
    unique_strings,
)


def test_legacy_utils_text_and_numeric_helpers() -> None:
    assert optional_str("hello") == "hello"
    assert optional_str(123) is None
    assert required_text("  hello  ") == "hello"
    assert required_text("   ") is None
    assert required_text(None) is None

    assert optional_int(True) is None
    assert optional_int(7) == 7
    assert optional_int(" 8 ") == 8
    assert optional_int("invalid") is None


def test_legacy_utils_uuid_and_slug_helpers() -> None:
    generated = new_uuid()

    assert UUID(generated) == UUID(generated)
    assert normalize_slug("Hello, World!") == "hello-world"
    assert is_uuid_like(generated) is True
    assert is_uuid_like("not-a-uuid") is False


def test_legacy_utils_collection_and_date_helpers() -> None:
    assert parse_iso_date(date(2026, 7, 22)) == "2026-07-22"
    assert parse_iso_date(" 2026-07-22 ") == "2026-07-22"
    assert parse_iso_date(None) is None

    assert unique_strings(["a", "b", "a", "c", "b"]) == ["a", "b", "c"]
    assert normalize_turn_list(["18", 6, "", None, "18"], ("00", "06")) == ["18", "6"]
    assert safe_int("9") == 9
    assert safe_int(None, default=7) == 7
    assert parse_date_range_value(" 7d ") == "7d"
    assert parse_date_range_value(None) is None
    assert normalize_whitespace("  a\n  b\t c  ") == "a b c"
    assert normalize_whitespace(None) is None
