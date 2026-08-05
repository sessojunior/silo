from __future__ import annotations

from dataclasses import dataclass

import pytest

from silo.db import migrate as db_migrate
from silo.db.migration_state import EXPECTED_ALEMBIC_HEADS, MIGRATION_ADVISORY_LOCK_ID


@dataclass
class _FakeResult:
    rows: list[tuple[object, ...]]

    def __iter__(self):
        return iter(self.rows)


class _FakeConnection:
    def __init__(self, rows: list[tuple[object, ...]]) -> None:
        self.rows = rows
        self.statements: list[str] = []
        self.executed_params: list[dict[str, object] | None] = []
        self.committed = False

    def execute(self, statement, params=None):  # type: ignore[no-untyped-def]
        self.statements.append(str(statement))
        self.executed_params.append(params)
        if "select version_num from alembic_version" in str(statement).lower():
            return _FakeResult(self.rows)
        return _FakeResult([])

    def commit(self) -> None:
        self.committed = True

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


def test_database_url_from_environment_prefers_first_non_empty() -> None:
    assert (
        db_migrate.database_url_from_environment(
            {
                "DATABASE_URL": "  ",
                "DATABASE_URL_DEV": "postgresql://dev-user:dev-pass@localhost:5432/silo",
                "DATABASE_URL_PROD": "postgresql://prod-user:prod-pass@localhost:5432/silo",
            }
        )
        == "postgresql://dev-user:dev-pass@localhost:5432/silo"
    )


def test_database_url_from_environment_raises_when_missing() -> None:
    with pytest.raises(RuntimeError, match="DATABASE_URL ausente"):
        db_migrate.database_url_from_environment({})


def test_run_migrations_executes_upgrade_and_checks_heads(monkeypatch: pytest.MonkeyPatch) -> None:
    engine = _FakeEngine([(EXPECTED_ALEMBIC_HEADS[0],)])
    calls: list[str] = []

    monkeypatch.setattr(db_migrate, "create_engine", lambda *args, **kwargs: engine)
    monkeypatch.setattr(db_migrate, "alembic_config", lambda: object())
    monkeypatch.setattr(
        db_migrate.command,
        "upgrade",
        lambda config, target: calls.append(f"upgrade:{target}"),
    )
    monkeypatch.setattr(
        db_migrate.command,
        "check",
        lambda config: calls.append("check"),
    )

    db_migrate.run_migrations("postgresql://example.test/silo")

    assert calls == ["upgrade:head", "check"]
    assert engine.connection.committed is True
    assert engine.disposed is True
    assert any(
        "pg_advisory_lock" in statement.lower() and str(MIGRATION_ADVISORY_LOCK_ID) in str(params)
        for statement, params in zip(engine.connection.statements, engine.connection.executed_params, strict=True)
    )
    assert any("pg_advisory_unlock" in statement.lower() for statement in engine.connection.statements)


def test_run_migrations_raises_on_head_mismatch(monkeypatch: pytest.MonkeyPatch) -> None:
    engine = _FakeEngine([("other-head",)])

    monkeypatch.setattr(db_migrate, "create_engine", lambda *args, **kwargs: engine)
    monkeypatch.setattr(db_migrate, "alembic_config", lambda: object())
    monkeypatch.setattr(db_migrate.command, "upgrade", lambda config, target: None)
    monkeypatch.setattr(db_migrate.command, "check", lambda config: None)

    with pytest.raises(RuntimeError, match="Alembic head mismatch after migration"):
        db_migrate.run_migrations("postgresql://example.test/silo")

    assert engine.disposed is True


def test_main_rejects_positional_arguments(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(db_migrate, "run_migrations", lambda database_url: None)
    monkeypatch.setattr(db_migrate, "database_url_from_environment", lambda environ: "postgresql://example.test/silo")
    monkeypatch.setattr(db_migrate, "os", __import__("os"))

    with pytest.raises(RuntimeError, match="nao aceita argumentos posicionais"):
        db_migrate.main(["extra"])

