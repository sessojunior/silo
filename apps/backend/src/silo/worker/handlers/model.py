from __future__ import annotations

import logging
from collections.abc import Mapping
from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.engine import Connection

from silo.db.models import legacy_tables
from silo.db.serialization import serialize_legacy_row

logger = logging.getLogger(__name__)


async def model_handler(
    *,
    topic: str,
    partition: int,
    message_id: str,
    payload: object,
    connection: Connection,
) -> None:
    del topic, partition
    try:
        if not isinstance(payload, Mapping):
            return

        product_id_value = payload.get("productId") or payload.get("product_id")
        product_id = _optional_text(product_id_value)
        slug = _optional_text(payload.get("slug"))
        if not product_id and not slug:
            return

        product_table = legacy_tables["product"]
        where_clause = (
            product_table.c.id == product_id if product_id else product_table.c.slug == slug
        )
        row = (
            connection.execute(select(product_table).where(where_clause).limit(1))
            .mappings()
            .first()
        )
        if row is None:
            return

        product = serialize_legacy_row(row)
        existing = product.get("dataProductFlow") or product.get("data_product_flow") or []
        if not isinstance(existing, list):
            existing = []

        entry = {
            "receivedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "payload": payload.get("data") or payload.get("payload") or payload,
            "messageId": message_id,
        }
        next_flow = [*existing, entry]
        connection.execute(
            update(product_table)
            .where(product_table.c.id == product["id"])
            .values(data_product_flow=next_flow)
        )
    except Exception:
        logger.exception("[KAFKA][modelHandler] error")
        raise


def _optional_text(value: object | None) -> str | None:
    if isinstance(value, str):
        text = value.strip()
        return text or None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)
    return None


model_handler.__dict__["__worker_handler_name__"] = "modelHandler"
