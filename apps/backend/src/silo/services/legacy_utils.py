from __future__ import annotations

import re
import uuid
from datetime import date, datetime


def optional_str(value: object | None) -> str | None:
    return value if isinstance(value, str) else None


def required_text(value: object | None, field_name: str = "value") -> str | None:
    text = optional_str(value)
    if text is None:
        return None
    normalized = text.strip()
    return normalized or None


def optional_int(value: object | None) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            return int(text)
        except ValueError:
            return None
    return None


def new_uuid() -> str:
    return str(uuid.uuid4())


def now_naive() -> datetime:
    return datetime.now()


def normalize_slug(value: str) -> str:
    import unicodedata

    normalized = unicodedata.normalize("NFD", value.strip().lower())
    without_marks = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
    slug = "".join(char if char.isalnum() else "-" for char in without_marks)
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug.strip("-")


def parse_iso_date(value: object | None) -> str | None:
    if isinstance(value, date) and not isinstance(value, datetime):
        return value.isoformat()
    text = optional_str(value)
    if text is None:
        return None
    stripped = text.strip()
    if not stripped:
        return None
    return stripped


def unique_strings(values: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        ordered.append(value)
    return ordered


def normalize_turn_list(value: object | None, fallback: tuple[str, ...]) -> list[str]:
    if not isinstance(value, list):
        return list(fallback)

    items: list[str] = []
    for item in value:
        if isinstance(item, str):
            candidate = item.strip()
        elif isinstance(item, int):
            candidate = str(item)
        else:
            continue
        if candidate:
            items.append(candidate)
    result = unique_strings(items)
    return result or list(fallback)


def safe_int(value: object | None, default: int = 0) -> int:
    parsed = optional_int(value)
    return default if parsed is None else parsed


def is_uuid_like(value: str) -> bool:
    try:
        uuid.UUID(value)
        return True
    except Exception:
        return False


def parse_date_range_value(value: object | None) -> str | None:
    text = optional_str(value)
    if text is None:
        return None
    text = text.strip()
    if not text:
        return None
    return text


def normalize_whitespace(value: object | None) -> str | None:
    text = optional_str(value)
    if text is None:
        return None
    text = re.sub(r"\s+", " ", text).strip()
    return text or None
