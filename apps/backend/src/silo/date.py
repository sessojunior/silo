from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

TIMEZONE = ZoneInfo("America/Sao_Paulo")
LOCALE = "pt-BR"


def get_today_date() -> datetime:
    return datetime.now(TIMEZONE)


def get_today() -> str:
    return format_date(get_today_date())


def parse_date(date_string: str) -> date:
    year, month, day = (int(part) for part in date_string.split("-"))
    return date(year, month, day)


def format_date(value: date | datetime | str) -> str:
    if isinstance(value, str):
        if _is_date_string(value):
            return value
        parsed = _parse_datetime_string(value)
        return parsed.astimezone(TIMEZONE).date().isoformat()

    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.date().isoformat()
        return value.astimezone(TIMEZONE).date().isoformat()

    return value.isoformat()


def get_days_ago(days: int) -> str:
    return format_date(get_today_date() - timedelta(days=days))


def get_months_ago(months: int) -> str:
    today = get_today_date()
    year = today.year
    month = today.month - months
    while month <= 0:
        month += 12
        year -= 1
    return date(year, month, 1).isoformat()


def is_today(value: str) -> bool:
    return value == get_today()


def get_now_timestamp() -> str:
    return datetime.now(TIMEZONE).strftime("%m/%d/%Y, %I:%M:%S %p")


def format_date_br(date_string: str) -> str:
    parsed = parse_date(date_string)
    return parsed.strftime("%d/%m/%Y")


def format_date_time_br(date_string: str, time_string: str | None = None) -> str:
    parsed_date = parse_date(date_string)
    parsed = datetime(parsed_date.year, parsed_date.month, parsed_date.day)
    if time_string:
        hours, minutes = time_string.split(":", maxsplit=1)
        parsed = parsed.replace(hour=int(hours), minute=int(minutes))
    return parsed.strftime("%d/%m/%Y %H:%M")


def format_date_time_full_br(date_string: str) -> str:
    if not date_string:
        return "Data inválida"

    parsed = _parse_datetime_string(date_string)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=TIMEZONE)

    return parsed.astimezone(TIMEZONE).strftime("%d/%m/%Y %H:%M:%S")


def format_date_time_short_br(date_string: str) -> str:
    if not date_string:
        return "Data inválida"

    parsed = _parse_datetime_string(date_string)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=TIMEZONE)

    return parsed.astimezone(TIMEZONE).strftime("%d/%m/%Y %H:%M")


def utc_now() -> datetime:
    return datetime.now(UTC)


def _parse_datetime_string(value: str) -> datetime:
    normalized = value.replace("Z", "+00:00")
    return datetime.fromisoformat(normalized)


def _is_date_string(value: str) -> bool:
    return len(value) == 10 and value[4] == "-" and value[7] == "-"
