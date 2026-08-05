from __future__ import annotations

from collections.abc import Callable, Mapping
from datetime import date, datetime
from zoneinfo import ZoneInfo
from typing import TypeVar

from sqlalchemy import text
from sqlalchemy.engine import Connection

from silo.domain.model_run_status import PROBLEM_STATUSES, normalize_model_run_status
from silo.domain.scheduling import SHIFT_CODES
from silo.services.legacy_utils import normalize_turn_list

ANALYTICS_TIMEZONE = ZoneInfo("America/Sao_Paulo")
ANALYTICS_METRIC_VERSION = "2026-07-23"
T = TypeVar("T")

INCIDENT_STATUSES = frozenset(PROBLEM_STATUSES)


def is_incident_status(value: object | None) -> bool:
    return normalize_model_run_status(value) in INCIDENT_STATUSES


def normalize_shift_turns(value: object | None) -> list[str]:
    return normalize_turn_list(value, SHIFT_CODES)


def run_repeatable_read_snapshot(
    connection: Connection,
    callback: Callable[[], T],
    *,
    statement_timeout_ms: int = 5_000,
) -> T:
    transaction = connection.begin()
    try:
        connection.execute(text("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY"))
        timeout_ms = max(1, int(statement_timeout_ms))
        connection.execute(text(f"SET LOCAL statement_timeout = '{timeout_ms}ms'"))
        result = callback()
        transaction.rollback()
        return result
    except BaseException:
        transaction.rollback()
        raise


def build_analytics_meta(
    *,
    source_kind: str,
    range_start: str | None,
    range_end: str | None,
    denominator: str | None,
    rounding: int | str | Mapping[str, object] | None,
    complete: bool = True,
    extra: Mapping[str, object] | None = None,
) -> dict[str, object]:
    meta: dict[str, object] = {
        "metricVersion": ANALYTICS_METRIC_VERSION,
        "timezone": str(ANALYTICS_TIMEZONE),
        "sourceKind": source_kind,
        "complete": complete,
        "rounding": rounding,
        "snapshotIsolation": "repeatable_read",
        "snapshotReadOnly": True,
    }
    if range_start is not None or range_end is not None:
        meta["range"] = {
            "start": range_start,
            "end": range_end,
            "inclusive": True,
        }
    if denominator is not None:
        meta["denominator"] = denominator
    if extra is not None:
        meta.update(extra)
    return meta


def format_local_date_text(value: date | datetime | str | None) -> str | None:
    parsed = _parse_datetime_like(value)
    if parsed is not None:
        localized = parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=ANALYTICS_TIMEZONE)
        return localized.astimezone(ANALYTICS_TIMEZONE).date().isoformat()

    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, str):
        text = value.strip()
        return text or None
    return None


def format_local_datetime_text(value: datetime | str | None) -> str | None:
    parsed = _parse_datetime_like(value)
    if parsed is None:
        if isinstance(value, str):
            text = value.strip()
            return text or None
        return None

    localized = parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=ANALYTICS_TIMEZONE)
    localized = localized.astimezone(ANALYTICS_TIMEZONE)
    return localized.strftime("%Y-%m-%d %H:%M:%S")


def format_br_day_short(value: date | datetime | str | None) -> str:
    parsed = _parse_datetime_like(value)
    if parsed is not None:
        localized = parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=ANALYTICS_TIMEZONE)
        return localized.astimezone(ANALYTICS_TIMEZONE).strftime("%d/%m/")

    if isinstance(value, date):
        return value.strftime("%d/%m/")
    if isinstance(value, str):
        text = value.strip()
        if len(text) >= 10 and text[4:5] == "-" and text[7:8] == "-":
            try:
                return datetime.fromisoformat(text[:10]).strftime("%d/%m/")
            except ValueError:
                return text
        return text
    return ""


def _parse_datetime_like(value: date | datetime | str | None) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day)
    if not isinstance(value, str):
        return None

    text = value.strip()
    if not text:
        return None

    if len(text) == 10 and text[4:5] == "-" and text[7:8] == "-":
        try:
            return datetime.fromisoformat(text)
        except ValueError:
            return None

    normalized = text.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        return None
