from __future__ import annotations

import re
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Final

from sqlalchemy import Boolean, Date, DateTime, Integer, Table, Text
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.types import TypeEngine

from silo.db.models import (
    CHECK_CONSTRAINT_SPECS,
    COLUMN_NAME_MAPPINGS,
    COLUMN_SERVER_DEFAULTS,
    FOREIGN_KEY_SPECS,
    INDEX_SPECS,
    PGVECTOR_DIMENSIONS,
    PHYSICAL_COLUMNS_TO_PYTHON,
    PHYSICAL_TABLE_TO_PYTHON,
    PYTHON_COLUMNS_TO_PHYSICAL,
    PYTHON_TABLE_TO_PHYSICAL,
    TABLE_COLUMN_SPECS,
    TABLE_NAME_MAPPINGS,
    UNIQUE_CONSTRAINT_SPECS,
    Vector768,
    legacy_metadata,
    legacy_tables,
    physical_column_name,
    physical_table_name,
    python_column_name,
    python_table_name,
)
from silo.db.serialization import serialize_legacy_date, serialize_legacy_timestamp

REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
SCHEMA_TS = REPOSITORY_ROOT / "packages" / "db" / "src" / "schema.ts"
SUPPORTED_DRIZZLE_BUILDERS: Final = (
    "boolean",
    "date",
    "integer",
    "jsonb",
    "text",
    "timestamp",
    "uuid",
    "vector768",
)
EXPECTED_TABLE_COUNT = 40
EXPECTED_POST_ARTIFACT_TABLE_COUNT = 41
EXPECTED_POST_ARTIFACT_COLUMN_COUNT = 346
EXPECTED_VECTOR_COLUMNS = {
    ("product_problem", "embedding"),
    ("product_solution", "embedding"),
    ("product_manual_chunk", "embedding"),
    ("ai_assistant_message", "embedding"),
    ("help", "embedding"),
}


@dataclass(frozen=True)
class ColumnShape:
    name: str
    kind: str
    primary_key: bool
    required: bool


def test_sqlalchemy_model_spec_keeps_legacy_drizzle_schema_removed() -> None:
    assert not SCHEMA_TS.exists()

    declared_specs = _declared_table_specs()

    assert len(declared_specs) == EXPECTED_POST_ARTIFACT_TABLE_COUNT
    assert "ai_assistant_artifact" in declared_specs


def test_sqlalchemy_metadata_matches_declared_legacy_table_specs() -> None:
    expected = _declared_table_specs()
    actual = _sqlalchemy_table_specs()

    assert set(legacy_metadata.tables) == set(legacy_tables)
    assert len(legacy_metadata.tables) == EXPECTED_POST_ARTIFACT_TABLE_COUNT
    assert sum(len(table.columns) for table in legacy_metadata.tables.values()) == (
        EXPECTED_POST_ARTIFACT_COLUMN_COUNT
    )
    assert actual == expected

    for table_name, table in legacy_tables.items():
        assert table is legacy_metadata.tables[table_name]


def test_sqlalchemy_models_encode_phase_3_3_schema_decisions() -> None:
    group_permissions = legacy_tables["group_permissions"]
    vector_columns = {
        (table.name, column.name)
        for table in legacy_tables.values()
        for column in table.columns
        if isinstance(column.type, Vector768)
    }

    assert "resource" in group_permissions.c
    assert "action" in group_permissions.c
    assert "resource_v2" not in group_permissions.c
    assert "action_v2" not in group_permissions.c
    assert vector_columns == EXPECTED_VECTOR_COLUMNS
    assert "kafka_processed_messages" in legacy_tables


def test_sqlalchemy_models_map_timestamp_and_special_types_for_phase_3_8_and_3_9() -> None:
    timestamp_columns = [
        column
        for table in legacy_tables.values()
        for column in table.columns
        if isinstance(column.type, DateTime)
    ]
    jsonb_columns = [
        column
        for table in legacy_tables.values()
        for column in table.columns
        if isinstance(column.type, JSONB)
    ]
    uuid_columns = [
        column
        for table in legacy_tables.values()
        for column in table.columns
        if isinstance(column.type, PGUUID)
    ]
    date_columns = [
        column
        for table in legacy_tables.values()
        for column in table.columns
        if isinstance(column.type, Date) and not isinstance(column.type, DateTime)
    ]
    vector_columns = [
        column
        for table in legacy_tables.values()
        for column in table.columns
        if isinstance(column.type, Vector768)
    ]

    assert timestamp_columns
    assert all(column.type.timezone is False for column in timestamp_columns)
    assert len(jsonb_columns) == 4
    assert len(uuid_columns) == 23
    assert len(date_columns) == 8
    assert len(vector_columns) == 5
    assert PGVECTOR_DIMENSIONS == 768
    assert str(Vector768().compile(dialect=postgresql.dialect())) == "vector(768)"


def test_legacy_timestamp_serializer_matches_node_json_contract_goldens() -> None:
    assert serialize_legacy_timestamp(datetime(2026, 7, 22, 9, 30, 15, 123456)) == (
        "2026-07-22T12:30:15.123Z"
    )
    assert serialize_legacy_timestamp(datetime(2026, 1, 22, 9, 30, 15)) == (
        "2026-01-22T12:30:15.000Z"
    )
    assert serialize_legacy_date(date(2026, 7, 22)) == "2026-07-22"


def test_legacy_timestamp_serializer_rejects_aware_datetimes() -> None:
    try:
        serialize_legacy_timestamp(datetime(2026, 7, 22, 12, 30, tzinfo=UTC))
    except ValueError as exc:
        assert "naive" in str(exc)
    else:
        raise AssertionError("aware datetimes must not be accepted for legacy timestamp columns")


def test_sqlalchemy_metadata_includes_baseline_constraints_defaults_and_indexes() -> None:
    unique_names = {
        constraint.name
        for table in legacy_tables.values()
        for constraint in table.constraints
        if constraint.name is not None
        and constraint.name.startswith(
            (
                "unique_",
                "user_",
                "group_",
                "session_",
                "contact_",
                "picture_",
                "radar_",
                "product_",
                "ai_assistant_",
            )
        )
    }
    check_names = {
        constraint.name
        for table in legacy_tables.values()
        for constraint in table.constraints
        if constraint.name is not None and constraint.name.startswith("ck_")
    }
    foreign_key_names = {
        foreign_key.constraint.name
        for table in legacy_tables.values()
        for foreign_key in table.foreign_keys
        if foreign_key.constraint.name is not None
    }
    index_names = {index.name for table in legacy_tables.values() for index in table.indexes}

    assert unique_names.issuperset(
        {
            spec.constraint_name
            for constraint_specs in UNIQUE_CONSTRAINT_SPECS.values()
            for spec in constraint_specs
        }
    )
    assert foreign_key_names == {
        spec.constraint_name
        for constraint_specs in FOREIGN_KEY_SPECS.values()
        for spec in constraint_specs
    }
    assert index_names == {spec.index_name for spec in INDEX_SPECS}
    assert check_names == {
        f"ck_{table_name}_{spec.constraint_name}"
        for table_name, constraint_specs in CHECK_CONSTRAINT_SPECS.items()
        for spec in constraint_specs
    }

    for (table_name, column_name), server_default in COLUMN_SERVER_DEFAULTS.items():
        column = legacy_tables[table_name].c[column_name]
        assert column.server_default is not None
        assert str(column.server_default.arg) == server_default


def test_python_name_mappings_are_explicit_snake_case_and_preserve_physical_names() -> None:
    assert set(PYTHON_TABLE_TO_PHYSICAL) == set(PHYSICAL_TABLE_TO_PYTHON)
    assert set(PYTHON_COLUMNS_TO_PHYSICAL) == set(PHYSICAL_COLUMNS_TO_PYTHON)

    for mapping in TABLE_NAME_MAPPINGS:
        assert _is_snake_case(mapping.python_name)
        assert mapping.python_name == mapping.physical_name
        assert physical_table_name(mapping.python_name) == mapping.physical_name
        assert python_table_name(mapping.physical_name) == mapping.python_name

    for table_name, mappings in COLUMN_NAME_MAPPINGS:
        assert _is_snake_case(table_name)
        assert set(PYTHON_COLUMNS_TO_PHYSICAL[table_name]) == set(
            PHYSICAL_COLUMNS_TO_PYTHON[table_name]
        )

        for mapping in mappings:
            assert _is_snake_case(mapping.python_name)
            assert mapping.python_name == mapping.physical_name
            assert physical_column_name(table_name, mapping.python_name) == mapping.physical_name
            assert python_column_name(table_name, mapping.physical_name) == mapping.python_name
            assert legacy_tables[table_name].c[mapping.python_name].name == mapping.physical_name
            assert legacy_tables[table_name].c[mapping.python_name].key == mapping.python_name


def _declared_table_specs() -> dict[str, tuple[ColumnShape, ...]]:
    return {
        table_name: tuple(
            ColumnShape(
                name=column_name,
                kind=kind,
                primary_key=primary_key,
                required=required,
            )
            for column_name, kind, primary_key, required in column_specs
        )
        for table_name, column_specs in TABLE_COLUMN_SPECS
    }


def _sqlalchemy_table_specs() -> dict[str, tuple[ColumnShape, ...]]:
    return {
        table_name: _column_shapes_from_sqlalchemy_table(table)
        for table_name, table in legacy_tables.items()
    }


def _column_shapes_from_sqlalchemy_table(table: Table) -> tuple[ColumnShape, ...]:
    return tuple(
        ColumnShape(
            name=column_name,
            kind=_kind_from_sqlalchemy_type(table.c[column_name].type),
            primary_key=bool(table.c[column_name].primary_key),
            required=not bool(table.c[column_name].nullable),
        )
        for column_name in table.columns.keys()
    )


def _kind_from_sqlalchemy_type(column_type: TypeEngine[object]) -> str:
    if isinstance(column_type, Vector768):
        return "vector768"
    if isinstance(column_type, DateTime):
        return "timestamp"
    if isinstance(column_type, Date):
        return "date"
    if isinstance(column_type, PGUUID):
        return "uuid"
    if isinstance(column_type, JSONB):
        return "jsonb"
    if isinstance(column_type, Boolean):
        return "boolean"
    if isinstance(column_type, Integer):
        return "integer"
    if isinstance(column_type, Text):
        return "text"

    raise AssertionError(f"Unsupported SQLAlchemy type in legacy model: {column_type!r}")


def _is_snake_case(value: str) -> bool:
    return re.fullmatch(r"[a-z][a-z0-9_]*", value) is not None


def _drizzle_table_specs() -> dict[str, tuple[ColumnShape, ...]]:
    source = SCHEMA_TS.read_text(encoding="utf-8")
    table_specs: dict[str, tuple[ColumnShape, ...]] = {}

    for match in re.finditer(r"export\s+const\s+\w+\s*=\s*pgTable\s*\(", source):
        open_paren_index = match.end() - 1
        close_paren_index = _find_matching_delimiter(source, open_paren_index, "(", ")")
        pg_table_body = source[open_paren_index + 1 : close_paren_index]
        table_name_match = re.match(r"\s*[\"'](?P<table_name>[^\"']+)[\"']\s*,", pg_table_body)

        if table_name_match is None:
            raise AssertionError(f"Unable to parse pgTable name near {match.group(0)!r}")

        columns_open_index = pg_table_body.find("{", table_name_match.end())
        columns_close_index = _find_matching_delimiter(pg_table_body, columns_open_index, "{", "}")
        columns_body = pg_table_body[columns_open_index + 1 : columns_close_index]
        table_name = table_name_match.group("table_name")

        table_specs[table_name] = tuple(_iter_drizzle_columns(columns_body))

    return table_specs


def _iter_drizzle_columns(columns_body: str) -> Iterator[ColumnShape]:
    builder_names = "|".join(SUPPORTED_DRIZZLE_BUILDERS)
    column_start_pattern = re.compile(
        rf"^\s*\w+:\s*(?P<kind>{builder_names})\(\"(?P<name>[^\"]+)\"\)",
        re.MULTILINE,
    )
    column_starts = list(column_start_pattern.finditer(columns_body))

    for index, match in enumerate(column_starts):
        next_start = column_starts[index + 1].start() if index + 1 < len(column_starts) else None
        column_expression = columns_body[match.start() : next_start]
        primary_key = ".primaryKey()" in column_expression

        yield ColumnShape(
            name=match.group("name"),
            kind=match.group("kind"),
            primary_key=primary_key,
            required=primary_key or ".notNull()" in column_expression,
        )


def _find_matching_delimiter(source: str, open_index: int, open_char: str, close_char: str) -> int:
    if open_index < 0 or source[open_index] != open_char:
        raise AssertionError(f"Expected {open_char!r} at index {open_index}")

    depth = 0
    string_quote: str | None = None
    escaped = False
    line_comment = False
    block_comment = False

    for index in range(open_index, len(source)):
        char = source[index]
        next_char = source[index + 1] if index + 1 < len(source) else ""

        if line_comment:
            if char in "\r\n":
                line_comment = False
            continue

        if block_comment:
            if char == "*" and next_char == "/":
                block_comment = False
            continue

        if string_quote is not None:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == string_quote:
                string_quote = None
            continue

        if char == "/" and next_char == "/":
            line_comment = True
            continue

        if char == "/" and next_char == "*":
            block_comment = True
            continue

        if char in {"'", '"', "`"}:
            string_quote = char
            continue

        if char == open_char:
            depth += 1
            continue

        if char == close_char:
            depth -= 1
            if depth == 0:
                return index

    raise AssertionError(f"Delimiter {open_char!r} at index {open_index} was not closed")
