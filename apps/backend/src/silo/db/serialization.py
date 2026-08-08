from __future__ import annotations

import uuid
from collections.abc import Mapping, Sequence
from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

LEGACY_OPERATIONAL_TIMEZONE = "America/Sao_Paulo"
LEGACY_TIMESTAMP_MILLISECONDS = 3


def serialize_legacy_date(value: date) -> str:
    if isinstance(value, datetime):
        raise TypeError("serialize_legacy_date expects date without time component")
    return value.isoformat()


def serialize_legacy_timestamp(value: datetime) -> str:
    """Serialize PostgreSQL timestamp-without-time-zone values like the Node baseline.

    The legacy database columns are `timestamp` without timezone. The Node runtime
    materializes those values in the operational local timezone and JSON serializes
    the resulting Date as an UTC ISO string. This function keeps that contract by
    attaching `America/Sao_Paulo` to naive datetimes before converting to UTC.
    Aware datetimes are rejected so callers do not silently mix `timestamptz` with
    the legacy columns.
    """

    if value.tzinfo is not None and value.utcoffset() is not None:
        raise ValueError("legacy timestamp columns must be naive datetimes")

    localized = value.replace(tzinfo=ZoneInfo(LEGACY_OPERATIONAL_TIMEZONE))
    utc_value = localized.astimezone(UTC)
    milliseconds = utc_value.microsecond // 1000
    without_microseconds = utc_value.replace(microsecond=0)
    return f"{without_microseconds.isoformat().replace('+00:00', '')}.{milliseconds:03d}Z"


def snake_to_camel(value: str) -> str:
    if "_" not in value:
        return value
    parts = value.split("_")
    return parts[0] + "".join(part[:1].upper() + part[1:] for part in parts[1:] if part)


def serialize_legacy_value(value: object) -> object:
    if isinstance(value, datetime):
        return serialize_legacy_timestamp(value)
    if isinstance(value, date):
        return serialize_legacy_date(value)
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, Mapping):
        return {
            snake_to_camel(str(key)): serialize_legacy_value(item)
            for key, item in value.items()
        }
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return [serialize_legacy_value(item) for item in value]
    return value


def serialize_legacy_row(row: Mapping[str, object]) -> dict[str, object]:
    return {
        snake_to_camel(str(key)): serialize_legacy_value(value)
        for key, value in row.items()
    }
