from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.dialects import postgresql
from sqlalchemy.exc import OperationalError

from silo.api.rate_limit import (
    RATE_LIMIT_DB_UNAVAILABLE_RETRY_AFTER_SECONDS,
    build_record_auth_rate_limit_statement,
    get_auth_rate_limit_status,
    record_auth_rate_limit,
)


class _FakeResult:
    def __init__(self, row: dict[str, Any] | None = None) -> None:
        self._row = row

    def mappings(self) -> _FakeResult:
        return self

    def first(self) -> dict[str, Any] | None:
        return self._row


class _FakeConnection:
    def __init__(self, *, row: dict[str, Any] | None = None, fail: bool = False) -> None:
        self.row = row
        self.fail = fail
        self.statements: list[object] = []

    def execute(self, statement: object) -> _FakeResult:
        if self.fail:
            raise OperationalError("select", {}, RuntimeError("db unavailable"))

        self.statements.append(statement)
        if len(self.statements) == 1:
            return _FakeResult()
        return _FakeResult(self.row)


def test_auth_rate_limit_status_matches_legacy_window_semantics() -> None:
    now = datetime(2026, 7, 22, 12, 0, 0)
    connection = _FakeConnection(row={"count": 3, "last_request": now - timedelta(seconds=10)})

    status = get_auth_rate_limit_status(
        connection,  # type: ignore[arg-type]
        email="user@example.test",
        ip="127.0.0.1",
        route="/api/auth/login",
        limit=3,
        window_seconds=60,
        now=now,
    )

    assert status.is_limited is True
    assert status.retry_after_seconds == 50
    assert status.count == 3
    assert status.limit == 3


def test_auth_rate_limit_status_fails_closed_when_database_is_unavailable() -> None:
    status = get_auth_rate_limit_status(
        _FakeConnection(fail=True),  # type: ignore[arg-type]
        email="user@example.test",
        ip="127.0.0.1",
        route="/api/auth/login",
    )

    assert status.is_limited is True
    assert status.retry_after_seconds == RATE_LIMIT_DB_UNAVAILABLE_RETRY_AFTER_SECONDS


def test_auth_rate_limit_record_skips_infrastructure_unavailability() -> None:
    record_auth_rate_limit(
        _FakeConnection(fail=True),  # type: ignore[arg-type]
        email="user@example.test",
        ip="127.0.0.1",
        route="/api/auth/login",
    )


def test_auth_rate_limit_record_uses_atomic_postgresql_upsert() -> None:
    statement = build_record_auth_rate_limit_statement(
        email="user@example.test",
        ip="127.0.0.1",
        route="/api/auth/login",
        window_seconds=60,
        now=datetime(2026, 7, 22, 12, 0, 0),
    )
    compiled = str(statement.compile(dialect=postgresql.dialect()))

    assert "ON CONFLICT (email, ip, route) DO UPDATE" in compiled
    assert "CASE WHEN" in compiled
    assert "rate_limit.count + " in compiled
