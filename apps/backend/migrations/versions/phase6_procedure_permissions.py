"""Backfill procedure visibility for existing groups."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "phase6_procedure_permissions"
down_revision: str | None = "phase5_general_procedures"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            INSERT INTO group_permissions
                (id, group_id, resource, action, created_at, updated_at)
            SELECT gen_random_uuid(), groups.id, 'procedures', 'view', now(), now()
            FROM "group" AS groups
            WHERE NOT EXISTS (
                SELECT 1
                FROM group_permissions AS permissions
                WHERE permissions.group_id = groups.id
                  AND permissions.resource = 'procedures'
                  AND permissions.action = 'view'
            )
            """
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            DELETE FROM group_permissions
            WHERE resource = 'procedures' AND action = 'view'
            """
        )
    )
