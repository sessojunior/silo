from __future__ import annotations

import math
import re
import unicodedata
from typing import Final

STATUS_BY_KAFKA_STATE: Final[dict[str, str]] = {
    "queued": "pending",
    "queue": "pending",
    "pending": "pending",
    "submitted": "pending",
    "complete": "completed",
    "completed": "completed",
    "active": "in_progress",
    "running": "in_progress",
    "in_progress": "in_progress",
    "failed": "with_problems",
    "aborted": "with_problems",
    "error": "with_problems",
    "with_problems": "with_problems",
    "run_again": "run_again",
    "not_run": "not_run",
    "under_support": "under_support",
    "suspended": "suspended",
}

DEFAULT_STATUS: Final[str] = "pending"


def normalize_model_key(value: str | None) -> str:
    if not value:
        return ""

    normalized = unicodedata.normalize("NFD", value.lower())
    result: list[str] = []
    previous_dash = False

    for char in normalized:
        if unicodedata.category(char) == "Mn":
            continue
        if char.isalnum():
            result.append(char)
            previous_dash = False
            continue
        if not previous_dash:
            result.append("-")
            previous_dash = True

    return "".join(result).strip("-")


def normalize_data_flow_reference_key(value: str | None) -> str:
    text = str(value or "").strip()
    if not text:
        return ""

    cleaned_path = text.strip("/")
    if "/" in cleaned_path:
        segments = [segment for segment in cleaned_path.split("/") if segment]
        if len(segments) > 1:
            return normalize_data_flow_reference_key("_".join(segments[1:]))
        return normalize_data_flow_reference_key(segments[0] if segments else "")

    cleaned = re.sub(r"_[0-9]{4}-[0-9]{2}-[0-9]{2}$", "", cleaned_path)
    cleaned = re.sub(r"[^a-zA-Z0-9_]+", "_", cleaned)
    cleaned = re.sub(r"_+", "_", cleaned)
    return cleaned.strip("_")


def normalize_product_status(primary: str | None = None, fallback: str | None = None) -> str:
    for candidate in (primary, fallback):
        key = str(candidate or "").strip().lower()
        if key and key in STATUS_BY_KAFKA_STATE:
            return STATUS_BY_KAFKA_STATE[key]
    return DEFAULT_STATUS


def clamp_progress(value: object, status: str) -> int:
    if isinstance(value, bool):
        return 0
    if isinstance(value, (int, float)) and math.isfinite(float(value)):
        return max(0, min(100, round(float(value))))

    if status == "completed":
        return 100
    if status == "in_progress":
        return 50
    return 0
