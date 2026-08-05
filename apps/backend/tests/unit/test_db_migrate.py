from __future__ import annotations

from silo.db import migrate
from silo.db.migration_state import EXPECTED_ALEMBIC_HEADS, MIGRATION_ADVISORY_LOCK_ID


def test_migration_state_declares_single_expected_head() -> None:
    assert EXPECTED_ALEMBIC_HEADS == ("phase3_artifact",)


def test_migration_uses_stable_postgres_advisory_lock_id() -> None:
    assert isinstance(MIGRATION_ADVISORY_LOCK_ID, int)
    assert 0 < MIGRATION_ADVISORY_LOCK_ID < 2**63


def test_alembic_config_points_to_backend_migrations() -> None:
    config = migrate.alembic_config()

    assert config.config_file_name is not None
    assert config.config_file_name.endswith("alembic.ini")
    assert str(config.get_main_option("script_location")).endswith("migrations")
