from __future__ import annotations

from datetime import UTC
from datetime import datetime as real_datetime

from silo import date as date_module


class _FixedDateTime(real_datetime):
    @classmethod
    def now(cls, tz=None):  # type: ignore[override]
        if tz is None:
            return cls(2026, 7, 22, 15, 30, 45)
        return cls(2026, 7, 22, 15, 30, 45, tzinfo=tz)


def test_date_helpers_cover_fixed_today_and_formatting(monkeypatch) -> None:
    monkeypatch.setattr(date_module, "datetime", _FixedDateTime)

    assert date_module.get_today_date().isoformat() == "2026-07-22T15:30:45-03:00"
    assert date_module.get_today() == "2026-07-22"
    assert date_module.get_days_ago(2) == "2026-07-20"
    assert date_module.get_months_ago(1) == "2026-06-01"
    assert date_module.is_today("2026-07-22") is True
    assert date_module.is_today("2026-07-21") is False
    assert date_module.get_now_timestamp() == "07/22/2026, 03:30:45 PM"
    assert date_module.utc_now() == real_datetime(2026, 7, 22, 15, 30, 45, tzinfo=UTC)


def test_date_helpers_parse_and_format_values(monkeypatch) -> None:
    monkeypatch.setattr(date_module, "datetime", _FixedDateTime)

    assert date_module.parse_date("2026-07-22") == real_datetime(2026, 7, 22).date()
    assert date_module.format_date("2026-07-22") == "2026-07-22"
    assert date_module.format_date(_FixedDateTime(2026, 7, 22, 12, 0)) == "2026-07-22"
    assert date_module.format_date(_FixedDateTime(2026, 7, 22, 15, 0, tzinfo=UTC)) == "2026-07-22"
    assert date_module.format_date_br("2026-07-22") == "22/07/2026"
    assert date_module.format_date_time_br("2026-07-22", "15:45") == "22/07/2026 15:45"
    assert date_module.format_date_time_full_br("2026-07-22T15:45:00Z") == "22/07/2026 12:45:00"
    assert date_module.format_date_time_short_br("2026-07-22T15:45:00Z") == "22/07/2026 12:45"
    assert date_module.format_date_time_full_br("") == "Data inválida"
    assert date_module.format_date_time_short_br("") == "Data inválida"
    assert date_module._parse_datetime_string("2026-07-22T15:45:00Z") == real_datetime(2026, 7, 22, 15, 45, tzinfo=UTC)  # noqa: SLF001
    assert date_module._is_date_string("2026-07-22") is True  # noqa: SLF001
    assert date_module._is_date_string("2026-07-22T15:45:00") is False  # noqa: SLF001
