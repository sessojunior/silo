from __future__ import annotations

import json
import os
import re
from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import UUID

import pytest

from silo.db import schema_capture
from silo.db.schema_capture import (
    READ_ONLY_QUERIES,
    _build_sanitized_table_checksums,
    capture_schema_metadata,
)
from silo.db.url import async_database_url

FORBIDDEN_SQL_WORDS = re.compile(
    r"\b(create|alter|drop|truncate|insert|update|delete|grant|revoke|vacuum)\b",
    re.IGNORECASE,
)


def test_async_database_url_normalizes_postgres_urls_for_sqlalchemy_async() -> None:
    assert async_database_url("postgresql://user:pass@db/silo") == (
        "postgresql+psycopg://user:pass@db/silo"
    )
    assert async_database_url("postgres://user:pass@db/silo") == (
        "postgresql+psycopg://user:pass@db/silo"
    )
    assert async_database_url("postgresql+psycopg://user:pass@db/silo") == (
        "postgresql+psycopg://user:pass@db/silo"
    )


def test_schema_capture_declares_all_required_catalog_sections() -> None:
    query_names = {query.name for query in READ_ONLY_QUERIES}

    assert {
        "extensions",
        "tables",
        "columns",
        "types",
        "sequences",
        "constraints",
        "foreign_keys",
        "indexes",
        "triggers",
        "views",
        "grants",
        "row_counts",
    }.issubset(query_names)


def test_schema_capture_queries_are_read_only_catalog_queries() -> None:
    for query in READ_ONLY_QUERIES:
        assert query.sql.lstrip().lower().startswith("select"), query.name
        assert not FORBIDDEN_SQL_WORDS.search(query.sql), query.name
        assert "information_schema" in query.sql or "pg_catalog" in query.sql, query.name


def test_sanitized_table_checksums_do_not_claim_row_data() -> None:
    checksums = _build_sanitized_table_checksums(
        {
            "tables": [
                {
                    "table_schema": "public",
                    "table_name": "example",
                    "table_type": "BASE TABLE",
                }
            ],
            "columns": [
                {
                    "table_schema": "public",
                    "table_name": "example",
                    "column_name": "id",
                    "data_type": "text",
                }
            ],
            "indexes": [],
            "constraints": [],
            "foreign_keys": [],
            "row_counts": [
                {
                    "table_schema": "public",
                    "table_name": "example",
                    "approximate_live_rows": 123,
                }
            ],
            "triggers": [],
        }
    )

    assert checksums == [
        {
            "tableSchema": "public",
            "tableName": "example",
            "checksumSha256": checksums[0]["checksumSha256"],
            "includesRowData": False,
        }
    ]
    assert isinstance(checksums[0]["checksumSha256"], str)
    assert len(str(checksums[0]["checksumSha256"])) == 64


def test_schema_capture_metadata_roundtrip_covers_json_safety_and_fingerprints(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}
    shared_row = {
        "table_schema": "public",
        "table_name": "example",
        "table_type": "BASE TABLE",
        "decimal_value": Decimal("1.23"),
        "uuid_value": UUID("12345678-1234-5678-1234-567812345678"),
        "aware_datetime": datetime(2026, 7, 23, 12, 0, tzinfo=UTC),
        "naive_datetime": datetime(2026, 7, 23, 12, 0),
        "date_value": date(2026, 7, 23),
        "list_value": [1, Decimal("4.56"), {"nested": UUID("87654321-4321-6789-4321-678987654321")}],
        "tuple_value": ("a", "b"),
        "mapping_value": {"nested": Decimal("7.89")},
        "custom_value": object(),
    }
    section_rows = [
        [],
        [],
        [shared_row],
        [
            {
                "table_schema": "public",
                "table_name": "example",
                "ordinal_position": 1,
                "column_name": "id",
            }
        ],
        [
            {
                "type_schema": "public",
                "type_name": "example_type",
                "type_kind": "e",
                "type_category": "E",
                "enum_label": "alpha",
                "enum_sort_order": 1,
            }
        ],
        [
            {
                "sequence_schema": "public",
                "sequence_name": "example_seq",
                "data_type": "integer",
                "start_value": "1",
                "minimum_value": "1",
                "maximum_value": "10",
                "increment": "1",
            }
        ],
        [
            {
                "table_schema": "public",
                "table_name": "example",
                "constraint_name": "example_pkey",
                "constraint_type": "PRIMARY KEY",
                "constraint_definition": "PRIMARY KEY (id)",
            }
        ],
        [
            {
                "table_schema": "public",
                "table_name": "example",
                "constraint_name": "example_fk",
                "source_columns": ["example_id"],
                "referenced_schema": "public",
                "referenced_table": "other",
                "referenced_columns": ["id"],
                "update_rule": "CASCADE",
                "delete_rule": "CASCADE",
            }
        ],
        [
            {
                "table_schema": "public",
                "table_name": "example",
                "index_name": "example_idx",
                "index_definition": "CREATE INDEX example_idx ON example (id)",
            }
        ],
        [
            {
                "table_schema": "public",
                "table_name": "example",
                "trigger_name": "example_trigger",
                "trigger_definition": "CREATE TRIGGER example_trigger",
            }
        ],
        [
            {
                "table_schema": "public",
                "table_name": "example",
                "view_definition": "SELECT 1",
            }
        ],
        [
            {
                "table_schema": "public",
                "table_name": "example",
                "grantee": "public",
                "privilege_type": "SELECT",
                "is_grantable": "NO",
            }
        ],
        [
            {
                "table_schema": "public",
                "table_name": "example",
                "approximate_live_rows": 1,
                "approximate_dead_rows": 0,
                "last_analyze": None,
                "last_autoanalyze": None,
                "last_vacuum": None,
                "last_autovacuum": None,
            }
        ],
    ]

    fake_connection = _FakeConnection(section_rows)
    fake_engine = _FakeEngine(fake_connection)

    def fake_create_engine(database_url: str, pool_pre_ping: bool = False):
        captured["database_url"] = database_url
        captured["pool_pre_ping"] = pool_pre_ping
        return fake_engine

    monkeypatch.setattr(schema_capture, "create_engine", fake_create_engine)

    capture = capture_schema_metadata("postgresql://user:pass@db/silo")

    assert captured["database_url"] == "postgresql+psycopg://user:pass@db/silo"
    assert captured["pool_pre_ping"] is True
    assert fake_engine.disposed is True
    assert fake_connection.transaction.rollback_calls == 1
    assert capture["readOnly"] is True
    assert capture["sections"]["tables"][0]["decimal_value"] == "1.23"
    assert capture["sections"]["tables"][0]["uuid_value"] == "12345678-1234-5678-1234-567812345678"
    assert capture["sections"]["tables"][0]["aware_datetime"] == "2026-07-23T12:00:00Z"
    assert capture["sections"]["tables"][0]["naive_datetime"] == "2026-07-23T12:00:00"
    assert capture["sections"]["tables"][0]["date_value"] == "2026-07-23"
    assert capture["sections"]["tables"][0]["list_value"][1] == "4.56"
    assert capture["sections"]["tables"][0]["tuple_value"] == ["a", "b"]
    assert capture["sections"]["tables"][0]["mapping_value"]["nested"] == "7.89"
    assert isinstance(capture["fingerprintSha256"], str)
    assert len(capture["fingerprintSha256"]) == 64
    assert len(capture["sanitizedTableChecksums"]) == 1
    assert capture["sanitizedTableChecksums"][0]["tableSchema"] == "public"
    assert capture["sanitizedTableChecksums"][0]["tableName"] == "example"
    assert len(capture["sanitizedTableChecksums"][0]["checksumSha256"]) == 64


def test_schema_capture_database_url_environment_lookup_prefers_values_in_order() -> None:
    assert schema_capture._database_url_from_environment(  # noqa: SLF001
        {"DATABASE_URL": "postgresql://dev"}
    ) == "postgresql://dev"
    assert schema_capture._utc_now_iso().endswith("Z")  # noqa: SLF001

    with pytest.raises(RuntimeError, match="DATABASE_URL ausente"):
        schema_capture._database_url_from_environment({})  # noqa: SLF001


def test_schema_capture_runs_against_local_database_when_configured() -> None:
    database_url = os.environ.get("SILO_SCHEMA_CAPTURE_TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("Defina SILO_SCHEMA_CAPTURE_TEST_DATABASE_URL para validar o DB local.")

    capture = capture_schema_metadata(database_url)
    serialized = json.dumps(capture, ensure_ascii=False, sort_keys=True)
    sections = capture["sections"]

    assert capture["readOnly"] is True
    assert isinstance(capture["fingerprintSha256"], str)
    assert len(capture["fingerprintSha256"]) == 64
    assert "postgresql://" not in serialized
    assert "postgresql+psycopg://" not in serialized
    assert isinstance(sections, dict)
    assert any(row["table_name"] == "group" for row in sections["tables"])
    assert any(row["extension_name"] == "vector" for row in sections["extensions"])
    assert len(capture["sanitizedTableChecksums"]) >= 40
    assert all(row["includesRowData"] is False for row in capture["sanitizedTableChecksums"])


def test_schema_capture_main_uses_environment_database_url(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    captured: dict[str, object] = {}

    def fake_capture_schema_metadata(database_url: str) -> dict[str, object]:
        captured["database_url"] = database_url
        return {
            "captureVersion": "phase-test",
            "capturedAtUtc": "2026-08-03T12:00:00Z",
            "readOnly": True,
            "sections": {},
            "sanitizedTableChecksums": [],
            "fingerprintSha256": "a" * 64,
        }

    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@db/silo")
    monkeypatch.setattr(schema_capture, "capture_schema_metadata", fake_capture_schema_metadata)

    assert schema_capture.main([]) == 0

    output = capsys.readouterr().out
    assert captured["database_url"] == "postgresql://user:pass@db/silo"
    assert '"fingerprintSha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"' in output


class _FakeResult:
    def __init__(self, rows: list[dict[str, object]] | None = None) -> None:
        self._rows = rows or []

    def mappings(self) -> _FakeResult:
        return self

    def all(self) -> list[dict[str, object]]:
        return self._rows


class _FakeTransaction:
    def __init__(self) -> None:
        self.rollback_calls = 0

    def __enter__(self) -> _FakeTransaction:
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False

    def rollback(self) -> None:
        self.rollback_calls += 1


class _FakeConnection:
    def __init__(self, section_rows: list[list[dict[str, object]]]) -> None:
        self._section_rows = iter(section_rows)
        self.transaction = _FakeTransaction()
        self.executed: list[str] = []

    def __enter__(self) -> _FakeConnection:
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False

    def begin(self) -> _FakeTransaction:
        return self.transaction

    def execute(self, statement) -> _FakeResult:
        statement_text = str(statement)
        self.executed.append(statement_text)
        if "SET TRANSACTION READ ONLY" in statement_text:
            return _FakeResult([])
        return _FakeResult(next(self._section_rows))


class _FakeEngine:
    def __init__(self, connection: _FakeConnection) -> None:
        self.connection = connection
        self.disposed = False

    def connect(self) -> _FakeConnection:
        return self.connection

    def dispose(self) -> None:
        self.disposed = True
