from __future__ import annotations

from dataclasses import dataclass, replace
from typing import TYPE_CHECKING, Iterable

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.engine import Connection

from silo.db.models import legacy_tables

if TYPE_CHECKING:
    from silo.config import Settings


class AssistantDisabledError(PermissionError):
    """Raised before model or tool execution when the user disabled the assistant."""

    code = "AI_ASSISTANT_DISABLED"

    def __init__(self, message: str = "Assistente de IA desabilitado nas preferências do usuário."):
        super().__init__(message)


@dataclass(frozen=True, slots=True)
class AiCapabilityPolicy:
    assistant_enabled: bool
    mcp_enabled: bool
    custom_model_enabled: bool
    allowed_mcp_tools: frozenset[str]
    model_name: str

    def with_allowed_mcp_tools(self, permitted_tools: Iterable[str]) -> AiCapabilityPolicy:
        """Reduce MCP capability to the intersection of approved and permitted tools."""
        permitted = frozenset(tool for tool in permitted_tools if isinstance(tool, str))
        return replace(
            self,
            allowed_mcp_tools=self.allowed_mcp_tools.intersection(permitted),
            mcp_enabled=self.mcp_enabled and bool(self.allowed_mcp_tools.intersection(permitted)),
        )


def resolve_ai_capability_policy(
    connection: Connection,
    user_id: str,
    settings: Settings,
) -> AiCapabilityPolicy:
    """Resolve user and server capability gates before constructing an AI runtime."""
    preferences_table = legacy_tables["user_preferences"]
    try:
        row = (
            connection.execute(
                select(preferences_table)
                .where(preferences_table.c.user_id == user_id)
                .limit(1)
            )
            .mappings()
            .first()
        )
    except SQLAlchemyError:
        # Older test fixtures and rolling deployments may not have the new row
        # yet; retain the safe defaults while the migration is applied.
        row = None

    assistant_enabled = _bool_value(row, "ai_enabled", default=True)
    user_mcp_enabled = _bool_value(row, "mcp_enabled", default=False)
    user_custom_model_enabled = _bool_value(row, "custom_model_enabled", default=False)

    approved_mcp_tools = frozenset(
        tool.strip()
        for tool in getattr(settings, "ai_mcp_allowed_tools", ())
        if isinstance(tool, str) and tool.strip()
    )
    mcp_enabled = assistant_enabled and user_mcp_enabled and bool(
        getattr(settings, "ai_mcp_enabled", False)
    )
    allowed_mcp_tools = approved_mcp_tools if mcp_enabled else frozenset()

    default_model = str(getattr(getattr(settings, "vllm", None), "model", ""))
    approved_custom_model = str(getattr(settings, "ai_custom_model", "")).strip()
    custom_model_enabled = (
        assistant_enabled
        and user_custom_model_enabled
        and bool(getattr(settings, "ai_custom_model_enabled", False))
        and bool(approved_custom_model)
    )

    return AiCapabilityPolicy(
        assistant_enabled=assistant_enabled,
        mcp_enabled=mcp_enabled,
        custom_model_enabled=custom_model_enabled,
        allowed_mcp_tools=allowed_mcp_tools,
        model_name=approved_custom_model if custom_model_enabled else default_model,
    )


def _bool_value(row: object, key: str, *, default: bool) -> bool:
    if row is None:
        return default
    value = row.get(key) if hasattr(row, "get") else None
    return value if isinstance(value, bool) else default
