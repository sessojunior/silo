"""Add persisted AI capability preferences to users."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "phase7_ai_preferences"
down_revision: str | None = "phase6_procedure_permissions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user_preferences",
        sa.Column("ai_enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False),
    )
    op.add_column(
        "user_preferences",
        sa.Column("mcp_enabled", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.add_column(
        "user_preferences",
        sa.Column(
            "custom_model_enabled",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("user_preferences", "custom_model_enabled")
    op.drop_column("user_preferences", "mcp_enabled")
    op.drop_column("user_preferences", "ai_enabled")
