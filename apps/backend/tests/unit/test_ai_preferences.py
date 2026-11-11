from __future__ import annotations

import json
from pathlib import Path

import pytest
from starlette.requests import Request

from silo.api.routers import users
from silo.db.models import COLUMN_SERVER_DEFAULTS, legacy_tables
from silo.testing import fixture_api


def test_user_preferences_declares_ai_capability_columns_and_defaults() -> None:
    table = legacy_tables["user_preferences"]

    assert table.c.ai_enabled.type.python_type is bool
    assert "mcp_enabled" not in table.c
    assert "custom_model_enabled" not in table.c
    assert "model_id" not in table.c
    assert COLUMN_SERVER_DEFAULTS[("user_preferences", "ai_enabled")] == "true"
    assert ("user_preferences", "mcp_enabled") not in COLUMN_SERVER_DEFAULTS
    assert ("user_preferences", "custom_model_enabled") not in COLUMN_SERVER_DEFAULTS


def test_ai_preferences_migration_is_chained_from_procedure_permissions() -> None:
    migration = Path(__file__).parents[2] / "migrations" / "versions" / "phase7_ai_preferences.py"
    source = migration.read_text(encoding="utf-8")

    assert 'revision: str = "phase7_ai_preferences"' in source
    assert 'down_revision: str | None = "phase6_procedure_permissions"' in source
    assert '"ai_enabled"' in source


def test_model_selection_cleanup_migration_is_chained_from_model_selection() -> None:
    migration = (
        Path(__file__).parents[2]
        / "migrations"
        / "versions"
        / "phase9_remove_user_model_selection.py"
    )
    source = migration.read_text(encoding="utf-8")

    assert 'revision: str = "phase9_remove_user_model_selection"' in source
    assert 'down_revision: str | None = "phase8_ai_model_selection"' in source
    assert '"model_id"' in source
    assert '"mcp_enabled"' in source
    assert '"custom_model_enabled"' in source


def test_model_selection_cleanup_migration_expands_alembic_revision_column() -> None:
    migration = (
        Path(__file__).parents[2]
        / "migrations"
        / "versions"
        / "phase9_remove_user_model_selection.py"
    )
    source = migration.read_text(encoding="utf-8")

    assert '"alembic_version"' in source
    assert '"version_num"' in source
    assert "op.alter_column(" in source
    assert "sa.String(length=64)" in source


def test_preference_payload_accepts_only_supported_boolean_fields() -> None:
    result = users._parse_preference_updates(
        {
            "chatEnabled": False,
            "aiEnabled": True,
        }
    )

    assert result == {
        "chat_enabled": False,
        "ai_enabled": True,
    }

    assert users._parse_preference_updates({"aiEnabled": False}) == {"ai_enabled": False}


@pytest.mark.parametrize("field", ["mcpEnabled", "customModelEnabled", "modelId"])
def test_preference_payload_rejects_removed_user_capabilities(field: str) -> None:
    with pytest.raises(ValueError, match="Prefer"):
        users._parse_preference_updates({field: False})


@pytest.mark.parametrize(
    "payload",
    [
        {"aiEnabled": "yes"},
        {"unknownPreference": True},
        {},
    ],
)
def test_preference_payload_rejects_invalid_or_empty_updates(payload: dict[str, object]) -> None:
    with pytest.raises(ValueError):
        users._parse_preference_updates(payload)


@pytest.mark.asyncio
async def test_fixture_preferences_put_merges_known_fields_without_erasing_existing_values(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    state = fixture_api.FixtureState()
    monkeypatch.setattr(fixture_api, "state", state)
    user = state.users_by_email["admin@inpe.br"]
    token = state.create_session(user)
    body = json.dumps({"aiEnabled": False}).encode("utf-8")
    consumed = False

    async def receive() -> dict[str, object]:
        nonlocal consumed
        if consumed:
            return {"type": "http.disconnect"}
        consumed = True
        return {"type": "http.request", "body": body, "more_body": False}

    request = Request(
        {
            "type": "http",
            "method": "PUT",
            "path": "/api/admin/users/preferences",
            "headers": [
                (b"content-type", b"application/json"),
                (b"cookie", f"silo_session={token}".encode("ascii")),
            ],
            "query_string": b"",
        },
        receive,
    )

    response = await fixture_api.api_router("admin/users/preferences", request)

    assert response.status_code == 200
    assert user.preferences["aiEnabled"] is False
    assert user.preferences["chatEnabled"] is True
