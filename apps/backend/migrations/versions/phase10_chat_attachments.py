"""Add persisted attachments for chat messages."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "phase10_chat_attachments"
down_revision: str | None = "phase9_remove_user_model_selection"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "chat_message_attachment",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("message_id", sa.UUID(), nullable=False),
        sa.Column("original_name", sa.Text(), nullable=False),
        sa.Column("stored_filename", sa.Text(), nullable=False),
        sa.Column("content_type", sa.Text(), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["message_id"],
            ["chat_message.id"],
            name="chat_message_attachment_message_id_chat_message_id_fk",
            ondelete="cascade",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_chat_message_attachment")),
    )
    op.create_index(
        "idx_chat_message_attachment_message_id",
        "chat_message_attachment",
        ["message_id"],
        unique=False,
        postgresql_using="btree",
    )


def downgrade() -> None:
    op.drop_index(
        "idx_chat_message_attachment_message_id",
        table_name="chat_message_attachment",
        postgresql_using="btree",
    )
    op.drop_table("chat_message_attachment")
