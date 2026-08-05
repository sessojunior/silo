from __future__ import annotations

import asyncio

from sqlalchemy import create_engine, text

from silo.db.migration_state import EXPECTED_ALEMBIC_HEADS
from silo.db.url import sqlalchemy_database_url


async def check_database_ready(database_url: str) -> None:
    await asyncio.to_thread(_check_database_ready_sync, database_url)


def _check_database_ready_sync(database_url: str) -> None:
    engine = create_engine(sqlalchemy_database_url(database_url), pool_pre_ping=True)
    try:
        with engine.connect() as connection:
            connection.execute(text("select 1"))
            result = connection.execute(text("select version_num from alembic_version"))
            observed_heads = {str(row[0]) for row in result}
            expected_heads = set(EXPECTED_ALEMBIC_HEADS)
            if observed_heads != expected_heads:
                raise RuntimeError(
                    "database schema is not at expected Alembic head "
                    f"(expected={sorted(expected_heads)}, observed={sorted(observed_heads)})"
                )
    finally:
        engine.dispose()
