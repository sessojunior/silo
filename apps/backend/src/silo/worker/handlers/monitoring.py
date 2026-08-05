from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.engine import Connection

from silo.db.models import legacy_tables
from silo.db.serialization import serialize_legacy_row

logger = logging.getLogger(__name__)


async def monitoring_handler(
    *,
    topic: str,
    partition: int,
    message_id: str,
    payload: object,
    connection: Connection,
) -> None:
    del topic, partition, message_id
    try:
        if not isinstance(payload, Mapping):
            return

        slug = _optional_text(payload.get("slug"))
        if slug is None:
            slug = _optional_text(payload.get("pageSlug"))
        if slug is None:
            slug = _optional_text(payload.get("page_id"))
        if slug is None:
            return

        picture_page_table = legacy_tables["picture_page"]
        row = (
            connection.execute(
                select(picture_page_table).where(picture_page_table.c.slug == slug).limit(1)
            )
            .mappings()
            .first()
        )
        if row is None:
            return

        page = serialize_legacy_row(row)
        updates: dict[str, Any] = {}
        if "status" in payload:
            updates["status"] = payload.get("status")
        if "delayMinutes" in payload:
            updates["delay_minutes"] = payload.get("delayMinutes")
        if "delay" in payload:
            updates["delay"] = payload.get("delay")

        if not updates:
            return

        connection.execute(
            update(picture_page_table)
            .where(picture_page_table.c.id == page["id"])
            .values(**updates)
        )
    except Exception:
        logger.exception("[KAFKA][monitoringHandler] error")
        raise


def _optional_text(value: object | None) -> str | None:
    if isinstance(value, str):
        text = value.strip()
        return text or None
    return None


monitoring_handler.__dict__["__worker_handler_name__"] = "monitoringHandler"
