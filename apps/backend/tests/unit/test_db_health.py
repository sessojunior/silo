from __future__ import annotations

import asyncio
from dataclasses import dataclass

import pytest

from silo.db import health as db_health
from silo.db.migration_state import EXPECTED_ALEMBIC_HEADS


@dataclass
class _FakeResult:
    rows: list[tuple[object, ...]]

    def __iter__(self):
        return iter(self.rows)


class _FakeConnection:
    def __init__(self, rows: list[tuple[object, ...]]) -> None:
        self.rows = rows
        self.statements: list[str] = []

    def execute(self, statement):  # type: ignore[no-untyped-def]
        self.statements.append(str(statement))
        if "select 1" in str(statement).lower():
            return _FakeResult([(1,)])
        return _FakeResult(self.rows)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        del exc_type, exc, tb


class _FakeEngine:
    def __init__(self, rows: list[tuple[object, ...]]) -> None:
        self.connection = _FakeConnection(rows)
        self.disposed = False

    def connect(self):
        return self.connection

    def dispose(self) -> None:
        self.disposed = True


def test_check_database_ready_sync_accepts_expected_heads(monkeypatch: pytest.MonkeyPatch) -> None:
    engine = _FakeEngine([(EXPECTED_ALEMBIC_HEADS[0],)])
    monkeypatch.setattr(db_health, "create_engine", lambda *args, **kwargs: engine)

    db_health._check_database_ready_sync("postgresql://example.test/silo")  # noqa: SLF001

    assert engine.disposed is True
    assert any("select version_num from alembic_version" in statement.lower() for statement in engine.connection.statements)


def test_check_database_ready_sync_rejects_schema_mismatch(monkeypatch: pytest.MonkeyPatch) -> None:
    engine = _FakeEngine([("other-head",)])
    monkeypatch.setattr(db_health, "create_engine", lambda *args, **kwargs: engine)

    with pytest.raises(RuntimeError, match="schema is not at expected Alembic head"):
        db_health._check_database_ready_sync("postgresql://example.test/silo")  # noqa: SLF001

    assert engine.disposed is True


@pytest.mark.asyncio
async def test_check_database_ready_wraps_sync_helper(monkeypatch: pytest.MonkeyPatch) -> None:
    recorded: list[object] = []

    async def fake_to_thread(func, database_url):
        recorded.append((func.__name__, database_url))

    monkeypatch.setattr(db_health.asyncio, "to_thread", fake_to_thread)

    await db_health.check_database_ready("postgresql://example.test/silo")

    assert recorded == [("_check_database_ready_sync", "postgresql://example.test/silo")]

