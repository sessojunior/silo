"""Add general procedures and searchable attachments."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from silo.db.models import Vector768

revision: str = "phase5_general_procedures"
down_revision: str | None = "phase4_embedding_metadata"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "general_procedure",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("user_id", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("category", sa.Text(), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("embedding", Vector768(), nullable=True),
        sa.Column("embedding_model", sa.Text(), nullable=True),
        sa.Column("embedding_digest", sa.Text(), nullable=True),
        sa.Column("embedding_content_hash", sa.Text(), nullable=True),
        sa.Column("embedding_updated_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["user.id"], name="general_procedure_user_id_user_id_fk"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_general_procedure")),
    )
    op.create_index("idx_general_procedure_active", "general_procedure", ["active"])
    op.create_index("idx_general_procedure_created_at", "general_procedure", ["created_at"])
    op.create_index(
        "idx_general_procedure_embedding",
        "general_procedure",
        ["embedding"],
        postgresql_using="hnsw",
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )

    op.create_table(
        "general_procedure_attachment",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("procedure_id", sa.Text(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("original_name", sa.Text(), nullable=False),
        sa.Column("stored_filename", sa.Text(), nullable=False),
        sa.Column("storage_kind", sa.Text(), nullable=False),
        sa.Column("mime_type", sa.Text(), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.Text(), nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "extraction_status",
            sa.Text(),
            server_default=sa.text("'pending'"),
            nullable=False,
        ),
        sa.Column("extraction_error", sa.Text(), nullable=True),
        sa.Column("image_description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "kind in ('image', 'document')",
            name="general_procedure_attachment_kind_check",
        ),
        sa.CheckConstraint(
            "extraction_status in ('pending', 'processing', 'ready', 'error')",
            name="general_procedure_attachment_status_check",
        ),
        sa.CheckConstraint("size_bytes >= 0", name="general_procedure_attachment_size_check"),
        sa.ForeignKeyConstraint(
            ["procedure_id"],
            ["general_procedure.id"],
            name="general_procedure_attachment_procedure_id_general_procedure_id_fk",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_general_procedure_attachment")),
    )
    op.create_index(
        "idx_general_procedure_attachment_procedure_id",
        "general_procedure_attachment",
        ["procedure_id"],
    )

    op.create_table(
        "general_procedure_attachment_chunk",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("attachment_id", sa.Text(), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=True),
        sa.Column("slide_number", sa.Integer(), nullable=True),
        sa.Column("token_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("embedding", Vector768(), nullable=True),
        sa.Column("embedding_model", sa.Text(), nullable=True),
        sa.Column("embedding_digest", sa.Text(), nullable=True),
        sa.Column("embedding_content_hash", sa.Text(), nullable=True),
        sa.Column("embedding_updated_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["attachment_id"],
            ["general_procedure_attachment.id"],
            name="general_procedure_attachment_chunk_attachment_id_general_procedure_attachment_id_fk",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_general_procedure_attachment_chunk")),
    )
    op.create_index(
        "idx_general_procedure_attachment_chunk_attachment_id",
        "general_procedure_attachment_chunk",
        ["attachment_id"],
    )
    op.create_index(
        "idx_general_procedure_attachment_chunk_embedding",
        "general_procedure_attachment_chunk",
        ["embedding"],
        postgresql_using="hnsw",
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )


def downgrade() -> None:
    op.drop_index(
        "idx_general_procedure_attachment_chunk_embedding",
        table_name="general_procedure_attachment_chunk",
    )
    op.drop_index(
        "idx_general_procedure_attachment_chunk_attachment_id",
        table_name="general_procedure_attachment_chunk",
    )
    op.drop_table("general_procedure_attachment_chunk")
    op.drop_index(
        "idx_general_procedure_attachment_procedure_id",
        table_name="general_procedure_attachment",
    )
    op.drop_table("general_procedure_attachment")
    op.drop_index("idx_general_procedure_embedding", table_name="general_procedure")
    op.drop_index("idx_general_procedure_created_at", table_name="general_procedure")
    op.drop_index("idx_general_procedure_active", table_name="general_procedure")
    op.drop_table("general_procedure")
