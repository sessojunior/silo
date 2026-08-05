from __future__ import annotations

from datetime import datetime
from pathlib import Path
from uuid import UUID, uuid5

import pytest
from sqlalchemy import Boolean, Column, DateTime, Integer, JSON, MetaData, String, Table, and_, create_engine, select

from silo.db import seed


def _build_seed_tables(metadata: MetaData) -> dict[str, Table]:
    group_table = Table(
        "group",
        metadata,
        Column("id", String, primary_key=True),
        Column("name", String, nullable=False),
        Column("description", String, nullable=True),
        Column("icon", String, nullable=False),
        Column("color", String, nullable=False),
        Column("role", String, nullable=False),
        Column("active", Boolean, nullable=False),
        Column("is_default", Boolean, nullable=False),
        Column("created_at", DateTime, nullable=True),
        Column("updated_at", DateTime, nullable=True),
    )
    group_permissions_table = Table(
        "group_permissions",
        metadata,
        Column("id", String, primary_key=True),
        Column("group_id", String, nullable=False),
        Column("resource", String, nullable=False),
        Column("action", String, nullable=False),
        Column("created_at", DateTime, nullable=True),
        Column("updated_at", DateTime, nullable=True),
    )
    user_table = Table(
        "user",
        metadata,
        Column("id", String, primary_key=True),
        Column("name", String, nullable=False),
        Column("email", String, nullable=False),
        Column("email_verified", Boolean, nullable=False),
        Column("image", String, nullable=True),
        Column("created_at", DateTime, nullable=True),
        Column("updated_at", DateTime, nullable=True),
        Column("is_active", Boolean, nullable=False),
        Column("last_login", DateTime, nullable=True),
    )
    account_table = Table(
        "account",
        metadata,
        Column("id", String, primary_key=True),
        Column("account_id", String, nullable=False),
        Column("provider_id", String, nullable=False),
        Column("user_id", String, nullable=False),
        Column("access_token", String, nullable=True),
        Column("refresh_token", String, nullable=True),
        Column("id_token", String, nullable=True),
        Column("access_token_expires_at", DateTime, nullable=True),
        Column("refresh_token_expires_at", DateTime, nullable=True),
        Column("scope", String, nullable=True),
        Column("password", String, nullable=True),
        Column("created_at", DateTime, nullable=True),
        Column("updated_at", DateTime, nullable=True),
    )
    user_profile_table = Table(
        "user_profile",
        metadata,
        Column("id", String, primary_key=True),
        Column("user_id", String, nullable=False),
        Column("genre", String, nullable=True),
        Column("phone", String, nullable=True),
        Column("role", String, nullable=True),
        Column("team", String, nullable=True),
        Column("company", String, nullable=True),
        Column("location", String, nullable=True),
    )
    user_preferences_table = Table(
        "user_preferences",
        metadata,
        Column("id", String, primary_key=True),
        Column("user_id", String, nullable=False),
        Column("chat_enabled", Boolean, nullable=False),
    )
    presence_table = Table(
        "chat_user_presence",
        metadata,
        Column("user_id", String, primary_key=True),
        Column("status", String, nullable=False),
    )
    user_group_table = Table(
        "user_group",
        metadata,
        Column("id", String, primary_key=True),
        Column("user_id", String, nullable=False),
        Column("group_id", String, nullable=False),
        Column("joined_at", DateTime, nullable=True),
        Column("created_at", DateTime, nullable=True),
    )
    product_table = Table(
        "product",
        metadata,
        Column("id", String, primary_key=True),
        Column("name", String, nullable=False),
        Column("slug", String, nullable=False),
        Column("available", Boolean, nullable=False),
        Column("priority", String, nullable=False),
        Column("turns", JSON, nullable=False),
        Column("description", String, nullable=False),
        Column("data_product_flow", JSON, nullable=False),
    )
    contact_table = Table(
        "contact",
        metadata,
        Column("id", String, primary_key=True),
        Column("name", String, nullable=False),
        Column("role", String, nullable=False),
        Column("team", String, nullable=False),
        Column("email", String, nullable=False),
        Column("phone", String, nullable=False),
        Column("image", String, nullable=True),
        Column("active", Boolean, nullable=False),
    )
    product_contact_table = Table(
        "product_contact",
        metadata,
        Column("id", String, primary_key=True),
        Column("product_id", String, nullable=False),
        Column("contact_id", String, nullable=False),
    )
    problem_category_table = Table(
        "product_problem_category",
        metadata,
        Column("id", String, primary_key=True),
        Column("name", String, nullable=False),
        Column("color", String, nullable=False),
        Column("is_system", Boolean, nullable=False),
        Column("sort_order", Integer, nullable=False),
    )
    help_table = Table(
        "help",
        metadata,
        Column("id", String, primary_key=True),
        Column("description", String, nullable=False),
    )
    product_manual_table = Table(
        "product_manual",
        metadata,
        Column("id", String, primary_key=True),
        Column("product_id", String, nullable=False),
        Column("description", String, nullable=False),
    )
    product_manual_chunk_table = Table(
        "product_manual_chunk",
        metadata,
        Column("id", String, primary_key=True),
        Column("product_manual_id", String, nullable=False),
        Column("product_id", String, nullable=False),
        Column("chunk_index", Integer, nullable=False),
        Column("content", String, nullable=False),
        Column("token_count", Integer, nullable=False),
    )
    project_table = Table(
        "project",
        metadata,
        Column("id", String, primary_key=True),
        Column("name", String, nullable=False),
        Column("short_description", String, nullable=True),
        Column("description", String, nullable=True),
        Column("start_date", String, nullable=True),
        Column("end_date", String, nullable=True),
        Column("priority", String, nullable=True),
        Column("status", String, nullable=True),
    )
    project_activity_table = Table(
        "project_activity",
        metadata,
        Column("id", String, primary_key=True),
        Column("project_id", String, nullable=False),
        Column("name", String, nullable=True),
        Column("description", String, nullable=True),
        Column("category", String, nullable=True),
        Column("estimated_days", Integer, nullable=True),
        Column("start_date", String, nullable=True),
        Column("end_date", String, nullable=True),
        Column("priority", String, nullable=True),
        Column("status", String, nullable=True),
    )
    project_task_table = Table(
        "project_task",
        metadata,
        Column("id", String, primary_key=True),
        Column("project_id", String, nullable=False),
        Column("project_activity_id", String, nullable=True),
        Column("name", String, nullable=True),
        Column("description", String, nullable=True),
        Column("category", String, nullable=True),
        Column("estimated_days", Integer, nullable=True),
        Column("start_date", String, nullable=True),
        Column("end_date", String, nullable=True),
        Column("priority", String, nullable=True),
        Column("status", String, nullable=True),
        Column("sort", Integer, nullable=True),
    )
    project_task_user_table = Table(
        "project_task_user",
        metadata,
        Column("id", String, primary_key=True),
        Column("task_id", String, nullable=False),
        Column("user_id", String, nullable=False),
        Column("role", String, nullable=False),
    )
    return {
        "group": group_table,
        "group_permissions": group_permissions_table,
        "user": user_table,
        "account": account_table,
        "user_profile": user_profile_table,
        "user_preferences": user_preferences_table,
        "chat_user_presence": presence_table,
        "user_group": user_group_table,
        "product": product_table,
        "contact": contact_table,
        "product_contact": product_contact_table,
        "product_problem_category": problem_category_table,
        "help": help_table,
        "product_manual": product_manual_table,
        "product_manual_chunk": product_manual_chunk_table,
        "project": project_table,
        "project_activity": project_activity_table,
        "project_task": project_task_table,
        "project_task_user": project_task_user_table,
    }


def _fake_insert_do_nothing(connection, table: Table, values: dict[str, object], *, constraint: str | None = None) -> bool:  # noqa: ARG001
    normalized_values: dict[str, object] = {}
    for column_name, value in values.items():
        if isinstance(value, UUID):
            normalized_values[column_name] = str(value)
        else:
            normalized_values[column_name] = value

    criteria = []
    for column_name, value in normalized_values.items():
        column = table.c.get(column_name)
        if column is None or value is None:
            continue
        criteria.append(column == value)
    if criteria:
        existing = connection.execute(
            select(1).select_from(table).where(and_(*criteria)).limit(1)
        ).scalar_one_or_none()
        if existing is not None:
            return False
    connection.execute(table.insert().values(normalized_values))
    return True


def test_seed_database_populates_expected_rows_and_is_idempotent(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    database_path = tmp_path / "seed.sqlite"
    database_url = f"sqlite+pysqlite:///{database_path.as_posix()}"
    engine = create_engine(database_url, future=True)
    metadata = MetaData()
    tables = _build_seed_tables(metadata)
    metadata.create_all(engine)

    monkeypatch.setenv("SILO_ENV", "development")
    monkeypatch.setattr(seed, "legacy_tables", tables)
    monkeypatch.setattr(seed, "_insert_do_nothing", _fake_insert_do_nothing)
    monkeypatch.setattr(seed, "_stable_uuid", lambda value: str(uuid5(seed.SEED_NAMESPACE, value)))

    first_summary = seed.seed_database(database_url)
    second_summary = seed.seed_database(database_url)

    assert first_summary.inserted["group"] == len(seed.GROUPS)
    assert first_summary.inserted["group_permissions"] == len(seed.ADMIN_GROUP_PERMISSIONS) + (3 * len(seed.DEFAULT_GROUP_PERMISSIONS))
    assert first_summary.inserted["user"] == len(seed.USERS)
    assert first_summary.inserted["account"] == len(seed.USERS)
    assert first_summary.inserted["user_profile"] == 1
    assert first_summary.inserted["user_preferences"] == len(seed.USERS)
    assert first_summary.inserted["chat_user_presence"] == len(seed.USERS)
    assert first_summary.inserted["user_group"] == 6
    assert first_summary.inserted["product"] == len(seed.PRODUCTS)
    assert first_summary.inserted["contact"] == len(seed.CONTACTS)
    assert first_summary.inserted["product_contact"] == len(seed.PRODUCTS) * len(seed.CONTACTS)
    assert first_summary.inserted["product_problem_category"] == len(seed.PROBLEM_CATEGORIES)
    assert first_summary.inserted["help"] == 1
    assert first_summary.inserted["product_manual"] == len(seed.MANUALS)
    assert first_summary.inserted["product_manual_chunk"] == len(seed.MANUALS) * 2
    assert first_summary.inserted["project"] == 1
    assert first_summary.inserted["project_activity"] == 1
    assert first_summary.inserted["project_task"] == 1
    assert first_summary.inserted["project_task_user"] == 1

    assert second_summary.existing["group"] == len(seed.GROUPS)
    assert second_summary.existing["group_permissions"] == len(seed.ADMIN_GROUP_PERMISSIONS) + (3 * len(seed.DEFAULT_GROUP_PERMISSIONS))
    assert second_summary.existing["user"] == len(seed.USERS)
    assert second_summary.existing["account"] == len(seed.USERS)
    assert second_summary.existing["user_profile"] == 1
    assert second_summary.existing["user_preferences"] == len(seed.USERS)
    assert second_summary.existing["chat_user_presence"] == len(seed.USERS)
    assert second_summary.existing["user_group"] == 6
    assert second_summary.existing["product"] == len(seed.PRODUCTS)
    assert second_summary.existing["contact"] == len(seed.CONTACTS)
    assert second_summary.existing["product_contact"] == len(seed.PRODUCTS) * len(seed.CONTACTS)
    assert second_summary.existing["product_problem_category"] == len(seed.PROBLEM_CATEGORIES)
    assert second_summary.existing["help"] == 1
    assert second_summary.existing["product_manual"] == len(seed.MANUALS)
    assert second_summary.existing["product_manual_chunk"] == len(seed.MANUALS)
    assert second_summary.existing["project"] == 1
    assert second_summary.existing["project_activity"] == 1
    assert second_summary.existing["project_task"] == 1
    assert second_summary.existing["project_task_user"] == 1

    with engine.connect() as connection:
        group_count = connection.execute(select(seed.legacy_tables["group"].c.id)).all()
        help_row = connection.execute(select(tables["help"].c.description).where(tables["help"].c.id == seed.HELP_ID)).scalar_one()
        manual_count = connection.execute(select(tables["product_manual_chunk"].c.id)).all()

    assert len(group_count) == len(seed.GROUPS)
    assert help_row == seed.HELP_DOCUMENTATION
    assert len(manual_count) == len(seed.MANUALS) * 2


def test_seed_helpers_cover_environment_and_chunk_parsing(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    assert seed._manual_chunks("Uma parte\n\nOutra parte") == ("Uma parte", "Outra parte")

    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///test.db")
    assert seed._database_url_from_environment({"DATABASE_URL": "sqlite+pysqlite:///test.db"}) == "sqlite+pysqlite:///test.db"

    args = seed._parse_args(["--database-url", "sqlite+pysqlite:///test.db", "--allow-production"])
    assert args.database_url == "sqlite+pysqlite:///test.db"
    assert args.allow_production is True
