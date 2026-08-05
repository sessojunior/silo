from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy import (
    text as sql_text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.types import TypeEngine, UserDefinedType

PGVECTOR_DIMENSIONS = 768

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

legacy_metadata = MetaData(naming_convention=NAMING_CONVENTION)

type ColumnSpec = tuple[str, str, bool, bool]
type TableColumnsSpec = tuple[str, tuple[ColumnSpec, ...]]


@dataclass(frozen=True, slots=True)
class NameMapping:
    python_name: str
    physical_name: str


@dataclass(frozen=True, slots=True)
class ForeignKeySpec:
    column_name: str
    referred_table_name: str
    referred_column_name: str
    constraint_name: str
    ondelete: str | None = None


@dataclass(frozen=True, slots=True)
class UniqueConstraintSpec:
    constraint_name: str
    column_names: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class IndexSpec:
    index_name: str
    table_name: str
    column_names: tuple[str, ...]
    postgresql_using: str = "btree"
    postgresql_ops: tuple[tuple[str, str], ...] = ()


@dataclass(frozen=True, slots=True)
class CheckConstraintSpec:
    constraint_name: str
    sql_text: str


type TableColumnNameMappings = tuple[str, tuple[NameMapping, ...]]


class Vector768(UserDefinedType[object]):
    cache_ok = True

    def __init__(self, *_: Any, **__: Any) -> None:
        super().__init__()

    def get_col_spec(self, **_: Any) -> str:
        return f"vector({PGVECTOR_DIMENSIONS})"


TABLE_COLUMN_SPECS: tuple[TableColumnsSpec, ...] = (
    (
        "group",
        (
            ("id", "text", True, True),
            ("name", "text", False, True),
            ("description", "text", False, False),
            ("icon", "text", False, True),
            ("color", "text", False, True),
            ("role", "text", False, True),
            ("active", "boolean", False, True),
            ("is_default", "boolean", False, True),
            ("created_at", "timestamp", False, True),
            ("updated_at", "timestamp", False, True),
        ),
    ),
    (
        "user_group",
        (
            ("id", "uuid", True, True),
            ("user_id", "text", False, True),
            ("group_id", "text", False, True),
            ("joined_at", "timestamp", False, True),
            ("created_at", "timestamp", False, True),
        ),
    ),
    (
        "group_permissions",
        (
            ("id", "uuid", True, True),
            ("group_id", "text", False, True),
            ("resource", "text", False, True),
            ("action", "text", False, True),
            ("created_at", "timestamp", False, True),
            ("updated_at", "timestamp", False, True),
        ),
    ),
    (
        "user",
        (
            ("id", "text", True, True),
            ("name", "text", False, True),
            ("email", "text", False, True),
            ("email_verified", "boolean", False, True),
            ("image", "text", False, False),
            ("created_at", "timestamp", False, True),
            ("updated_at", "timestamp", False, True),
            ("is_active", "boolean", False, True),
            ("last_login", "timestamp", False, False),
        ),
    ),
    (
        "session",
        (
            ("id", "text", True, True),
            ("expires_at", "timestamp", False, True),
            ("token", "text", False, True),
            ("created_at", "timestamp", False, True),
            ("updated_at", "timestamp", False, True),
            ("ip_address", "text", False, False),
            ("user_agent", "text", False, False),
            ("user_id", "text", False, True),
        ),
    ),
    (
        "account",
        (
            ("id", "text", True, True),
            ("account_id", "text", False, True),
            ("provider_id", "text", False, True),
            ("user_id", "text", False, True),
            ("access_token", "text", False, False),
            ("refresh_token", "text", False, False),
            ("id_token", "text", False, False),
            ("access_token_expires_at", "timestamp", False, False),
            ("refresh_token_expires_at", "timestamp", False, False),
            ("scope", "text", False, False),
            ("password", "text", False, False),
            ("created_at", "timestamp", False, True),
            ("updated_at", "timestamp", False, True),
        ),
    ),
    (
        "verification",
        (
            ("id", "text", True, True),
            ("identifier", "text", False, True),
            ("value", "text", False, True),
            ("expires_at", "timestamp", False, True),
            ("created_at", "timestamp", False, False),
            ("updated_at", "timestamp", False, False),
        ),
    ),
    (
        "rate_limit",
        (
            ("id", "text", True, True),
            ("route", "text", False, True),
            ("email", "text", False, True),
            ("ip", "text", False, True),
            ("count", "integer", False, True),
            ("last_request", "timestamp", False, True),
        ),
    ),
    (
        "user_profile",
        (
            ("id", "text", True, True),
            ("user_id", "text", False, True),
            ("genre", "text", False, True),
            ("phone", "text", False, True),
            ("role", "text", False, True),
            ("team", "text", False, True),
            ("company", "text", False, True),
            ("location", "text", False, True),
        ),
    ),
    (
        "user_preferences",
        (
            ("id", "text", True, True),
            ("user_id", "text", False, True),
            ("chat_enabled", "boolean", False, True),
        ),
    ),
    (
        "product",
        (
            ("id", "text", True, True),
            ("name", "text", False, True),
            ("slug", "text", False, True),
            ("available", "boolean", False, True),
            ("priority", "text", False, True),
            ("turns", "jsonb", False, True),
            ("description", "text", False, False),
            ("url_product_flow", "text", False, False),
            ("data_product_flow", "jsonb", False, True),
        ),
    ),
    (
        "product_availability_exception",
        (
            ("id", "uuid", True, True),
            ("product_id", "text", False, True),
            ("date", "date", False, True),
            ("type", "text", False, True),
            ("description", "text", False, False),
            ("created_at", "timestamp", False, True),
            ("updated_at", "timestamp", False, True),
        ),
    ),
    (
        "picture_page",
        (
            ("id", "text", True, True),
            ("slug", "text", False, False),
            ("name", "text", False, True),
            ("url", "text", False, True),
            ("description", "text", False, False),
            ("check_mode", "text", False, True),
            ("status", "text", False, True),
            ("delay", "text", False, False),
            ("delay_minutes", "integer", False, False),
            ("delayed_links", "integer", False, True),
            ("offline_links", "integer", False, True),
            ("created_at", "timestamp", False, True),
            ("updated_at", "timestamp", False, True),
        ),
    ),
    (
        "picture_link",
        (
            ("id", "text", True, True),
            ("page_id", "text", False, True),
            ("slug", "text", False, False),
            ("name", "text", False, False),
            ("url", "text", False, True),
            ("size", "text", False, False),
            ("last_update", "timestamp", False, False),
            ("delay", "text", False, False),
            ("delay_minutes", "integer", False, False),
            ("status", "text", False, True),
            ("created_at", "timestamp", False, True),
        ),
    ),
    (
        "radar_group",
        (
            ("id", "text", True, True),
            ("slug", "text", False, False),
            ("name", "text", False, True),
            ("sort_order", "integer", False, True),
            ("created_at", "timestamp", False, True),
            ("updated_at", "timestamp", False, True),
        ),
    ),
    (
        "radar",
        (
            ("id", "text", True, True),
            ("group_id", "text", False, True),
            ("slug", "text", False, False),
            ("name", "text", False, True),
            ("description", "text", False, False),
            ("webhook_url", "text", False, False),
            ("log_url", "text", False, False),
            ("status", "text", False, True),
            ("delay", "text", False, False),
            ("delay_minutes", "integer", False, False),
            ("log_date", "timestamp", False, False),
            ("active", "boolean", False, True),
            ("created_at", "timestamp", False, True),
            ("updated_at", "timestamp", False, True),
        ),
    ),
    (
        "product_problem_category",
        (
            ("id", "text", True, True),
            ("name", "text", False, True),
            ("color", "text", False, False),
            ("is_system", "boolean", False, True),
            ("sort_order", "integer", False, True),
            ("created_at", "timestamp", False, True),
            ("updated_at", "timestamp", False, True),
        ),
    ),
    (
        "product_problem",
        (
            ("id", "text", True, True),
            ("product_id", "text", False, True),
            ("user_id", "text", False, True),
            ("title", "text", False, True),
            ("description", "text", False, True),
            ("created_at", "timestamp", False, True),
            ("updated_at", "timestamp", False, True),
            ("problem_category_id", "text", False, False),
            ("embedding", "vector768", False, False),
        ),
    ),
    (
        "product_problem_image",
        (
            ("id", "text", True, True),
            ("product_problem_id", "text", False, True),
            ("image", "text", False, True),
            ("description", "text", False, True),
        ),
    ),
    (
        "product_solution",
        (
            ("id", "text", True, True),
            ("user_id", "text", False, True),
            ("product_problem_id", "text", False, True),
            ("description", "text", False, True),
            ("reply_id", "text", False, False),
            ("embedding", "vector768", False, False),
            ("created_at", "timestamp", False, True),
            ("updated_at", "timestamp", False, True),
        ),
    ),
    (
        "product_solution_checked",
        (
            ("id", "text", True, True),
            ("user_id", "text", False, True),
            ("product_solution_id", "text", False, True),
        ),
    ),
    (
        "product_solution_image",
        (
            ("id", "text", True, True),
            ("product_solution_id", "text", False, True),
            ("image", "text", False, True),
            ("description", "text", False, True),
        ),
    ),
    (
        "product_dependency",
        (
            ("id", "text", True, True),
            ("product_id", "text", False, True),
            ("name", "text", False, True),
            ("icon", "text", False, False),
            ("description", "text", False, False),
            ("parent_id", "text", False, False),
            ("tree_path", "text", False, False),
            ("tree_depth", "integer", False, True),
            ("sort_key", "text", False, False),
            ("created_at", "timestamp", False, True),
            ("updated_at", "timestamp", False, True),
        ),
    ),
    (
        "contact",
        (
            ("id", "text", True, True),
            ("name", "text", False, True),
            ("role", "text", False, True),
            ("team", "text", False, True),
            ("email", "text", False, True),
            ("phone", "text", False, False),
            ("image", "text", False, False),
            ("active", "boolean", False, True),
            ("created_at", "timestamp", False, True),
            ("updated_at", "timestamp", False, True),
        ),
    ),
    (
        "product_contact",
        (
            ("id", "text", True, True),
            ("product_id", "text", False, True),
            ("contact_id", "text", False, True),
            ("created_at", "timestamp", False, True),
        ),
    ),
    (
        "product_manual",
        (
            ("id", "text", True, True),
            ("product_id", "text", False, True),
            ("description", "text", False, True),
            ("created_at", "timestamp", False, True),
            ("updated_at", "timestamp", False, True),
        ),
    ),
    (
        "product_manual_chunk",
        (
            ("id", "text", True, True),
            ("product_manual_id", "text", False, True),
            ("product_id", "text", False, True),
            ("chunk_index", "integer", False, True),
            ("content", "text", False, True),
            ("token_count", "integer", False, True),
            ("embedding", "vector768", False, False),
            ("created_at", "timestamp", False, True),
            ("updated_at", "timestamp", False, True),
        ),
    ),
    (
        "chat_message",
        (
            ("id", "uuid", True, True),
            ("content", "text", False, True),
            ("sender_user_id", "text", False, True),
            ("receiver_group_id", "text", False, False),
            ("receiver_user_id", "text", False, False),
            ("created_at", "timestamp", False, True),
            ("updated_at", "timestamp", False, True),
            ("deleted_at", "timestamp", False, False),
            ("read_at", "timestamp", False, False),
        ),
    ),
    (
        "chat_user_presence",
        (
            ("user_id", "text", True, True),
            ("status", "text", False, True),
            ("last_activity", "timestamp", False, True),
            ("updated_at", "timestamp", False, True),
        ),
    ),
    (
        "ai_assistant_thread",
        (
            ("id", "uuid", True, True),
            ("user_id", "text", False, True),
            ("title", "text", False, True),
            ("last_message_preview", "text", False, True),
            ("message_count", "integer", False, True),
            ("last_message_at", "timestamp", False, True),
            ("created_at", "timestamp", False, True),
            ("updated_at", "timestamp", False, True),
        ),
    ),
    (
        "ai_assistant_message",
        (
            ("id", "uuid", True, True),
            ("thread_id", "uuid", False, True),
            ("sender_type", "text", False, True),
            ("sender_user_id", "text", False, False),
            ("sender_name", "text", False, True),
            ("provider", "text", False, False),
            ("model", "text", False, False),
            ("generation_status", "text", False, False),
            ("latency_ms", "integer", False, False),
            ("error_message", "text", False, False),
            ("content", "text", False, True),
            ("metadata", "jsonb", False, True),
            ("embedding", "vector768", False, False),
            ("created_at", "timestamp", False, True),
            ("updated_at", "timestamp", False, True),
        ),
    ),
    (
        "ai_assistant_artifact",
        (
            ("id", "uuid", True, True),
            ("user_id", "text", False, False),
            ("thread_id", "uuid", False, False),
            ("message_id", "uuid", False, False),
            ("kind", "text", False, True),
            ("report_type", "text", False, False),
            ("idempotency_hash", "text", False, True),
            ("request_fingerprint", "text", False, True),
            ("dataset_checksum", "text", False, False),
            ("metric_version", "text", False, True),
            ("status", "text", False, True),
            ("owner_token", "text", False, False),
            ("lease_expires_at", "timestamp", False, False),
            ("relative_path", "text", False, False),
            ("url", "text", False, False),
            ("filename", "text", False, False),
            ("mime_type", "text", False, False),
            ("byte_size", "integer", False, False),
            ("file_sha256", "text", False, False),
            ("error_message", "text", False, False),
            ("attached_at", "timestamp", False, False),
            ("created_at", "timestamp", False, True),
            ("updated_at", "timestamp", False, True),
        ),
    ),
    (
        "help",
        (
            ("id", "text", True, True),
            ("description", "text", False, False),
            ("embedding", "vector768", False, False),
            ("created_at", "timestamp", False, True),
            ("updated_at", "timestamp", False, True),
        ),
    ),
    (
        "project",
        (
            ("id", "uuid", True, True),
            ("name", "text", False, True),
            ("short_description", "text", False, True),
            ("description", "text", False, True),
            ("start_date", "date", False, False),
            ("end_date", "date", False, False),
            ("priority", "text", False, True),
            ("status", "text", False, True),
            ("created_at", "timestamp", False, True),
            ("updated_at", "timestamp", False, True),
        ),
    ),
    (
        "project_activity",
        (
            ("id", "uuid", True, True),
            ("project_id", "uuid", False, True),
            ("name", "text", False, True),
            ("description", "text", False, True),
            ("category", "text", False, False),
            ("estimated_days", "integer", False, False),
            ("start_date", "date", False, False),
            ("end_date", "date", False, False),
            ("priority", "text", False, True),
            ("status", "text", False, True),
            ("created_at", "timestamp", False, True),
            ("updated_at", "timestamp", False, True),
        ),
    ),
    (
        "project_task",
        (
            ("id", "uuid", True, True),
            ("project_id", "uuid", False, True),
            ("project_activity_id", "uuid", False, True),
            ("name", "text", False, True),
            ("description", "text", False, True),
            ("category", "text", False, False),
            ("estimated_days", "integer", False, False),
            ("start_date", "date", False, False),
            ("end_date", "date", False, False),
            ("priority", "text", False, True),
            ("status", "text", False, True),
            ("sort", "integer", False, True),
            ("created_at", "timestamp", False, True),
            ("updated_at", "timestamp", False, True),
        ),
    ),
    (
        "project_task_user",
        (
            ("id", "uuid", True, True),
            ("task_id", "uuid", False, True),
            ("user_id", "text", False, True),
            ("role", "text", False, True),
            ("assigned_at", "timestamp", False, True),
            ("created_at", "timestamp", False, True),
        ),
    ),
    (
        "project_task_history",
        (
            ("id", "uuid", True, True),
            ("task_id", "uuid", False, True),
            ("user_id", "text", False, True),
            ("action", "text", False, True),
            ("from_status", "text", False, False),
            ("to_status", "text", False, True),
            ("from_sort", "integer", False, False),
            ("to_sort", "integer", False, False),
            ("details", "jsonb", False, False),
            ("created_at", "timestamp", False, True),
        ),
    ),
    (
        "product_activity",
        (
            ("id", "uuid", True, True),
            ("product_id", "text", False, True),
            ("user_id", "text", False, True),
            ("date", "date", False, True),
            ("turn", "integer", False, True),
            ("status", "text", False, True),
            ("problem_category_id", "text", False, False),
            ("description", "text", False, False),
            ("intervention", "text", False, False),
            ("created_at", "timestamp", False, True),
            ("updated_at", "timestamp", False, True),
        ),
    ),
    (
        "product_activity_history",
        (
            ("id", "uuid", True, True),
            ("product_activity_id", "uuid", False, True),
            ("user_id", "text", False, True),
            ("status", "text", False, True),
            ("description", "text", False, False),
            ("intervention", "text", False, False),
            ("created_at", "timestamp", False, True),
        ),
    ),
    (
        "kafka_processed_messages",
        (
            ("topic", "text", False, True),
            ("message_id", "text", False, True),
            ("handler", "text", False, False),
            ("processed_at", "timestamp", False, True),
        ),
    ),
)

TABLE_NAME_MAPPINGS: tuple[NameMapping, ...] = tuple(
    NameMapping(python_name=table_name, physical_name=table_name)
    for table_name, _ in TABLE_COLUMN_SPECS
)
COLUMN_NAME_MAPPINGS: tuple[TableColumnNameMappings, ...] = tuple(
    (
        table_name,
        tuple(
            NameMapping(python_name=column_name, physical_name=column_name)
            for column_name, _, _, _ in column_specs
        ),
    )
    for table_name, column_specs in TABLE_COLUMN_SPECS
)

FOREIGN_KEY_SPECS: dict[str, tuple[ForeignKeySpec, ...]] = {
    "account": (ForeignKeySpec("user_id", "user", "id", "account_user_id_user_id_fk"),),
    "session": (ForeignKeySpec("user_id", "user", "id", "session_user_id_user_id_fk"),),
    "user_profile": (ForeignKeySpec("user_id", "user", "id", "user_profile_user_id_user_id_fk"),),
    "user_preferences": (
        ForeignKeySpec("user_id", "user", "id", "user_preferences_user_id_user_id_fk"),
    ),
    "user_group": (
        ForeignKeySpec("user_id", "user", "id", "user_group_user_id_user_id_fk", "cascade"),
        ForeignKeySpec("group_id", "group", "id", "user_group_group_id_group_id_fk", "cascade"),
    ),
    "group_permissions": (
        ForeignKeySpec(
            "group_id",
            "group",
            "id",
            "group_permissions_group_id_group_id_fk",
            "cascade",
        ),
    ),
    "product_availability_exception": (
        ForeignKeySpec(
            "product_id",
            "product",
            "id",
            "product_availability_exception_product_id_product_id_fk",
            "cascade",
        ),
    ),
    "picture_link": (
        ForeignKeySpec(
            "page_id",
            "picture_page",
            "id",
            "picture_link_page_id_picture_page_id_fk",
            "cascade",
        ),
    ),
    "radar": (
        ForeignKeySpec(
            "group_id",
            "radar_group",
            "id",
            "radar_group_id_radar_group_id_fk",
            "cascade",
        ),
    ),
    "product_problem": (
        ForeignKeySpec("product_id", "product", "id", "product_problem_product_id_product_id_fk"),
        ForeignKeySpec("user_id", "user", "id", "product_problem_user_id_user_id_fk"),
        ForeignKeySpec(
            "problem_category_id",
            "product_problem_category",
            "id",
            "product_problem_problem_category_id_product_problem_category_id",
        ),
    ),
    "product_problem_image": (
        ForeignKeySpec(
            "product_problem_id",
            "product_problem",
            "id",
            "product_problem_image_product_problem_id_product_problem_id_fk",
        ),
    ),
    "product_solution": (
        ForeignKeySpec("user_id", "user", "id", "product_solution_user_id_user_id_fk"),
        ForeignKeySpec(
            "product_problem_id",
            "product_problem",
            "id",
            "product_solution_product_problem_id_product_problem_id_fk",
        ),
    ),
    "product_solution_checked": (
        ForeignKeySpec("user_id", "user", "id", "product_solution_checked_user_id_user_id_fk"),
        ForeignKeySpec(
            "product_solution_id",
            "product_solution",
            "id",
            "product_solution_checked_product_solution_id_product_solution_i",
        ),
    ),
    "product_solution_image": (
        ForeignKeySpec(
            "product_solution_id",
            "product_solution",
            "id",
            "product_solution_image_product_solution_id_product_solution_id_",
        ),
    ),
    "product_dependency": (
        ForeignKeySpec(
            "product_id",
            "product",
            "id",
            "product_dependency_product_id_product_id_fk",
            "cascade",
        ),
    ),
    "product_contact": (
        ForeignKeySpec(
            "product_id",
            "product",
            "id",
            "product_contact_product_id_product_id_fk",
            "cascade",
        ),
        ForeignKeySpec(
            "contact_id",
            "contact",
            "id",
            "product_contact_contact_id_contact_id_fk",
            "cascade",
        ),
    ),
    "product_manual": (
        ForeignKeySpec("product_id", "product", "id", "product_manual_product_id_product_id_fk"),
    ),
    "product_manual_chunk": (
        ForeignKeySpec(
            "product_manual_id",
            "product_manual",
            "id",
            "product_manual_chunk_product_manual_id_product_manual_id_fk",
            "cascade",
        ),
        ForeignKeySpec(
            "product_id",
            "product",
            "id",
            "product_manual_chunk_product_id_product_id_fk",
            "cascade",
        ),
    ),
    "chat_message": (
        ForeignKeySpec(
            "sender_user_id",
            "user",
            "id",
            "chat_message_sender_user_id_user_id_fk",
            "cascade",
        ),
        ForeignKeySpec(
            "receiver_group_id",
            "group",
            "id",
            "chat_message_receiver_group_id_group_id_fk",
            "cascade",
        ),
        ForeignKeySpec(
            "receiver_user_id",
            "user",
            "id",
            "chat_message_receiver_user_id_user_id_fk",
            "cascade",
        ),
    ),
    "chat_user_presence": (
        ForeignKeySpec(
            "user_id",
            "user",
            "id",
            "chat_user_presence_user_id_user_id_fk",
            "cascade",
        ),
    ),
    "ai_assistant_thread": (
        ForeignKeySpec(
            "user_id",
            "user",
            "id",
            "ai_assistant_thread_user_id_user_id_fk",
            "cascade",
        ),
    ),
    "ai_assistant_message": (
        ForeignKeySpec(
            "thread_id",
            "ai_assistant_thread",
            "id",
            "ai_assistant_message_thread_id_ai_assistant_thread_id_fk",
            "cascade",
        ),
        ForeignKeySpec(
            "sender_user_id",
            "user",
            "id",
            "ai_assistant_message_sender_user_id_user_id_fk",
            "cascade",
        ),
    ),
    "ai_assistant_artifact": (
        ForeignKeySpec(
            "thread_id",
            "ai_assistant_thread",
            "id",
            "ai_assistant_artifact_thread_id_ai_assistant_thread_id_fk",
            "set null",
        ),
        ForeignKeySpec(
            "message_id",
            "ai_assistant_message",
            "id",
            "ai_assistant_artifact_message_id_ai_assistant_message_id_fk",
            "set null",
        ),
    ),
    "project_activity": (
        ForeignKeySpec(
            "project_id",
            "project",
            "id",
            "project_activity_project_id_project_id_fk",
            "cascade",
        ),
    ),
    "project_task": (
        ForeignKeySpec(
            "project_id",
            "project",
            "id",
            "project_task_project_id_project_id_fk",
            "cascade",
        ),
        ForeignKeySpec(
            "project_activity_id",
            "project_activity",
            "id",
            "project_task_project_activity_id_project_activity_id_fk",
            "cascade",
        ),
    ),
    "project_task_user": (
        ForeignKeySpec(
            "task_id",
            "project_task",
            "id",
            "project_task_user_task_id_project_task_id_fk",
            "cascade",
        ),
        ForeignKeySpec(
            "user_id",
            "user",
            "id",
            "project_task_user_user_id_user_id_fk",
            "cascade",
        ),
    ),
    "project_task_history": (
        ForeignKeySpec(
            "task_id",
            "project_task",
            "id",
            "project_task_history_task_id_project_task_id_fk",
            "cascade",
        ),
        ForeignKeySpec(
            "user_id",
            "user",
            "id",
            "project_task_history_user_id_user_id_fk",
            "cascade",
        ),
    ),
    "product_activity": (
        ForeignKeySpec(
            "product_id",
            "product",
            "id",
            "product_activity_product_id_product_id_fk",
            "cascade",
        ),
        ForeignKeySpec(
            "user_id",
            "user",
            "id",
            "product_activity_user_id_user_id_fk",
            "cascade",
        ),
        ForeignKeySpec(
            "problem_category_id",
            "product_problem_category",
            "id",
            "product_activity_problem_category_id_product_problem_category_i",
        ),
    ),
    "product_activity_history": (
        ForeignKeySpec(
            "product_activity_id",
            "product_activity",
            "id",
            "product_activity_history_product_activity_id_product_activity_i",
            "cascade",
        ),
        ForeignKeySpec("user_id", "user", "id", "product_activity_history_user_id_user_id_fk"),
    ),
}
UNIQUE_CONSTRAINT_SPECS: dict[str, tuple[UniqueConstraintSpec, ...]] = {
    "group": (UniqueConstraintSpec("group_name_unique", ("name",)),),
    "user_group": (UniqueConstraintSpec("unique_user_group", ("user_id", "group_id")),),
    "group_permissions": (
        UniqueConstraintSpec("unique_group_permission", ("group_id", "resource", "action")),
    ),
    "user": (UniqueConstraintSpec("user_email_unique", ("email",)),),
    "session": (UniqueConstraintSpec("session_token_unique", ("token",)),),
    "rate_limit": (
        UniqueConstraintSpec("unique_rate_limit_email_ip_route", ("email", "ip", "route")),
    ),
    "product_availability_exception": (
        UniqueConstraintSpec(
            "unique_product_availability_exception_product_date_type",
            ("product_id", "date", "type"),
        ),
    ),
    "picture_page": (UniqueConstraintSpec("picture_page_slug_unique", ("slug",)),),
    "picture_link": (UniqueConstraintSpec("picture_link_slug_unique", ("slug",)),),
    "radar_group": (UniqueConstraintSpec("radar_group_slug_unique", ("slug",)),),
    "radar": (UniqueConstraintSpec("radar_slug_unique", ("slug",)),),
    "product_problem_category": (
        UniqueConstraintSpec("product_problem_category_name_unique", ("name",)),
    ),
    "contact": (UniqueConstraintSpec("contact_email_unique", ("email",)),),
    "project_task_user": (UniqueConstraintSpec("unique_task_user", ("task_id", "user_id")),),
    "product_activity": (
        UniqueConstraintSpec(
            "unique_product_activity_product_date_turn",
            ("product_id", "date", "turn"),
        ),
    ),
    "kafka_processed_messages": (
        UniqueConstraintSpec("unique_kafka_processed_message", ("topic", "message_id")),
    ),
    "ai_assistant_artifact": (
        UniqueConstraintSpec(
            "ai_assistant_artifact_idempotency_hash_unique",
            ("idempotency_hash",),
        ),
    ),
}
CHECK_CONSTRAINT_SPECS: dict[str, tuple[CheckConstraintSpec, ...]] = {
    "ai_assistant_artifact": (
        CheckConstraintSpec("ai_assistant_artifact_kind_check", "kind in ('pdf')"),
        CheckConstraintSpec(
            "ai_assistant_artifact_status_check",
            "status in ('pending', 'ready', 'failed')",
        ),
        CheckConstraintSpec(
            "ai_assistant_artifact_mime_type_check",
            "mime_type is null or mime_type = 'application/pdf'",
        ),
        CheckConstraintSpec(
            "ai_assistant_artifact_byte_size_check",
            "byte_size is null or byte_size >= 0",
        ),
        CheckConstraintSpec(
            "ai_assistant_artifact_ready_checksum_check",
            "status <> 'ready' or (dataset_checksum is not null and file_sha256 is not null)",
        ),
    ),
}
INDEX_SPECS: tuple[IndexSpec, ...] = (
    IndexSpec("idx_user_group_user_id", "user_group", ("user_id",)),
    IndexSpec("idx_user_group_group_id", "user_group", ("group_id",)),
    IndexSpec("idx_group_permission_group_id", "group_permissions", ("group_id",)),
    IndexSpec("idx_group_permission_resource", "group_permissions", ("resource",)),
    IndexSpec(
        "idx_product_availability_exception_product_date",
        "product_availability_exception",
        ("product_id", "date"),
    ),
    IndexSpec("idx_product_problem_product", "product_problem", ("product_id",)),
    IndexSpec("idx_product_problem_user", "product_problem", ("user_id",)),
    IndexSpec("idx_product_problem_category", "product_problem", ("problem_category_id",)),
    IndexSpec("idx_product_problem_created_at", "product_problem", ("created_at",)),
    IndexSpec("idx_chat_message_group", "chat_message", ("receiver_group_id", "created_at")),
    IndexSpec(
        "idx_chat_message_user",
        "chat_message",
        ("receiver_user_id", "sender_user_id", "created_at"),
    ),
    IndexSpec("idx_chat_message_unread_user", "chat_message", ("receiver_user_id", "read_at")),
    IndexSpec("idx_chat_message_sender", "chat_message", ("sender_user_id",)),
    IndexSpec("idx_ai_assistant_thread_user_id", "ai_assistant_thread", ("user_id",)),
    IndexSpec(
        "idx_ai_assistant_thread_last_message_at",
        "ai_assistant_thread",
        ("last_message_at",),
    ),
    IndexSpec("idx_ai_assistant_message_thread_id", "ai_assistant_message", ("thread_id",)),
    IndexSpec("idx_ai_assistant_message_created_at", "ai_assistant_message", ("created_at",)),
    IndexSpec("idx_product_activity_product_date", "product_activity", ("product_id", "date")),
    IndexSpec("idx_product_activity_product_turn", "product_activity", ("product_id", "turn")),
    IndexSpec("idx_product_activity_user_id", "product_activity", ("user_id",)),
    IndexSpec(
        "idx_product_activity_history_product_activity_id",
        "product_activity_history",
        ("product_activity_id",),
    ),
    IndexSpec("idx_product_activity_history_user_id", "product_activity_history", ("user_id",)),
    IndexSpec(
        "idx_product_activity_history_created_at",
        "product_activity_history",
        ("created_at",),
    ),
    IndexSpec("idx_project_task_user_task_id", "project_task_user", ("task_id",)),
    IndexSpec("idx_project_task_user_user_id", "project_task_user", ("user_id",)),
    IndexSpec("idx_project_task_history_task_id", "project_task_history", ("task_id",)),
    IndexSpec("idx_project_task_history_user_id", "project_task_history", ("user_id",)),
    IndexSpec("idx_project_task_history_created_at", "project_task_history", ("created_at",)),
    IndexSpec(
        "idx_ai_message_embedding",
        "ai_assistant_message",
        ("embedding",),
        "hnsw",
        (("embedding", "vector_cosine_ops"),),
    ),
    IndexSpec(
        "idx_product_problem_embedding",
        "product_problem",
        ("embedding",),
        "hnsw",
        (("embedding", "vector_cosine_ops"),),
    ),
    IndexSpec(
        "idx_product_solution_embedding",
        "product_solution",
        ("embedding",),
        "hnsw",
        (("embedding", "vector_cosine_ops"),),
    ),
    IndexSpec(
        "idx_product_manual_chunk_embedding",
        "product_manual_chunk",
        ("embedding",),
        "hnsw",
        (("embedding", "vector_cosine_ops"),),
    ),
    IndexSpec(
        "idx_help_embedding",
        "help",
        ("embedding",),
        "hnsw",
        (("embedding", "vector_cosine_ops"),),
    ),
    IndexSpec("idx_product_manual_chunk_product_id", "product_manual_chunk", ("product_id",)),
    IndexSpec(
        "idx_product_manual_chunk_content_trgm",
        "product_manual_chunk",
        ("content",),
        "gin",
        (("content", "gin_trgm_ops"),),
    ),
    IndexSpec(
        "idx_product_problem_title_trgm",
        "product_problem",
        ("title",),
        "gin",
        (("title", "gin_trgm_ops"),),
    ),
    IndexSpec(
        "idx_product_problem_description_trgm",
        "product_problem",
        ("description",),
        "gin",
        (("description", "gin_trgm_ops"),),
    ),
    IndexSpec(
        "idx_product_solution_description_trgm",
        "product_solution",
        ("description",),
        "gin",
        (("description", "gin_trgm_ops"),),
    ),
    IndexSpec(
        "idx_ai_assistant_artifact_thread_id",
        "ai_assistant_artifact",
        ("thread_id",),
    ),
    IndexSpec(
        "idx_ai_assistant_artifact_message_id",
        "ai_assistant_artifact",
        ("message_id",),
    ),
    IndexSpec("idx_ai_assistant_artifact_status", "ai_assistant_artifact", ("status",)),
    IndexSpec(
        "idx_ai_assistant_artifact_lease_expires_at",
        "ai_assistant_artifact",
        ("lease_expires_at",),
    ),
    IndexSpec(
        "idx_ai_assistant_artifact_attached_at",
        "ai_assistant_artifact",
        ("attached_at",),
    ),
)
_UUID_DEFAULT_COLUMNS: tuple[tuple[str, str], ...] = (
    ("user_group", "id"),
    ("group_permissions", "id"),
    ("product_availability_exception", "id"),
    ("chat_message", "id"),
    ("ai_assistant_thread", "id"),
    ("ai_assistant_message", "id"),
    ("ai_assistant_artifact", "id"),
    ("project", "id"),
    ("project_activity", "id"),
    ("project_task", "id"),
    ("project_task_user", "id"),
    ("project_task_history", "id"),
    ("product_activity", "id"),
    ("product_activity_history", "id"),
)
_NOW_DEFAULT_COLUMNS: tuple[tuple[str, str], ...] = (
    ("group", "created_at"),
    ("group", "updated_at"),
    ("user_group", "joined_at"),
    ("user_group", "created_at"),
    ("group_permissions", "created_at"),
    ("group_permissions", "updated_at"),
    ("user", "created_at"),
    ("user", "updated_at"),
    ("session", "created_at"),
    ("session", "updated_at"),
    ("account", "created_at"),
    ("account", "updated_at"),
    ("product_availability_exception", "created_at"),
    ("product_availability_exception", "updated_at"),
    ("picture_page", "created_at"),
    ("picture_page", "updated_at"),
    ("picture_link", "created_at"),
    ("radar_group", "created_at"),
    ("radar_group", "updated_at"),
    ("radar", "created_at"),
    ("radar", "updated_at"),
    ("product_problem_category", "created_at"),
    ("product_problem_category", "updated_at"),
    ("product_problem", "created_at"),
    ("product_problem", "updated_at"),
    ("product_solution", "created_at"),
    ("product_solution", "updated_at"),
    ("product_dependency", "created_at"),
    ("product_dependency", "updated_at"),
    ("contact", "created_at"),
    ("contact", "updated_at"),
    ("product_contact", "created_at"),
    ("product_manual", "created_at"),
    ("product_manual", "updated_at"),
    ("product_manual_chunk", "created_at"),
    ("product_manual_chunk", "updated_at"),
    ("chat_message", "created_at"),
    ("chat_message", "updated_at"),
    ("chat_user_presence", "last_activity"),
    ("chat_user_presence", "updated_at"),
    ("ai_assistant_thread", "last_message_at"),
    ("ai_assistant_thread", "created_at"),
    ("ai_assistant_thread", "updated_at"),
    ("ai_assistant_message", "created_at"),
    ("ai_assistant_message", "updated_at"),
    ("ai_assistant_artifact", "created_at"),
    ("ai_assistant_artifact", "updated_at"),
    ("help", "created_at"),
    ("help", "updated_at"),
    ("project", "created_at"),
    ("project", "updated_at"),
    ("project_activity", "created_at"),
    ("project_activity", "updated_at"),
    ("project_task", "created_at"),
    ("project_task", "updated_at"),
    ("project_task_user", "assigned_at"),
    ("project_task_user", "created_at"),
    ("project_task_history", "created_at"),
    ("product_activity", "created_at"),
    ("product_activity", "updated_at"),
    ("product_activity_history", "created_at"),
    ("kafka_processed_messages", "processed_at"),
)


def _build_column_server_defaults() -> dict[tuple[str, str], str]:
    defaults = {
        ("group", "icon"): "'icon-[lucide--users]'",
        ("group", "color"): "'#3B82F6'",
        ("group", "role"): "'user'",
        ("group", "active"): "true",
        ("group", "is_default"): "false",
        ("user", "email_verified"): "false",
        ("user", "is_active"): "false",
        ("user_preferences", "chat_enabled"): "true",
        ("product", "available"): "true",
        ("product", "priority"): "'normal'",
        ("product", "turns"): """'["0","6","12","18"]'::jsonb""",
        ("product", "data_product_flow"): "'[]'::jsonb",
        ("picture_page", "check_mode"): "'page'",
        ("picture_page", "status"): "'ok'",
        ("picture_page", "delayed_links"): "0",
        ("picture_page", "offline_links"): "0",
        ("picture_link", "status"): "'ok'",
        ("radar_group", "sort_order"): "0",
        ("radar", "status"): "'ok'",
        ("radar", "active"): "true",
        ("product_problem_category", "is_system"): "false",
        ("product_problem_category", "sort_order"): "0",
        ("product_dependency", "tree_depth"): "0",
        ("contact", "active"): "true",
        ("product_manual_chunk", "token_count"): "0",
        ("chat_user_presence", "status"): "'invisible'",
        ("ai_assistant_thread", "last_message_preview"): "''",
        ("ai_assistant_thread", "message_count"): "0",
        ("ai_assistant_message", "sender_type"): "'user'",
        ("ai_assistant_message", "metadata"): "'{}'::jsonb",
        ("ai_assistant_artifact", "kind"): "'pdf'",
        ("ai_assistant_artifact", "status"): "'pending'",
        ("ai_assistant_artifact", "mime_type"): "'application/pdf'",
        ("help", "description"): "''",
        ("project", "priority"): "'medium'",
        ("project", "status"): "'active'",
        ("project_activity", "priority"): "'medium'",
        ("project_activity", "status"): "'todo'",
        ("project_task", "priority"): "'medium'",
        ("project_task", "status"): "'todo'",
        ("project_task", "sort"): "0",
        ("project_task_user", "role"): "'assignee'",
    }
    for table_name, column_name in _UUID_DEFAULT_COLUMNS:
        defaults[(table_name, column_name)] = "gen_random_uuid()"
    for table_name, column_name in _NOW_DEFAULT_COLUMNS:
        defaults[(table_name, column_name)] = "now()"
    return defaults


COLUMN_SERVER_DEFAULTS = _build_column_server_defaults()

PYTHON_TABLE_TO_PHYSICAL: dict[str, str] = {
    mapping.python_name: mapping.physical_name for mapping in TABLE_NAME_MAPPINGS
}
PHYSICAL_TABLE_TO_PYTHON: dict[str, str] = {
    mapping.physical_name: mapping.python_name for mapping in TABLE_NAME_MAPPINGS
}
PYTHON_COLUMNS_TO_PHYSICAL: dict[str, dict[str, str]] = {
    table_name: {mapping.python_name: mapping.physical_name for mapping in mappings}
    for table_name, mappings in COLUMN_NAME_MAPPINGS
}
PHYSICAL_COLUMNS_TO_PYTHON: dict[str, dict[str, str]] = {
    table_name: {mapping.physical_name: mapping.python_name for mapping in mappings}
    for table_name, mappings in COLUMN_NAME_MAPPINGS
}

legacy_tables: dict[str, Table] = {}


def physical_table_name(python_name: str) -> str:
    return PYTHON_TABLE_TO_PHYSICAL[python_name]


def python_table_name(physical_name: str) -> str:
    return PHYSICAL_TABLE_TO_PYTHON[physical_name]


def physical_column_name(table_python_name: str, column_python_name: str) -> str:
    table_physical_name = physical_table_name(table_python_name)
    return PYTHON_COLUMNS_TO_PHYSICAL[table_physical_name][column_python_name]


def python_column_name(table_physical_name: str, column_physical_name: str) -> str:
    return PHYSICAL_COLUMNS_TO_PYTHON[table_physical_name][column_physical_name]


def _build_legacy_tables() -> dict[str, Table]:
    tables = {
        table_name: Table(
            table_name,
            legacy_metadata,
            *(_column_from_spec(table_name, column_spec) for column_spec in column_specs),
            *_unique_constraints_from_specs(table_name),
            *_check_constraints_from_specs(table_name),
        )
        for table_name, column_specs in TABLE_COLUMN_SPECS
    }
    _attach_indexes(tables)
    return tables


def _column_from_spec(table_name: str, spec: ColumnSpec) -> Column[Any]:
    name, kind, primary_key, required = spec
    server_default = COLUMN_SERVER_DEFAULTS.get((table_name, name))
    return Column(
        name,
        _type_for_kind(kind),
        *_foreign_keys_from_specs(table_name, name),
        key=python_column_name(table_name, name),
        primary_key=primary_key,
        nullable=not required,
        server_default=sql_text(server_default) if server_default is not None else None,
    )


def _foreign_keys_from_specs(table_name: str, column_name: str) -> tuple[ForeignKey, ...]:
    return tuple(
        ForeignKey(
            f"{foreign_key.referred_table_name}.{foreign_key.referred_column_name}",
            name=foreign_key.constraint_name,
            ondelete=foreign_key.ondelete,
        )
        for foreign_key in FOREIGN_KEY_SPECS.get(table_name, ())
        if foreign_key.column_name == column_name
    )


def _unique_constraints_from_specs(table_name: str) -> tuple[UniqueConstraint, ...]:
    return tuple(
        UniqueConstraint(*spec.column_names, name=spec.constraint_name)
        for spec in UNIQUE_CONSTRAINT_SPECS.get(table_name, ())
    )


def _check_constraints_from_specs(table_name: str) -> tuple[CheckConstraint, ...]:
    return tuple(
        CheckConstraint(spec.sql_text, name=spec.constraint_name)
        for spec in CHECK_CONSTRAINT_SPECS.get(table_name, ())
    )


def _attach_indexes(tables: dict[str, Table]) -> None:
    for spec in INDEX_SPECS:
        index_kwargs: dict[str, Any] = {"postgresql_using": spec.postgresql_using}
        if spec.postgresql_ops:
            index_kwargs["postgresql_ops"] = dict(spec.postgresql_ops)
        Index(
            spec.index_name,
            *(tables[spec.table_name].c[column_name] for column_name in spec.column_names),
            **index_kwargs,
        )


def _type_for_kind(kind: str) -> TypeEngine[Any]:
    match kind:
        case "text":
            return Text()
        case "uuid":
            return UUID(as_uuid=True)
        case "timestamp":
            return DateTime(timezone=False)
        case "integer":
            return Integer()
        case "boolean":
            return Boolean()
        case "jsonb":
            return JSONB()
        case "date":
            return Date()
        case "vector768":
            return Vector768()
        case _:
            raise ValueError(f"Unsupported legacy column kind: {kind}")


legacy_tables.update(_build_legacy_tables())
