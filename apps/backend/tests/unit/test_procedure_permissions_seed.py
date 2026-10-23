from __future__ import annotations

from silo.db import seed


def test_seed_grants_procedure_visibility_to_default_groups() -> None:
    permissions = {(item.resource, item.action) for item in seed.DEFAULT_GROUP_PERMISSIONS}

    assert ("procedures", "view") in permissions
    assert ("procedures", "manage") not in permissions


def test_seed_grants_procedure_management_to_administrators() -> None:
    permissions = {(item.resource, item.action) for item in seed.ADMIN_GROUP_PERMISSIONS}

    assert {("procedures", "view"), ("procedures", "manage")}.issubset(permissions)
