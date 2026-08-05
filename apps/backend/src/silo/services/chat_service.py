from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import and_, asc, desc, func, insert, or_, select, update
from sqlalchemy.engine import Connection

from silo.api.dependencies import get_chat_access_state
from silo.auth.sessions import legacy_local_now
from silo.clock import new_id
from silo.db.models import legacy_tables
from silo.db.serialization import LEGACY_OPERATIONAL_TIMEZONE

CHAT_CONVERSATION_TARGET_GROUP = "group"
CHAT_CONVERSATION_TARGET_USER = "user"
CHAT_PRESENCE_VISIBLE = "visible"
CHAT_PRESENCE_INVISIBLE = "invisible"
CHAT_MESSAGE_DELETED_LABEL = "[Mensagem excluída]"
CHAT_MESSAGE_MAX_LENGTH = 2000
CHAT_MESSAGE_DELETE_WINDOW_HOURS = 24
CHAT_UNREAD_LIMIT = 15


@dataclass(slots=True)
class ChatServiceError(Exception):
    message: str
    status: int = 400
    field: str | None = None

    def __str__(self) -> str:
        return self.message


def list_messages(
    connection: Connection,
    current_user_id: str,
    group_id: str | None,
    user_id: str | None,
    *,
    limit: int = 30,
    page: int = 1,
    before: str | None = None,
    after: str | None = None,
) -> dict[str, Any]:
    if not group_id and not user_id:
        raise ChatServiceError("Especifique groupId ou userId.", 400)

    offset = 0 if before or after else max(page - 1, 0) * max(limit, 1)
    chat_message_table = legacy_tables["chat_message"]
    auth_user_table = legacy_tables["user"]

    where_clauses: list[Any] = [chat_message_table.c.deleted_at.is_(None)]
    if before:
        where_clauses.append(chat_message_table.c.created_at < _parse_legacy_timestamp(before))
    if after:
        where_clauses.append(chat_message_table.c.created_at > _parse_legacy_timestamp(after))

    if group_id:
        where_clauses.append(chat_message_table.c.receiver_group_id == group_id)
    else:
        where_clauses.append(
            or_(
                and_(
                    chat_message_table.c.sender_user_id == current_user_id,
                    chat_message_table.c.receiver_user_id == user_id,
                ),
                and_(
                    chat_message_table.c.sender_user_id == user_id,
                    chat_message_table.c.receiver_user_id == current_user_id,
                ),
            )
        )

    rows = (
        connection.execute(
            select(
                chat_message_table.c.id,
                chat_message_table.c.content,
                chat_message_table.c.sender_user_id,
                auth_user_table.c.name.label("sender_name"),
                chat_message_table.c.receiver_group_id,
                chat_message_table.c.receiver_user_id,
                chat_message_table.c.created_at,
                chat_message_table.c.read_at,
            )
            .select_from(
                chat_message_table.join(
                    auth_user_table, auth_user_table.c.id == chat_message_table.c.sender_user_id
                )
            )
            .where(and_(*where_clauses))
            .order_by(desc(chat_message_table.c.created_at))
            .limit(max(limit, 1))
            .offset(offset)
        )
        .mappings()
        .all()
    )

    return {
        "messages": [dict(row) for row in rows],
        "count": len(rows),
        "has_more": len(rows) == max(limit, 1),
    }


def create_message(
    connection: Connection,
    sender_user_id: str,
    content: str,
    receiver_group_id: str | None = None,
    receiver_user_id: str | None = None,
) -> dict[str, Any]:
    trimmed_content = content.strip()
    if not trimmed_content:
        raise ChatServiceError(
            "Conteúdo da mensagem é obrigatório",
            400,
            field="content",
        )

    if len(trimmed_content) > CHAT_MESSAGE_MAX_LENGTH:
        raise ChatServiceError(
            "Mensagem muito longa (máximo 2000 caracteres)",
            400,
            field="content",
        )

    if bool(receiver_group_id) == bool(receiver_user_id):
        raise ChatServiceError(
            "Especifique apenas um receptor (groupId ou userId)",
            400,
            field="receiverGroupId",
        )

    chat_message_table = legacy_tables["chat_message"]
    auth_user_table = legacy_tables["user"]
    now = legacy_local_now()

    if receiver_user_id:
        if receiver_user_id == sender_user_id:
            raise ChatServiceError(
                "Não é possível enviar mensagem para si mesmo",
                400,
                field="receiverUserId",
            )

        target_exists = (
            connection.execute(
                select(auth_user_table.c.id)
                .where(auth_user_table.c.id == receiver_user_id)
                .limit(1)
            ).first()
            is not None
        )
        if not target_exists:
            raise ChatServiceError(
                "Usuário destinatário não encontrado",
                404,
                field="receiverUserId",
            )

    message_id = new_id()
    connection.execute(
        insert(chat_message_table).values(
            id=message_id,
            content=trimmed_content,
            sender_user_id=sender_user_id,
            receiver_group_id=receiver_group_id,
            receiver_user_id=receiver_user_id,
            created_at=now,
            updated_at=now,
        )
    )
    connection.commit()

    row = (
        connection.execute(
            select(
                chat_message_table.c.id,
                chat_message_table.c.content,
                chat_message_table.c.sender_user_id,
                auth_user_table.c.name.label("sender_name"),
                chat_message_table.c.receiver_group_id,
                chat_message_table.c.receiver_user_id,
                chat_message_table.c.created_at,
                chat_message_table.c.read_at,
            )
            .select_from(
                chat_message_table.join(
                    auth_user_table, auth_user_table.c.id == chat_message_table.c.sender_user_id
                )
            )
            .where(chat_message_table.c.id == message_id)
            .limit(1)
        )
        .mappings()
        .first()
    )

    if row is None:
        raise ChatServiceError("Mensagem não encontrada.", 404)

    return dict(row)


def update_presence(
    connection: Connection,
    user_id: str,
    status: str,
) -> dict[str, Any]:
    if status not in {CHAT_PRESENCE_VISIBLE, CHAT_PRESENCE_INVISIBLE}:
        raise ChatServiceError(
            "Status inválido. Use: visible ou invisible",
            400,
            field="status",
        )

    chat_user_presence_table = legacy_tables["chat_user_presence"]
    now = legacy_local_now()
    existing = (
        connection.execute(
            select(chat_user_presence_table.c.user_id)
            .where(chat_user_presence_table.c.user_id == user_id)
            .limit(1)
        ).first()
        is not None
    )

    if existing:
        connection.execute(
            update(chat_user_presence_table)
            .where(chat_user_presence_table.c.user_id == user_id)
            .values(status=status, last_activity=now, updated_at=now)
        )
    else:
        connection.execute(
            insert(chat_user_presence_table).values(
                user_id=user_id,
                status=status,
                last_activity=now,
                updated_at=now,
            )
        )

    connection.commit()
    return {
        "user_id": user_id,
        "status": status,
        "last_activity": now,
        "updated_at": now,
    }


def update_presence_heartbeat(connection: Connection, user_id: str) -> dict[str, Any]:
    chat_user_presence_table = legacy_tables["chat_user_presence"]
    now = legacy_local_now()
    current = (
        connection.execute(
            select(chat_user_presence_table.c.status)
            .where(chat_user_presence_table.c.user_id == user_id)
            .limit(1)
        )
        .mappings()
        .first()
    )
    next_status = (
        CHAT_PRESENCE_INVISIBLE
        if current is not None and str(current["status"]) == CHAT_PRESENCE_INVISIBLE
        else CHAT_PRESENCE_VISIBLE
    )

    if current is None:
        connection.execute(
            insert(chat_user_presence_table).values(
                user_id=user_id,
                status=next_status,
                last_activity=now,
                updated_at=now,
            )
        )
    else:
        connection.execute(
            update(chat_user_presence_table)
            .where(chat_user_presence_table.c.user_id == user_id)
            .values(status=next_status, last_activity=now, updated_at=now)
        )

    connection.commit()
    return {
        "user_id": user_id,
        "status": next_status,
        "last_activity": now,
        "updated_at": now,
    }


def touch_presence_on_connect(connection: Connection, user_id: str) -> dict[str, Any]:
    chat_user_presence_table = legacy_tables["chat_user_presence"]
    now = legacy_local_now()
    current = (
        connection.execute(
            select(chat_user_presence_table.c.status)
            .where(chat_user_presence_table.c.user_id == user_id)
            .limit(1)
        )
        .mappings()
        .first()
    )

    if current is None:
        next_status = CHAT_PRESENCE_VISIBLE
        connection.execute(
            insert(chat_user_presence_table).values(
                user_id=user_id,
                status=next_status,
                last_activity=now,
                updated_at=now,
            )
        )
    else:
        current_status = str(current["status"])
        next_status = (
            CHAT_PRESENCE_INVISIBLE
            if current_status == CHAT_PRESENCE_INVISIBLE
            else CHAT_PRESENCE_VISIBLE
        )
        values: dict[str, Any] = {
            "last_activity": now,
            "updated_at": now,
        }
        if current_status != CHAT_PRESENCE_INVISIBLE:
            values["status"] = next_status
        connection.execute(
            update(chat_user_presence_table)
            .where(chat_user_presence_table.c.user_id == user_id)
            .values(**values)
        )

    connection.commit()
    return {
        "user_id": user_id,
        "status": next_status,
        "last_activity": now,
        "updated_at": now,
    }


def mark_presence_offline_on_disconnect(
    connection: Connection,
    user_id: str,
) -> dict[str, Any] | None:
    chat_user_presence_table = legacy_tables["chat_user_presence"]
    current = (
        connection.execute(
            select(chat_user_presence_table.c.status)
            .where(chat_user_presence_table.c.user_id == user_id)
            .limit(1)
        )
        .mappings()
        .first()
    )
    if current is None:
        return None

    now = legacy_local_now()
    current_status = str(current["status"])
    values: dict[str, Any] = {
        "last_activity": now,
        "updated_at": now,
    }
    if current_status != CHAT_PRESENCE_INVISIBLE:
        values["status"] = CHAT_PRESENCE_INVISIBLE

    connection.execute(
        update(chat_user_presence_table)
        .where(chat_user_presence_table.c.user_id == user_id)
        .values(**values)
    )
    connection.commit()
    return {
        "user_id": user_id,
        "status": CHAT_PRESENCE_INVISIBLE,
        "last_activity": now,
        "updated_at": now,
    }


def get_presence_all(connection: Connection) -> list[dict[str, Any]]:
    chat_user_presence_table = legacy_tables["chat_user_presence"]
    auth_user_table = legacy_tables["user"]
    rows = (
        connection.execute(
            select(
                chat_user_presence_table.c.user_id,
                auth_user_table.c.name.label("user_name"),
                chat_user_presence_table.c.status,
                chat_user_presence_table.c.last_activity,
                chat_user_presence_table.c.updated_at,
            ).select_from(
                chat_user_presence_table.join(
                    auth_user_table, auth_user_table.c.id == chat_user_presence_table.c.user_id
                )
            )
        )
        .mappings()
        .all()
    )
    return [dict(row) for row in rows]


def get_chat_sidebar(connection: Connection, user_id: str) -> dict[str, Any]:
    access = get_chat_access_state(connection, user_id)
    if not access.can_view_chat:
        return {
            "can_view_chat": False,
            "groups": [],
            "users": [],
            "total_unread": 0,
        }

    group_table = legacy_tables["group"]
    auth_user_table = legacy_tables["user"]
    chat_message_table = legacy_tables["chat_message"]
    chat_user_presence_table = legacy_tables["chat_user_presence"]

    active_groups = (
        connection.execute(
            select(
                group_table.c.id,
                group_table.c.name,
                group_table.c.description,
                group_table.c.icon,
                group_table.c.color,
                group_table.c.active,
            ).where(group_table.c.active.is_(True))
        )
        .mappings()
        .all()
    )
    active_group_ids = [str(row["id"]) for row in active_groups]

    group_unread_raw = (
        connection.execute(
            select(
                chat_message_table.c.receiver_group_id,
                func.count(chat_message_table.c.id).label("unread_count"),
            )
            .where(
                and_(
                    chat_message_table.c.receiver_group_id.in_(active_group_ids),
                    chat_message_table.c.sender_user_id != user_id,
                    chat_message_table.c.read_at.is_(None),
                    chat_message_table.c.deleted_at.is_(None),
                )
            )
            .group_by(chat_message_table.c.receiver_group_id)
        )
        .mappings()
        .all()
        if active_group_ids
        else []
    )
    group_unread_map = {
        str(row["receiver_group_id"]): int(row["unread_count"] or 0) for row in group_unread_raw
    }

    chat_groups = [
        {
            "id": str(row["id"]),
            "name": row["name"],
            "description": row["description"],
            "icon": row["icon"],
            "color": row["color"],
            "active": bool(row["active"]),
            "unread_count": group_unread_map.get(str(row["id"]), 0),
            "last_message": None,
            "last_message_at": None,
        }
        for row in active_groups
    ]

    all_active_users = (
        connection.execute(
            select(
                auth_user_table.c.id,
                auth_user_table.c.name,
                auth_user_table.c.email,
                auth_user_table.c.image,
                auth_user_table.c.is_active,
            ).where(auth_user_table.c.is_active.is_(True))
        )
        .mappings()
        .all()
    )
    active_user_ids = [str(row["id"]) for row in all_active_users]

    presence_rows = (
        connection.execute(
            select(
                chat_user_presence_table.c.user_id,
                chat_user_presence_table.c.status,
                chat_user_presence_table.c.last_activity,
            ).where(chat_user_presence_table.c.user_id.in_(active_user_ids))
        )
        .mappings()
        .all()
        if active_user_ids
        else []
    )
    presence_map = {
        str(row["user_id"]): {
            "status": row["status"],
            "last_activity": row["last_activity"],
        }
        for row in presence_rows
    }

    unread_counts_raw = (
        connection.execute(
            select(
                chat_message_table.c.sender_user_id,
                func.count(chat_message_table.c.id).label("unread_count"),
            )
            .where(
                and_(
                    chat_message_table.c.receiver_user_id == user_id,
                    chat_message_table.c.read_at.is_(None),
                    chat_message_table.c.deleted_at.is_(None),
                )
            )
            .group_by(chat_message_table.c.sender_user_id)
        )
        .mappings()
        .all()
    )
    unread_map = {
        str(row["sender_user_id"]): int(row["unread_count"] or 0) for row in unread_counts_raw
    }

    last_message_map: dict[str, dict[str, Any]] = {}

    sent_rows = (
        connection.execute(
            select(
                chat_message_table.c.receiver_user_id.label("other_user_id"),
                chat_message_table.c.content,
                chat_message_table.c.created_at,
            )
            .where(
                and_(
                    chat_message_table.c.sender_user_id == user_id,
                    chat_message_table.c.receiver_user_id.is_not(None),
                    chat_message_table.c.deleted_at.is_(None),
                )
            )
            .order_by(
                asc(chat_message_table.c.receiver_user_id), desc(chat_message_table.c.created_at)
            )
        )
        .mappings()
        .all()
    )
    received_rows = (
        connection.execute(
            select(
                chat_message_table.c.sender_user_id.label("other_user_id"),
                chat_message_table.c.content,
                chat_message_table.c.created_at,
            )
            .where(
                and_(
                    chat_message_table.c.receiver_user_id == user_id,
                    chat_message_table.c.deleted_at.is_(None),
                )
            )
            .order_by(
                asc(chat_message_table.c.sender_user_id), desc(chat_message_table.c.created_at)
            )
        )
        .mappings()
        .all()
    )

    for row in [*sent_rows, *received_rows]:
        other_user_id = row.get("other_user_id")
        if other_user_id is None:
            continue
        key = str(other_user_id)
        candidate = {
            "content": row["content"],
            "created_at": row["created_at"],
        }
        current = last_message_map.get(key)
        if current is None or candidate["created_at"] > current["created_at"]:
            last_message_map[key] = candidate

    chat_users = [
        {
            "id": str(row["id"]),
            "name": row["name"],
            "email": row["email"],
            "is_active": bool(row["is_active"]),
            "presence_status": presence_map.get(str(row["id"]), {}).get(
                "status", CHAT_PRESENCE_INVISIBLE
            ),
            "last_activity": presence_map.get(str(row["id"]), {}).get("last_activity"),
            "unread_count": unread_map.get(str(row["id"]), 0),
            "last_message": last_message_map.get(str(row["id"]), {}).get("content"),
            "last_message_at": last_message_map.get(str(row["id"]), {}).get("created_at"),
        }
        for row in all_active_users
    ]

    chat_users.sort(
        key=lambda user: (
            -int(user["unread_count"]),
            0 if user["presence_status"] == CHAT_PRESENCE_VISIBLE else 1,
            _sort_last_message_at(user["last_message_at"]),
            str(user["name"]),
            str(user["id"]),
        )
    )

    total_unread = sum(int(user["unread_count"]) for user in chat_users) + sum(
        int(group["unread_count"]) for group in chat_groups
    )

    return {
        "can_view_chat": True,
        "groups": chat_groups,
        "users": chat_users,
        "total_unread": total_unread,
    }


def get_unread_messages(
    connection: Connection,
    user_id: str,
    group_id: str | None = None,
    conversation_user_id: str | None = None,
    *,
    limit: int = CHAT_UNREAD_LIMIT,
) -> dict[str, Any]:
    chat_message_table = legacy_tables["chat_message"]
    auth_user_table = legacy_tables["user"]

    msg_select = select(
        chat_message_table.c.id,
        chat_message_table.c.content,
        chat_message_table.c.created_at,
        chat_message_table.c.sender_user_id,
        chat_message_table.c.receiver_group_id,
        chat_message_table.c.receiver_user_id,
        chat_message_table.c.deleted_at,
        chat_message_table.c.read_at,
        auth_user_table.c.name.label("sender_name"),
        auth_user_table.c.email.label("sender_email"),
        auth_user_table.c.image.label("sender_image"),
    ).select_from(
        chat_message_table.join(
            auth_user_table, auth_user_table.c.id == chat_message_table.c.sender_user_id
        )
    )

    if not group_id and not conversation_user_id:
        group_messages = (
            connection.execute(
                msg_select.where(
                    and_(
                        chat_message_table.c.deleted_at.is_(None),
                        chat_message_table.c.read_at.is_(None),
                        chat_message_table.c.sender_user_id != user_id,
                    )
                )
                .order_by(desc(chat_message_table.c.created_at))
                .limit(max(limit, 1) * 2)
            )
            .mappings()
            .all()
        )
        user_messages = (
            connection.execute(
                msg_select.where(
                    and_(
                        chat_message_table.c.receiver_user_id == user_id,
                        chat_message_table.c.deleted_at.is_(None),
                        chat_message_table.c.read_at.is_(None),
                        chat_message_table.c.sender_user_id != user_id,
                    )
                )
                .order_by(desc(chat_message_table.c.created_at))
                .limit(max(limit, 1) * 2)
            )
            .mappings()
            .all()
        )
        all_messages = [dict(row) for row in [*group_messages, *user_messages]]
        return {"messages": all_messages, "count": len(all_messages)}

    unread_messages: list[dict[str, Any]] = []
    if group_id:
        rows = (
            connection.execute(
                msg_select.where(
                    and_(
                        chat_message_table.c.receiver_group_id == group_id,
                        chat_message_table.c.deleted_at.is_(None),
                        chat_message_table.c.read_at.is_(None),
                        chat_message_table.c.sender_user_id != user_id,
                    )
                )
                .order_by(desc(chat_message_table.c.created_at))
                .limit(max(limit, 1))
            )
            .mappings()
            .all()
        )
        unread_messages = [dict(row) for row in rows]
    elif conversation_user_id:
        rows = (
            connection.execute(
                msg_select.where(
                    and_(
                        or_(
                            and_(
                                chat_message_table.c.sender_user_id == user_id,
                                chat_message_table.c.receiver_user_id == conversation_user_id,
                            ),
                            and_(
                                chat_message_table.c.sender_user_id == conversation_user_id,
                                chat_message_table.c.receiver_user_id == user_id,
                            ),
                        ),
                        chat_message_table.c.deleted_at.is_(None),
                        chat_message_table.c.read_at.is_(None),
                    )
                )
                .order_by(desc(chat_message_table.c.created_at))
                .limit(max(limit, 1))
            )
            .mappings()
            .all()
        )
        unread_messages = [dict(row) for row in rows if str(row["sender_user_id"]) != user_id]

    unread_messages.sort(key=lambda item: item["created_at"])
    return {"messages": unread_messages, "count": len(unread_messages)}


def get_messages_count(
    connection: Connection,
    current_user_id: str,
    group_id: str | None = None,
    conversation_user_id: str | None = None,
) -> int:
    if not group_id and not conversation_user_id:
        raise ChatServiceError("Especifique groupId ou userId.", 400)

    chat_message_table = legacy_tables["chat_message"]
    if group_id:
        result = (
            connection.execute(
                select(func.count(chat_message_table.c.id).label("total_count")).where(
                    and_(
                        chat_message_table.c.receiver_group_id == group_id,
                        chat_message_table.c.deleted_at.is_(None),
                    )
                )
            )
            .mappings()
            .first()
        )
        return int(result["total_count"] if result is not None else 0)

    target_user_id = conversation_user_id
    result = (
        connection.execute(
            select(func.count(chat_message_table.c.id).label("total_count")).where(
                and_(
                    or_(
                        and_(
                            chat_message_table.c.sender_user_id == current_user_id,
                            chat_message_table.c.receiver_user_id == target_user_id,
                        ),
                        and_(
                            chat_message_table.c.sender_user_id == target_user_id,
                            chat_message_table.c.receiver_user_id == current_user_id,
                        ),
                    ),
                    chat_message_table.c.deleted_at.is_(None),
                )
            )
        )
        .mappings()
        .first()
    )
    return int(result["total_count"] if result is not None else 0)


def mark_message_as_read(
    connection: Connection,
    current_user_id: str,
    message_id: str,
) -> dict[str, Any]:
    chat_message_table = legacy_tables["chat_message"]
    record = (
        connection.execute(
            select(
                chat_message_table.c.id,
                chat_message_table.c.sender_user_id,
                chat_message_table.c.receiver_group_id,
                chat_message_table.c.receiver_user_id,
                chat_message_table.c.read_at,
                chat_message_table.c.deleted_at,
            )
            .where(chat_message_table.c.id == message_id)
            .limit(1)
        )
        .mappings()
        .first()
    )
    if record is None or record["deleted_at"] is not None:
        raise ChatServiceError("Mensagem não encontrada.", 404)

    now = legacy_local_now()

    if record["receiver_group_id"] is not None:
        if str(record["sender_user_id"]) == current_user_id:
            raise ChatServiceError(
                "Você não pode marcar sua própria mensagem como lida.",
                403,
            )
        if record["read_at"] is None:
            connection.execute(
                update(chat_message_table)
                .where(chat_message_table.c.id == message_id)
                .values(read_at=now, updated_at=now)
            )
            connection.commit()
        return {
            "message_id": message_id,
            "target_id": str(record["receiver_group_id"]),
            "target_type": CHAT_CONVERSATION_TARGET_GROUP,
            "read_at": record["read_at"] or now,
            "updated_count": 0 if record["read_at"] is not None else 1,
        }

    receiver_user_id = record["receiver_user_id"]
    if receiver_user_id is None:
        raise ChatServiceError("Mensagem inválida.", 500)

    if str(receiver_user_id) != current_user_id:
        raise ChatServiceError("Você não pode marcar esta mensagem como lida.", 403)

    if record["read_at"] is None:
        connection.execute(
            update(chat_message_table)
            .where(chat_message_table.c.id == message_id)
            .values(read_at=now, updated_at=now)
        )
        connection.commit()

    return {
        "message_id": message_id,
        "target_id": str(record["sender_user_id"]),
        "target_type": CHAT_CONVERSATION_TARGET_USER,
        "read_at": record["read_at"] or now,
        "updated_count": 0 if record["read_at"] is not None else 1,
    }


def mark_messages_as_read(
    connection: Connection,
    current_user_id: str,
    target_id: str,
    target_type: str,
) -> dict[str, Any]:
    chat_message_table = legacy_tables["chat_message"]
    now = legacy_local_now()

    if target_type == CHAT_CONVERSATION_TARGET_GROUP:
        where_clause = and_(
            chat_message_table.c.receiver_group_id == target_id,
            chat_message_table.c.sender_user_id != current_user_id,
            chat_message_table.c.read_at.is_(None),
            chat_message_table.c.deleted_at.is_(None),
        )
    elif target_type == CHAT_CONVERSATION_TARGET_USER:
        where_clause = and_(
            chat_message_table.c.receiver_user_id == current_user_id,
            chat_message_table.c.sender_user_id == target_id,
            chat_message_table.c.read_at.is_(None),
            chat_message_table.c.deleted_at.is_(None),
        )
    else:
        raise ChatServiceError("Dados inválidos.", 400, field="type")

    ids = [
        str(row["id"])
        for row in connection.execute(select(chat_message_table.c.id).where(where_clause))
        .mappings()
        .all()
    ]
    if ids:
        connection.execute(
            update(chat_message_table)
            .where(chat_message_table.c.id.in_(ids))
            .values(read_at=now, updated_at=now)
        )
        connection.commit()

    return {
        "message_id": ids[0] if ids else "",
        "target_id": target_id,
        "target_type": target_type,
        "read_at": now,
        "updated_count": len(ids),
    }


def delete_message(connection: Connection, current_user_id: str, message_id: str) -> dict[str, Any]:
    chat_message_table = legacy_tables["chat_message"]
    record = (
        connection.execute(
            select(
                chat_message_table.c.id,
                chat_message_table.c.sender_user_id,
                chat_message_table.c.receiver_group_id,
                chat_message_table.c.receiver_user_id,
                chat_message_table.c.created_at,
                chat_message_table.c.deleted_at,
            )
            .where(chat_message_table.c.id == message_id)
            .limit(1)
        )
        .mappings()
        .first()
    )
    if record is None or record["deleted_at"] is not None:
        raise ChatServiceError("Mensagem não encontrada.", 404)

    if str(record["sender_user_id"]) != current_user_id:
        raise ChatServiceError(
            "Você não tem permissão para excluir esta mensagem.",
            403,
        )

    now = legacy_local_now()
    hours_since_created = now - record["created_at"]
    if hours_since_created > timedelta(hours=CHAT_MESSAGE_DELETE_WINDOW_HOURS):
        raise ChatServiceError(
            "Prazo para exclusão expirado (máximo 24 horas).",
            400,
        )

    connection.execute(
        update(chat_message_table)
        .where(chat_message_table.c.id == message_id)
        .values(
            deleted_at=now,
            content=CHAT_MESSAGE_DELETED_LABEL,
            updated_at=now,
        )
    )
    connection.commit()

    conversation = _resolve_conversation_target(
        current_user_id=current_user_id,
        sender_user_id=str(record["sender_user_id"]),
        receiver_group_id=(
            str(record["receiver_group_id"]) if record["receiver_group_id"] is not None else None
        ),
        receiver_user_id=(
            str(record["receiver_user_id"]) if record["receiver_user_id"] is not None else None
        ),
    )
    return {
        "message_id": message_id,
        "target_id": conversation["target_id"],
        "target_type": conversation["target_type"],
        "deleted_at": now,
    }


def get_chat_status_response(
    user_id: str,
    user_email: str,
    status: str,
) -> dict[str, Any]:
    return {
        "success": True,
        "message": f"Status do chat atualizado para: {status}",
        "user_id": user_id,
        "user_email": user_email,
        "status": status,
        "timestamp": get_now_timestamp(),
    }


def get_now_timestamp(now: datetime | None = None) -> str:
    current = now or legacy_local_now()
    hour = current.hour % 12 or 12
    meridiem = "AM" if current.hour < 12 else "PM"
    return (
        f"{current.month}/{current.day}/{current.year}, "
        f"{hour}:{current.minute:02d}:{current.second:02d} {meridiem}"
    )


def _parse_legacy_timestamp(value: str) -> datetime:
    normalized = value.strip().replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        return parsed
    zone = ZoneInfo(LEGACY_OPERATIONAL_TIMEZONE)
    return parsed.astimezone(zone).replace(tzinfo=None)


def _sort_last_message_at(value: Any) -> tuple[int, float]:
    if isinstance(value, datetime):
        localized = value.replace(tzinfo=ZoneInfo(LEGACY_OPERATIONAL_TIMEZONE))
        return (0, -localized.timestamp())
    return (1, 0.0)


def _resolve_conversation_target(
    *,
    current_user_id: str,
    sender_user_id: str,
    receiver_group_id: str | None,
    receiver_user_id: str | None,
) -> dict[str, str]:
    if receiver_group_id is not None:
        return {
            "target_id": receiver_group_id,
            "target_type": CHAT_CONVERSATION_TARGET_GROUP,
        }

    if receiver_user_id is not None:
        target_id = receiver_user_id if sender_user_id == current_user_id else sender_user_id
        return {
            "target_id": target_id,
            "target_type": CHAT_CONVERSATION_TARGET_USER,
        }

    raise ChatServiceError("Mensagem inválida.", 500)
