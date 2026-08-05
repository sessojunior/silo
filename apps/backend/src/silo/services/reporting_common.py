from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from silo.clock import SYSTEM_CLOCK
from silo.domain.scheduling import SHIFT_CODES

SAO_PAULO_TZ = "America/Sao_Paulo"
REPORT_METRIC_VERSION = "2026-07-23"
REPORT_DEFAULT_RANGE_DAYS = 30
REPORT_MAX_RANGE_DAYS = 366


@dataclass(frozen=True, slots=True)
class DateRange:
    start: str
    end: str


def today_date_text() -> str:
    return SYSTEM_CLOCK.now().astimezone(ZoneInfo(SAO_PAULO_TZ)).date().isoformat()


def parse_date_text(value: object | None, default: str | None = None) -> str | None:
    if isinstance(value, date) and not isinstance(value, datetime):
        return value.isoformat()
    if not isinstance(value, str):
        return default
    text = value.strip()
    if not text:
        return default
    return text


def normalize_date_range_query(
    query: dict[str, object | None],
    *,
    default_days: int = REPORT_DEFAULT_RANGE_DAYS,
) -> DateRange:
    date_range = _optional_text(query.get("dateRange")) or "30d"
    start_date = parse_date_text(query.get("startDate"))
    end_date = parse_date_text(query.get("endDate"), today_date_text())
    if start_date and end_date:
        return DateRange(start=start_date, end=end_date)

    if date_range == "7d":
        days = 7
    elif date_range == "90d":
        days = 90
    elif date_range == "custom":
        days = default_days
    else:
        days = default_days

    end_dt = datetime.fromisoformat(end_date or today_date_text())
    start_dt = end_dt - timedelta(days=max(1, days) - 1)
    return DateRange(start=start_dt.date().isoformat(), end=end_dt.date().isoformat())


def expand_date_range_text(date_range: DateRange) -> tuple[str, str]:
    return date_range.start, date_range.end


def get_shift_codes(value: object | None) -> list[str]:
    if not isinstance(value, list):
        return list(SHIFT_CODES)

    result: list[str] = []
    for item in value:
        if isinstance(item, str):
            candidate = item.strip()
        elif isinstance(item, int):
            candidate = str(item)
        else:
            continue
        if candidate in SHIFT_CODES and candidate not in result:
            result.append(candidate)
    return result or list(SHIFT_CODES)


def clamp_int(value: int, minimum: int, maximum: int) -> int:
    return max(minimum, min(maximum, value))


def _optional_text(value: object | None) -> str | None:
    if isinstance(value, str):
        text = value.strip()
        return text or None
    return None
