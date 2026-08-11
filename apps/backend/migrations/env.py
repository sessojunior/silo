from __future__ import annotations

import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool
from sqlalchemy.dialects.postgresql.base import ischema_names

from silo.db.models import Vector768, legacy_metadata
from silo.db.url import sqlalchemy_database_url

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = legacy_metadata
ischema_names["vector"] = Vector768


def _database_url_from_environment() -> str:
    value = os.environ.get("DATABASE_URL")
    if value and value.strip():
        return sqlalchemy_database_url(value.strip())

    raise RuntimeError(
        "DATABASE_URL ausente para Alembic. Configure a variavel DATABASE_URL."
    )


def run_migrations_offline() -> None:
    context.configure(
        url=_database_url_from_environment(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=False,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = _database_url_from_environment()

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=False,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
