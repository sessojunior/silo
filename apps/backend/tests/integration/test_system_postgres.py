from __future__ import annotations

import os

import pytest
from sqlalchemy import create_engine

from silo.api.dependencies import get_user_groups, is_admin
from silo.db.url import sqlalchemy_database_url


def test_check_admin_group_lookup_uses_real_postgresql_fixture() -> None:
    database_url = os.environ.get("SILO_SYSTEM_INTEGRATION_DATABASE_URL")
    if not database_url:
        pytest.skip("Defina SILO_SYSTEM_INTEGRATION_DATABASE_URL para validar PostgreSQL real.")

    engine = create_engine(sqlalchemy_database_url(database_url), pool_pre_ping=True)
    try:
        with engine.connect() as connection:
            admin_groups = get_user_groups(connection, "fixture-user-admin")
            no_permission_groups = get_user_groups(connection, "fixture-user-no-permission")
    finally:
        engine.dispose()

    assert is_admin(admin_groups)
    assert not is_admin(no_permission_groups)
    assert {group.id for group in admin_groups} == {"fixture-group-admin"}
    assert {group.id for group in no_permission_groups} == {"fixture-group-no-permission"}
