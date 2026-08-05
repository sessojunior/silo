from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Header
from sqlalchemy import select
from sqlalchemy.engine import Connection

from silo.api.dependencies import get_db
from silo.api.responses import json_error_response
from silo.config import load_settings
from silo.db.models import legacy_tables

router = APIRouter(prefix="/api/product-flow", tags=["product-flow"])


@router.post("/receive")
async def receive_product_flow(
    payload: dict[str, object],
    x_api_key: str | None = Header(default=None, alias="x-api-key"),
    db: Connection = Depends(get_db),
):
    settings = load_settings()
    expected_key = settings.product_flow_api_key.get_secret_value()
    if expected_key and x_api_key != expected_key:
        return json_error_response(401, "Não autorizado.")

    product_id = _optional_str(payload.get("productId"))
    slug = _optional_str(payload.get("slug"))
    entry_payload = payload.get("payload")
    if not product_id and not slug:
        return json_error_response(
            400,
            "productId ou slug são obrigatórios no corpo da requisição.",
        )

    product_table = legacy_tables["product"]
    statement = select(product_table.c.id, product_table.c.slug, product_table.c.data_product_flow)
    if product_id:
        statement = statement.where(product_table.c.id == product_id)
    else:
        statement = statement.where(product_table.c.slug == slug)
    product_row = db.execute(statement.limit(1)).mappings().first()
    if product_row is None:
        return json_error_response(404, "Produto não encontrado.")

    entry = {
        "receivedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "payload": entry_payload,
    }

    current_flow = product_row["data_product_flow"]
    if not isinstance(current_flow, list):
        current_flow = []
    current_flow = [*current_flow, entry]

    db.execute(
        product_table.update()
        .where(product_table.c.id == product_row["id"])
        .values(data_product_flow=current_flow)
    )
    db.commit()

    return {
        "success": True,
        "ok": True,
        "data": {"entry": entry},
        "entry": entry,
    }


def _optional_str(value: object | None) -> str | None:
    return value if isinstance(value, str) and value.strip() else None
