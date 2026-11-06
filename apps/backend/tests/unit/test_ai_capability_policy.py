from __future__ import annotations

from types import SimpleNamespace

import pytest
from sqlalchemy import Boolean, Column, MetaData, String, Table, create_engine, insert

from silo.ai.assistant_capability_policy import (
    AiCapabilityPolicy,
    resolve_ai_capability_policy,
)
from silo.config import load_settings


def _settings(**overrides: object) -> SimpleNamespace:
    values = {
        "ai_mcp_enabled": False,
        "ai_custom_model_enabled": False,
        "ai_custom_model": "",
        "ai_mcp_allowed_tools": (),
        "vllm": SimpleNamespace(model="Qwen/default"),
    }
    values.update(overrides)
    return SimpleNamespace(**values)


@pytest.fixture
def preferences_connection(monkeypatch):
    from silo.ai import assistant_capability_policy as policy_module

    metadata = MetaData()
    table = Table(
        "user_preferences",
        metadata,
        Column("user_id", String, nullable=False),
        Column("ai_enabled", Boolean, nullable=False),
        Column("mcp_enabled", Boolean, nullable=False),
        Column("custom_model_enabled", Boolean, nullable=False),
        Column("model_id", String, nullable=True),
    )
    engine = create_engine("sqlite://")
    metadata.create_all(engine)
    connection = engine.connect()
    monkeypatch.setitem(policy_module.legacy_tables, "user_preferences", table)
    yield connection, table
    connection.close()


def test_disabled_user_blocks_all_ai_capabilities(preferences_connection) -> None:
    connection, table = preferences_connection
    connection.execute(
        insert(table).values(
            user_id="user-1",
            ai_enabled=False,
            mcp_enabled=True,
            custom_model_enabled=True,
        )
    )

    policy = resolve_ai_capability_policy(connection, "user-1", _settings())

    assert policy == AiCapabilityPolicy(
        assistant_enabled=False,
        mcp_enabled=False,
        custom_model_enabled=False,
        allowed_mcp_tools=frozenset(),
        model_name="Qwen/default",
    )


def test_mcp_uses_global_enablement_and_approved_tools_without_user_preference(
    preferences_connection,
) -> None:
    connection, table = preferences_connection
    connection.execute(
        insert(table).values(
            user_id="user-1",
            ai_enabled=True,
            mcp_enabled=False,
            custom_model_enabled=False,
        )
    )

    policy = resolve_ai_capability_policy(
        connection,
        "user-1",
        _settings(ai_mcp_enabled=True, ai_mcp_allowed_tools=("procedure.read",)),
    )

    assert policy.assistant_enabled is True
    assert policy.mcp_enabled is True
    assert policy.allowed_mcp_tools == frozenset({"procedure.read"})


def test_selected_model_falls_back_to_default_until_approved(
    preferences_connection,
) -> None:
    connection, table = preferences_connection
    connection.execute(
        insert(table).values(
            user_id="user-1",
            ai_enabled=True,
            mcp_enabled=False,
            custom_model_enabled=False,
            model_id="silo-approved-v1",
        )
    )

    disabled = resolve_ai_capability_policy(connection, "user-1", _settings())
    enabled = resolve_ai_capability_policy(
        connection,
        "user-1",
        _settings(ai_custom_model_enabled=True, ai_custom_model="silo-approved-v1"),
    )

    assert disabled.custom_model_enabled is False
    assert disabled.model_name == "Qwen/default"
    assert enabled.custom_model_enabled is True
    assert enabled.model_name == "silo-approved-v1"


def test_policy_can_only_reduce_approved_mcp_tools() -> None:
    policy = AiCapabilityPolicy(
        assistant_enabled=True,
        mcp_enabled=True,
        custom_model_enabled=False,
        allowed_mcp_tools=frozenset({"procedure.read", "report.read"}),
        model_name="Qwen/default",
    )

    reduced = policy.with_allowed_mcp_tools({"procedure.read"})

    assert reduced.allowed_mcp_tools == frozenset({"procedure.read"})
    assert reduced.mcp_enabled is True


def test_global_capability_settings_are_disabled_by_default() -> None:
    settings = load_settings(
        {
            "SILO_ENV": "test",
            "DATABASE_URL": "postgresql://test-user:test-pass@localhost:5432/silo",
        }
    )

    assert settings.ai_mcp_enabled is False
    assert settings.ai_custom_model_enabled is False
    assert settings.ai_custom_model == ""
    assert settings.ai_mcp_allowed_tools == ()
