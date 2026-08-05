from __future__ import annotations

import contextvars
import json
import logging as stdlib_logging
import re
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime
from enum import Enum
from pathlib import Path

type JsonPrimitive = str | int | float | bool | None
type JsonValue = JsonPrimitive | list[JsonValue] | dict[str, JsonValue]

REDACTED = "[REDACTED]"
SENSITIVE_KEY_PARTS = frozenset(
    (
        "api_key",
        "apikey",
        "authorization",
        "cookie",
        "credential",
        "database_url",
        "dsn",
        "history",
        "password",
        "prompt",
        "private_key",
        "reasoning",
        "secret",
        "thinking",
        "token",
        "tool_args",
        "tool_arguments",
        "toolargs",
        "toolarguments",
        "tool_results",
        "toolresults",
        "messages",
        "message",
    )
)
AUTH_HEADER_PREFIXES = ("bearer ", "basic ")
CREDENTIAL_URL_PATTERN = re.compile(r"([a-zA-Z][a-zA-Z0-9+.-]*://)([^:/@\s]+):([^@\s]+)@")

_request_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "silo_request_id",
    default=None,
)


class JsonLogFormatter(stdlib_logging.Formatter):
    def __init__(self, *, service: str) -> None:
        super().__init__()
        self._service = service

    def format(self, record: stdlib_logging.LogRecord) -> str:
        payload: dict[str, JsonValue] = {
            "timestamp": datetime.fromtimestamp(record.created, UTC)
            .isoformat()
            .replace("+00:00", "Z"),
            "level": record.levelname,
            "service": self._service,
            "request_id": _request_id_from_record(record),
            "message": record.getMessage(),
            "context": redact_context(_context_from_record(record)),
        }

        if record.exc_info:
            payload["exception"] = redact_context(self.formatException(record.exc_info))

        return json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def configure_json_logging(*, service: str, level: str = "INFO") -> None:
    handler = stdlib_logging.StreamHandler()
    handler.setFormatter(JsonLogFormatter(service=service))

    root_logger = stdlib_logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(level.upper())


def set_request_id(request_id: str | None) -> contextvars.Token[str | None]:
    return _request_id_var.set(request_id)


def reset_request_id(token: contextvars.Token[str | None]) -> None:
    _request_id_var.reset(token)


def get_request_id() -> str | None:
    return _request_id_var.get()


def redact_context(value: object) -> JsonValue:
    if isinstance(value, Mapping):
        redacted: dict[str, JsonValue] = {}
        for raw_key, raw_value in value.items():
            key = str(raw_key)
            redacted[key] = REDACTED if _is_sensitive_key(key) else redact_context(raw_value)
        return redacted

    if isinstance(value, str):
        return _redact_sensitive_string(value)

    if isinstance(value, bool | int | float) or value is None:
        return value

    if isinstance(value, datetime):
        return value.isoformat()

    if isinstance(value, Path):
        return str(value)

    if isinstance(value, Enum):
        return redact_context(value.value)

    if isinstance(value, bytes):
        return REDACTED

    if isinstance(value, Sequence):
        return [redact_context(item) for item in value]

    if isinstance(value, set):
        return [redact_context(item) for item in value]

    return repr(value)


def _request_id_from_record(record: stdlib_logging.LogRecord) -> str | None:
    record_request_id = getattr(record, "request_id", None)
    if isinstance(record_request_id, str) and record_request_id:
        return record_request_id
    return get_request_id()


def _context_from_record(record: stdlib_logging.LogRecord) -> object:
    context = getattr(record, "context", {})
    if context is None:
        return {}
    return context


def _is_sensitive_key(key: str) -> bool:
    normalized = key.lower().replace("-", "_")
    return any(part in normalized for part in SENSITIVE_KEY_PARTS)


def _redact_sensitive_string(value: str) -> str:
    lowered = value.lower()
    if lowered.startswith(AUTH_HEADER_PREFIXES):
        return REDACTED
    return CREDENTIAL_URL_PATTERN.sub(r"\1\2:[REDACTED]@", value)
