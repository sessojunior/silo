from __future__ import annotations

import os
import sys
from collections.abc import Mapping, Sequence
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text

from silo.db.migration_state import EXPECTED_ALEMBIC_HEADS, MIGRATION_ADVISORY_LOCK_ID
from silo.db.url import sqlalchemy_database_url


def run_migrations(database_url: str) -> None:
    engine = create_engine(sqlalchemy_database_url(database_url), pool_pre_ping=True)
    try:
        with engine.connect() as connection:
            connection.execute(
                text("select pg_advisory_lock(:lock_id)"),
                {"lock_id": MIGRATION_ADVISORY_LOCK_ID},
            )
            try:
                config = alembic_config()
                command.upgrade(config, "head")
                command.check(config)
                result = connection.execute(text("select version_num from alembic_version"))
                observed_heads = {str(row[0]) for row in result}
                expected_heads = set(EXPECTED_ALEMBIC_HEADS)
                if observed_heads != expected_heads:
                    raise RuntimeError(
                        "Alembic head mismatch after migration "
                        f"(expected={sorted(expected_heads)}, observed={sorted(observed_heads)})"
                    )
            finally:
                connection.execute(
                    text("select pg_advisory_unlock(:lock_id)"),
                    {"lock_id": MIGRATION_ADVISORY_LOCK_ID},
                )
                connection.commit()
    finally:
        engine.dispose()


def alembic_config() -> Config:
    backend_root = Path(__file__).resolve().parents[3]
    config = Config(str(backend_root / "alembic.ini"))
    config.set_main_option("script_location", str(backend_root / "migrations"))
    return config


def database_url_from_environment(environ: Mapping[str, str]) -> str:
    value = environ.get("DATABASE_URL")
    if value and value.strip():
        return value.strip()
    raise RuntimeError("DATABASE_URL ausente para migrate Python.")


def main(argv: Sequence[str] | None = None) -> int:
    if argv is None:
        argv = sys.argv[1:]
    if argv:
        raise RuntimeError("silo.db.migrate nao aceita argumentos posicionais.")
    run_migrations(database_url_from_environment(os.environ))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
