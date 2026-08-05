from __future__ import annotations

from uuid import UUID

import pytest

from silo.db import seed


def test_seed_contract_keeps_legacy_help_id_and_product_slugs() -> None:
    assert seed.HELP_ID == "system-help"
    assert [product.slug for product in seed.PRODUCTS] == [
        "bam",
        "smec",
        "brams-ams-15km",
        "wrf",
    ]


def test_seed_permissions_are_deduplicated_before_database_insert() -> None:
    admin_permission_keys = {
        (permission.resource, permission.action) for permission in seed.ADMIN_GROUP_PERMISSIONS
    }

    assert len(admin_permission_keys) == len(seed.ADMIN_GROUP_PERMISSIONS)
    assert ("help", "manage") in admin_permission_keys
    assert ("chat", "send_group_all") in admin_permission_keys


def test_seed_stable_uuid_is_deterministic() -> None:
    first = seed._stable_uuid("group-permission:group-administradores:help:view")
    second = seed._stable_uuid("group-permission:group-administradores:help:view")

    assert isinstance(first, UUID)
    assert first == second


def test_seed_refuses_production_without_explicit_flag() -> None:
    with pytest.raises(RuntimeError, match="produção"):
        seed.validate_seed_target(
            "postgresql://silo:silo@localhost:5432/silo",
            environ={"SILO_ENV": "production"},
            allow_production=False,
        )


def test_seed_refuses_administrative_database() -> None:
    with pytest.raises(RuntimeError, match="administrativo"):
        seed.validate_seed_target(
            "postgresql://silo:silo@localhost:5432/postgres",
            environ={"SILO_ENV": "development"},
            allow_production=False,
        )
