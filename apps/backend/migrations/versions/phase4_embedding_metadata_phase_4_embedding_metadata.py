"""Add provenance metadata for knowledge embeddings.

Revision ID: phase4_embedding_metadata
Revises: phase3_artifact
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "phase4_embedding_metadata"
down_revision: str | None = "phase3_artifact"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TABLES = ("help", "product_problem", "product_solution", "product_manual_chunk")


def upgrade() -> None:
    for table_name in _TABLES:
        op.add_column(table_name, sa.Column("embedding_model", sa.Text(), nullable=True))
        op.add_column(table_name, sa.Column("embedding_digest", sa.Text(), nullable=True))
        op.add_column(table_name, sa.Column("embedding_content_hash", sa.Text(), nullable=True))
        op.add_column(
            table_name,
            sa.Column("embedding_updated_at", sa.DateTime(), nullable=True),
        )


def downgrade() -> None:
    for table_name in reversed(_TABLES):
        op.drop_column(table_name, "embedding_updated_at")
        op.drop_column(table_name, "embedding_content_hash")
        op.drop_column(table_name, "embedding_digest")
        op.drop_column(table_name, "embedding_model")
