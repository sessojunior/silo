"""Testes para branches nao cobertos em analytics_common.py."""

from __future__ import annotations

from datetime import date, datetime, timezone

from silo.services.analytics_common import (
    _parse_datetime_like,
    build_analytics_meta,
    format_br_day_short,
    format_local_date_text,
    format_local_datetime_text,
)


class TestParseDatetimeLike:
    def test_parses_datetime(self) -> None:
        dt = datetime(2026, 7, 15, 12, 0, 0, tzinfo=timezone.utc)
        assert _parse_datetime_like(dt) == dt

    def test_parses_date_converts_to_datetime(self) -> None:
        d = date(2026, 7, 15)
        result = _parse_datetime_like(d)
        assert isinstance(result, datetime)
        assert result.year == 2026

    def test_returns_none_for_int(self) -> None:
        assert _parse_datetime_like(42) is None

    def test_returns_none_for_bool(self) -> None:
        assert _parse_datetime_like(True) is None

    def test_returns_none_for_none(self) -> None:
        assert _parse_datetime_like(None) is None

    def test_returns_none_for_list(self) -> None:
        assert _parse_datetime_like([]) is None

    def test_returns_none_for_empty_string(self) -> None:
        assert _parse_datetime_like("") is None

    def test_returns_none_for_whitespace_string(self) -> None:
        assert _parse_datetime_like("   ") is None

    def test_returns_none_for_invalid_date_string(self) -> None:
        assert _parse_datetime_like("2026-99-99") is None

    def test_returns_none_for_garbage_string(self) -> None:
        assert _parse_datetime_like("not-a-date-at-all") is None

    def test_returns_none_for_invalid_iso_string(self) -> None:
        assert _parse_datetime_like("2026-07-15T99:99:99-invalid") is None


class TestFormatBrDayShort:
    def test_formats_datetime(self) -> None:
        dt = datetime(2026, 7, 15, 12, 0, 0)
        result = format_br_day_short(dt)
        assert "15" in result

    def test_formats_date(self) -> None:
        d = date(2026, 7, 15)
        result = format_br_day_short(d)
        assert "15" in result

    def test_returns_text_for_non_parseable_string(self) -> None:
        assert format_br_day_short("hello") == "hello"

    def test_returns_empty_for_none(self) -> None:
        assert format_br_day_short(None) == ""

    def test_invalid_date_format_returns_text(self) -> None:
        assert format_br_day_short("2026-99-99abcdef") is not None


class TestFormatLocalDateText:
    def test_formats_datetime(self) -> None:
        result = format_local_date_text(datetime(2026, 7, 15, 12, 0))
        assert result is not None

    def test_formats_date(self) -> None:
        result = format_local_date_text(date(2026, 7, 15))
        assert result is not None

    def test_formats_string(self) -> None:
        result = format_local_date_text("2026-07-15")
        assert result is not None

    def test_returns_none_for_empty_string(self) -> None:
        assert format_local_date_text("") is None

    def test_returns_none_for_whitespace(self) -> None:
        assert format_local_date_text("   ") is None

    def test_returns_none_for_none(self) -> None:
        assert format_local_date_text(None) is None


class TestFormatLocalDatetimeText:
    def test_formats_datetime(self) -> None:
        result = format_local_datetime_text(datetime(2026, 7, 15, 12, 0))
        assert result is not None

    def test_formats_string(self) -> None:
        result = format_local_datetime_text("2026-07-15T12:00:00")
        assert result is not None

    def test_returns_none_for_whitespace(self) -> None:
        assert format_local_datetime_text("   ") is None

    def test_returns_none_for_none(self) -> None:
        assert format_local_datetime_text(None) is None


class TestBuildAnalyticsMeta:
    def test_without_range(self) -> None:
        result = build_analytics_meta(
            source_kind="test",
            range_start=None,
            range_end=None,
            denominator=None,
            rounding=None,
        )
        assert "range" not in result

    def test_without_denominator(self) -> None:
        result = build_analytics_meta(
            source_kind="test",
            range_start=None,
            range_end=None,
            denominator=None,
            rounding=None,
        )
        assert "denominator" not in result

    def test_without_extra(self) -> None:
        result = build_analytics_meta(
            source_kind="test",
            range_start=None,
            range_end=None,
            denominator=None,
            rounding=None,
            extra=None,
        )
        assert result["sourceKind"] == "test"

    def test_all_optional_none(self) -> None:
        result = build_analytics_meta(
            source_kind="test",
            range_start=None,
            range_end=None,
            denominator=None,
            rounding=None,
            complete=False,
            extra=None,
        )
        assert result["sourceKind"] == "test"
        assert result["complete"] is False
        assert "range" not in result
        assert "denominator" not in result
