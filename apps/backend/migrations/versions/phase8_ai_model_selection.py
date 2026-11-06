"""Add the approved AI model selection to user preferences."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "phase8_ai_model_selection"
down_revision: str | None = "phase7_ai_preferences"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("user_preferences", sa.Column("model_id", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("user_preferences", "model_id")
