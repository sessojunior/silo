"""Remove per-user AI capability toggles after the global policy decision."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "phase9_remove_user_model_selection"
down_revision: str | None = "phase8_ai_model_selection"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Existing databases were initialized with Alembic's default VARCHAR(32),
    # which is shorter than this revision identifier.  Widen it before Alembic
    # records the new revision at the end of this migration.
    op.alter_column(
        "alembic_version",
        "version_num",
        existing_type=sa.String(length=32),
        type_=sa.String(length=64),
        existing_nullable=False,
    )
    op.drop_column("user_preferences", "model_id")
    op.drop_column("user_preferences", "custom_model_enabled")
    op.drop_column("user_preferences", "mcp_enabled")


def downgrade() -> None:
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
    op.add_column("user_preferences", sa.Column("model_id", sa.Text(), nullable=True))
    op.alter_column(
        "alembic_version",
        "version_num",
        existing_type=sa.String(length=64),
        type_=sa.String(length=32),
        existing_nullable=False,
    )
