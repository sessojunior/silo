from __future__ import annotations

import argparse
import json
import os
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, date, datetime
from decimal import Decimal
from hashlib import sha256
from pathlib import Path
from typing import Any
from uuid import UUID

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Connection

from silo.db.url import async_database_url

type JSONValue = object

CAPTURE_VERSION = "phase-3.4.v1"


@dataclass(frozen=True)
class CatalogQuery:
    name: str
    description: str
    sql: str


READ_ONLY_QUERIES: tuple[CatalogQuery, ...] = (
    CatalogQuery(
        name="extensions",
        description="Installed PostgreSQL extensions.",
        sql="""
            SELECT
              e.extname AS extension_name,
              e.extversion AS extension_version
            FROM pg_catalog.pg_extension e
            ORDER BY e.extname;
        """,
    ),
    CatalogQuery(
        name="schemas",
        description="Non-system schemas.",
        sql="""
            SELECT
              n.nspname AS schema_name,
              pg_catalog.pg_get_userbyid(n.nspowner) AS owner_name
            FROM pg_catalog.pg_namespace n
            WHERE n.nspname NOT LIKE 'pg_%'
              AND n.nspname <> 'information_schema'
            ORDER BY n.nspname;
        """,
    ),
    CatalogQuery(
        name="tables",
        description="Base tables and views from information_schema.",
        sql="""
            SELECT
              t.table_schema,
              t.table_name,
              t.table_type
            FROM information_schema.tables t
            WHERE t.table_schema NOT LIKE 'pg_%'
              AND t.table_schema <> 'information_schema'
            ORDER BY t.table_schema, t.table_name;
        """,
    ),
    CatalogQuery(
        name="columns",
        description="Columns, physical types, nullability and defaults.",
        sql="""
            SELECT
              c.table_schema,
              c.table_name,
              c.ordinal_position,
              c.column_name,
              c.data_type,
              c.udt_schema,
              c.udt_name,
              c.character_maximum_length,
              c.numeric_precision,
              c.numeric_scale,
              c.datetime_precision,
              c.is_nullable,
              c.column_default,
              c.is_identity,
              c.identity_generation,
              c.is_generated,
              c.generation_expression
            FROM information_schema.columns c
            WHERE c.table_schema NOT LIKE 'pg_%'
              AND c.table_schema <> 'information_schema'
            ORDER BY c.table_schema, c.table_name, c.ordinal_position;
        """,
    ),
    CatalogQuery(
        name="types",
        description="User-visible PostgreSQL types and enum labels.",
        sql="""
            SELECT
              n.nspname AS type_schema,
              t.typname AS type_name,
              t.typtype AS type_kind,
              t.typcategory AS type_category,
              e.enumlabel AS enum_label,
              e.enumsortorder AS enum_sort_order
            FROM pg_catalog.pg_type t
            JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
            LEFT JOIN pg_catalog.pg_enum e ON e.enumtypid = t.oid
            WHERE n.nspname NOT LIKE 'pg_%'
              AND n.nspname <> 'information_schema'
            ORDER BY n.nspname, t.typname, e.enumsortorder NULLS FIRST;
        """,
    ),
    CatalogQuery(
        name="sequences",
        description="Sequences visible through information_schema.",
        sql="""
            SELECT
              s.sequence_schema,
              s.sequence_name,
              s.data_type,
              s.start_value,
              s.minimum_value,
              s.maximum_value,
              s.increment
            FROM information_schema.sequences s
            WHERE s.sequence_schema NOT LIKE 'pg_%'
              AND s.sequence_schema <> 'information_schema'
            ORDER BY s.sequence_schema, s.sequence_name;
        """,
    ),
    CatalogQuery(
        name="constraints",
        description="Constraints with PostgreSQL-rendered definitions.",
        sql="""
            SELECT
              n.nspname AS table_schema,
              c.relname AS table_name,
              con.conname AS constraint_name,
              CASE con.contype
                WHEN 'c' THEN 'CHECK'
                WHEN 'f' THEN 'FOREIGN KEY'
                WHEN 'p' THEN 'PRIMARY KEY'
                WHEN 'u' THEN 'UNIQUE'
                WHEN 'x' THEN 'EXCLUDE'
                ELSE con.contype::text
              END AS constraint_type,
              pg_catalog.pg_get_constraintdef(con.oid, true) AS constraint_definition
            FROM pg_catalog.pg_constraint con
            JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname NOT LIKE 'pg_%'
              AND n.nspname <> 'information_schema'
            ORDER BY n.nspname, c.relname, con.conname;
        """,
    ),
    CatalogQuery(
        name="foreign_keys",
        description="Foreign keys with source/target columns and update/delete rules.",
        sql="""
            SELECT
              ns.nspname AS table_schema,
              src.relname AS table_name,
              con.conname AS constraint_name,
              (
                SELECT array_agg(att.attname ORDER BY keys.ordinality)
                FROM unnest(con.conkey) WITH ORDINALITY AS keys(attnum, ordinality)
                JOIN pg_catalog.pg_attribute att
                  ON att.attrelid = src.oid
                 AND att.attnum = keys.attnum
              ) AS source_columns,
              nt.nspname AS referenced_schema,
              tgt.relname AS referenced_table,
              (
                SELECT array_agg(att.attname ORDER BY keys.ordinality)
                FROM unnest(con.confkey) WITH ORDINALITY AS keys(attnum, ordinality)
                JOIN pg_catalog.pg_attribute att
                  ON att.attrelid = tgt.oid
                 AND att.attnum = keys.attnum
              ) AS referenced_columns,
              CASE con.confupdtype
                WHEN 'a' THEN 'NO ACTION'
                WHEN 'r' THEN 'RESTRICT'
                WHEN 'c' THEN 'CASCADE'
                WHEN 'n' THEN 'SET NULL'
                WHEN 'd' THEN 'SET DEFAULT'
                ELSE con.confupdtype::text
              END AS update_rule,
              CASE con.confdeltype
                WHEN 'a' THEN 'NO ACTION'
                WHEN 'r' THEN 'RESTRICT'
                WHEN 'c' THEN 'CASCADE'
                WHEN 'n' THEN 'SET NULL'
                WHEN 'd' THEN 'SET DEFAULT'
                ELSE con.confdeltype::text
              END AS delete_rule
            FROM pg_catalog.pg_constraint con
            JOIN pg_catalog.pg_class src ON src.oid = con.conrelid
            JOIN pg_catalog.pg_namespace ns ON ns.oid = src.relnamespace
            JOIN pg_catalog.pg_class tgt ON tgt.oid = con.confrelid
            JOIN pg_catalog.pg_namespace nt ON nt.oid = tgt.relnamespace
            WHERE con.contype = 'f'
              AND ns.nspname NOT LIKE 'pg_%'
              AND ns.nspname <> 'information_schema'
            ORDER BY ns.nspname, src.relname, con.conname;
        """,
    ),
    CatalogQuery(
        name="indexes",
        description="Index names and PostgreSQL-rendered definitions.",
        sql="""
            SELECT
              i.schemaname AS table_schema,
              i.tablename AS table_name,
              i.indexname AS index_name,
              i.indexdef AS index_definition
            FROM pg_catalog.pg_indexes i
            WHERE i.schemaname NOT LIKE 'pg_%'
              AND i.schemaname <> 'information_schema'
            ORDER BY i.schemaname, i.tablename, i.indexname;
        """,
    ),
    CatalogQuery(
        name="triggers",
        description="Non-internal triggers and definitions.",
        sql="""
            SELECT
              n.nspname AS table_schema,
              c.relname AS table_name,
              t.tgname AS trigger_name,
              pg_catalog.pg_get_triggerdef(t.oid, true) AS trigger_definition
            FROM pg_catalog.pg_trigger t
            JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE NOT t.tgisinternal
              AND n.nspname NOT LIKE 'pg_%'
              AND n.nspname <> 'information_schema'
            ORDER BY n.nspname, c.relname, t.tgname;
        """,
    ),
    CatalogQuery(
        name="views",
        description="Views and view definitions.",
        sql="""
            SELECT
              v.table_schema,
              v.table_name,
              v.view_definition
            FROM information_schema.views v
            WHERE v.table_schema NOT LIKE 'pg_%'
              AND v.table_schema <> 'information_schema'
            ORDER BY v.table_schema, v.table_name;
        """,
    ),
    CatalogQuery(
        name="grants",
        description="Table privileges from information_schema.",
        sql="""
            SELECT
              p.table_schema,
              p.table_name,
              p.grantee,
              p.privilege_type,
              p.is_grantable
            FROM information_schema.table_privileges p
            WHERE p.table_schema NOT LIKE 'pg_%'
              AND p.table_schema <> 'information_schema'
            ORDER BY p.table_schema, p.table_name, p.grantee, p.privilege_type;
        """,
    ),
    CatalogQuery(
        name="row_counts",
        description="Approximate table row counts from pg_stat_user_tables.",
        sql="""
            SELECT
              s.schemaname AS table_schema,
              s.relname AS table_name,
              s.n_live_tup AS approximate_live_rows,
              s.n_dead_tup AS approximate_dead_rows,
              s.last_analyze,
              s.last_autoanalyze,
              s.last_vacuum,
              s.last_autovacuum
            FROM pg_catalog.pg_stat_user_tables s
            ORDER BY s.schemaname, s.relname;
        """,
    ),
)


def capture_schema_metadata(database_url: str) -> dict[str, JSONValue]:
    engine = create_engine(async_database_url(database_url), pool_pre_ping=True)
    try:
        with engine.connect() as connection:
            sections = _capture_sections(connection)
    finally:
        engine.dispose()

    table_checksums = _build_sanitized_table_checksums(sections)
    fingerprint_payload: dict[str, JSONValue] = {
        "captureVersion": CAPTURE_VERSION,
        "sections": sections,
        "sanitizedTableChecksums": table_checksums,
    }
    return {
        "captureVersion": CAPTURE_VERSION,
        "capturedAtUtc": _utc_now_iso(),
        "readOnly": True,
        "sections": sections,
        "sanitizedTableChecksums": table_checksums,
        "fingerprintSha256": _sha256_json(fingerprint_payload),
    }


def _capture_sections(connection: Connection) -> dict[str, list[dict[str, JSONValue]]]:
    transaction = connection.begin()
    try:
        connection.execute(text("SET TRANSACTION READ ONLY"))
        sections: dict[str, list[dict[str, JSONValue]]] = {}
        for query in READ_ONLY_QUERIES:
            result = connection.execute(text(query.sql))
            sections[query.name] = [
                {str(key): _json_safe(value) for key, value in row.items()}
                for row in result.mappings().all()
            ]
        transaction.rollback()
        return sections
    except BaseException:
        transaction.rollback()
        raise


def _build_sanitized_table_checksums(
    sections: Mapping[str, list[dict[str, JSONValue]]],
) -> list[dict[str, JSONValue]]:
    tables = sorted(
        (
            str(row["table_schema"]),
            str(row["table_name"]),
        )
        for row in sections.get("tables", [])
        if row.get("table_type") == "BASE TABLE"
    )
    checksums: list[dict[str, JSONValue]] = []
    for table_schema, table_name in tables:
        payload: dict[str, JSONValue] = {
            "columns": _rows_for_table(sections.get("columns", []), table_schema, table_name),
            "constraints": _rows_for_table(
                sections.get("constraints", []), table_schema, table_name
            ),
            "foreignKeys": _rows_for_table(
                sections.get("foreign_keys", []), table_schema, table_name
            ),
            "indexes": _rows_for_table(sections.get("indexes", []), table_schema, table_name),
            "rowCounts": _rows_for_table(sections.get("row_counts", []), table_schema, table_name),
            "triggers": _rows_for_table(sections.get("triggers", []), table_schema, table_name),
        }
        checksums.append(
            {
                "tableSchema": table_schema,
                "tableName": table_name,
                "checksumSha256": _sha256_json(payload),
                "includesRowData": False,
            }
        )
    return checksums


def _rows_for_table(
    rows: list[dict[str, JSONValue]],
    table_schema: str,
    table_name: str,
) -> list[dict[str, JSONValue]]:
    return [
        row
        for row in rows
        if row.get("table_schema") == table_schema and row.get("table_name") == table_name
    ]


def _json_safe(value: Any) -> JSONValue:
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.isoformat()
        return value.astimezone(UTC).isoformat().replace("+00:00", "Z")
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    if isinstance(value, Mapping):
        return {str(key): _json_safe(item) for key, item in value.items()}
    return str(value)


def _sha256_json(payload: Mapping[str, JSONValue] | list[dict[str, JSONValue]]) -> str:
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return sha256(canonical.encode("utf-8")).hexdigest()


def _utc_now_iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Capture sanitized PostgreSQL schema metadata using read-only catalog queries."
    )
    parser.add_argument(
        "--database-url",
        default="",
        help="PostgreSQL URL. It is used for connection only and is never emitted.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Optional JSON output path. If omitted, JSON is printed to stdout.",
    )
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON output.")
    args = parser.parse_args(argv)

    database_url = args.database_url or _database_url_from_environment(os.environ)
    capture = capture_schema_metadata(str(database_url))
    json_text = json.dumps(
        capture,
        ensure_ascii=False,
        indent=2 if args.pretty else None,
        sort_keys=True,
    )
    if args.output is None:
        print(json_text)
    else:
        args.output.write_text(json_text + "\n", encoding="utf-8")
    return 0


def _database_url_from_environment(environ: Mapping[str, str]) -> str:
    for name in ("DATABASE_URL", "DATABASE_URL_DEV", "DATABASE_URL_PROD"):
        value = environ.get(name)
        if value and value.strip():
            return value.strip()
    raise RuntimeError("DATABASE_URL ausente para schema capture Python.")


if __name__ == "__main__":
    raise SystemExit(main())
