from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from enum import Enum
from pathlib import Path

from silo.logging import (
    REDACTED,
    JsonLogFormatter,
    configure_json_logging,
    redact_context,
    reset_request_id,
    set_request_id,
)


def _format_record(record: logging.LogRecord) -> dict[str, object]:
    formatted = JsonLogFormatter(service="silo-api").format(record)
    parsed = json.loads(formatted)
    assert isinstance(parsed, dict)
    return parsed


def test_json_formatter_emits_required_fields_and_redacts_context() -> None:
    record = logging.LogRecord(
        name="silo.test",
        level=logging.INFO,
        pathname=__file__,
        lineno=10,
        msg="processed request",
        args=(),
        exc_info=None,
    )
    record.request_id = "req-123"
    record.context = {
        "product_id": "product-1",
        "database_url": "postgresql://user:db-secret@localhost:5432/silo",
        "headers": {"Authorization": "Bearer token-secret"},
        "nested": {"safe": "visible"},
        "diagnostic_url": "postgresql://user:url-secret@localhost:5432/silo",
    }

    payload = _format_record(record)

    assert payload["timestamp"]
    assert str(payload["timestamp"]).endswith("Z")
    assert payload["level"] == "INFO"
    assert payload["service"] == "silo-api"
    assert payload["request_id"] == "req-123"
    assert payload["message"] == "processed request"

    context = payload["context"]
    assert isinstance(context, dict)
    assert context["product_id"] == "product-1"
    assert context["database_url"] == REDACTED

    headers = context["headers"]
    assert isinstance(headers, dict)
    assert headers["Authorization"] == REDACTED

    nested = context["nested"]
    assert isinstance(nested, dict)
    assert nested["safe"] == "visible"
    assert "url-secret" not in json.dumps(context)


def test_json_formatter_redacts_prompt_history_reasoning_and_tool_fields() -> None:
    record = logging.LogRecord(
        name="silo.test",
        level=logging.INFO,
        pathname=__file__,
        lineno=10,
        msg="processed assistant payload",
        args=(),
        exc_info=None,
    )
    record.context = {
        "prompt": "revealed prompt",
        "history": [{"role": "user", "content": "legacy history"}],
        "reasoning": "internal reasoning",
        "thinking": "hidden chain of thought",
        "toolArgs": {"query": "secret query"},
        "toolArguments": {"query": "secret query"},
        "toolResults": [{"value": "secret result"}],
        "messages": [{"content": "secret message"}],
        "safe": "visible",
    }

    payload = _format_record(record)
    context = payload["context"]
    assert isinstance(context, dict)
    assert context["prompt"] == REDACTED
    assert context["history"] == REDACTED
    assert context["reasoning"] == REDACTED
    assert context["thinking"] == REDACTED
    assert context["toolArgs"] == REDACTED
    assert context["toolArguments"] == REDACTED
    assert context["toolResults"] == REDACTED
    assert context["messages"] == REDACTED
    assert context["safe"] == "visible"


def test_json_formatter_uses_contextvar_request_id_when_record_has_none() -> None:
    token = set_request_id("req-from-context")
    try:
        record = logging.LogRecord(
            name="silo.test",
            level=logging.WARNING,
            pathname=__file__,
            lineno=20,
            msg="warning message",
            args=(),
            exc_info=None,
        )

        payload = _format_record(record)
    finally:
        reset_request_id(token)

    assert payload["request_id"] == "req-from-context"
    assert payload["level"] == "WARNING"


def test_configure_json_logging_installs_json_formatter() -> None:
    root_logger = logging.getLogger()
    original_handlers = list(root_logger.handlers)
    original_level = root_logger.level
    try:
        configure_json_logging(service="silo-worker", level="error")

        assert root_logger.level == logging.ERROR
        assert len(root_logger.handlers) == 1
        assert isinstance(root_logger.handlers[0].formatter, JsonLogFormatter)
    finally:
        root_logger.handlers.clear()
        root_logger.handlers.extend(original_handlers)
        root_logger.setLevel(original_level)


class _SampleEnum(Enum):
    VALUE = "enum-value"


def test_redact_context_handles_common_scalar_and_collection_types() -> None:
    payload = redact_context(
        {
            "auth-header": "Bearer secret-token",
            "basic-header": "Basic secret-token",
            "database_url": "postgresql://user:secret@localhost:5432/silo",
            "prompt": "internal prompt",
            "when": datetime(2026, 7, 22, 15, 45, tzinfo=UTC),
            "path": Path("C:/tmp/secret.txt"),
            "enum": _SampleEnum.VALUE,
            "bytes": b"secret-bytes",
            "sequence": ["safe", "Bearer another-token"],
            "set": {"safe", "postgresql://user:secret@localhost:5432/silo"},
            "custom": object(),
        }
    )

    assert isinstance(payload, dict)
    assert payload["auth-header"] == REDACTED
    assert payload["basic-header"] == REDACTED
    assert payload["database_url"] == REDACTED
    assert payload["prompt"] == REDACTED
    assert payload["when"] == "2026-07-22T15:45:00+00:00"
    assert payload["path"] == str(Path("C:/tmp/secret.txt"))
    assert payload["enum"] == "enum-value"
    assert payload["bytes"] == REDACTED
    assert payload["sequence"][1] == REDACTED
    assert any(REDACTED in item for item in payload["set"] if isinstance(item, str))
    assert "object at" in payload["custom"]
