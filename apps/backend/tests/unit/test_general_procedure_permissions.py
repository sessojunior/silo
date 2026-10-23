from __future__ import annotations

from silo.api.dependencies import has_permission
from silo.api.routers.groups import DEFAULT_GROUP_PERMISSIONS


def test_manage_permission_implies_view_for_general_procedures() -> None:
    assert has_permission({"procedures": {"manage"}}, "procedures", "view")
    assert has_permission({"procedures": {"manage"}}, "procedures", "manage")


def test_default_groups_can_view_general_procedures() -> None:
    assert ("procedures", "view") in DEFAULT_GROUP_PERMISSIONS
    assert ("procedures", "manage") not in DEFAULT_GROUP_PERMISSIONS
