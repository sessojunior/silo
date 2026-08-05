from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime
from typing import Any

from sqlalchemy import and_, delete, desc, insert, or_, select, update
from sqlalchemy.engine import Connection

from silo.db.models import legacy_tables
from silo.db.serialization import serialize_legacy_row
from silo.domain.model_run_status import normalize_model_run_status
from silo.domain.scheduling import SHIFT_CODES
from silo.services.legacy_utils import new_uuid, normalize_turn_list, optional_str, now_naive

SEED_MONITORING_PRODUCTS: tuple[dict[str, Any], ...] = (
    {
        "productId": "bam",
        "model": "BAM",
        "description": "Brazilian Atmospheric Model",
        "turns": (
            {"turn": "0", "status": "completed", "progress": 100},
            {"turn": "12", "status": "not_run", "progress": 0},
        ),
    },
    {
        "productId": "smec",
        "model": "SMEC",
        "description": "Sistema de Meteorologia e Climatologia",
        "turns": (
            {"turn": "0", "status": "completed", "progress": 100},
            {"turn": "12", "status": "with_problems", "progress": 38},
        ),
    },
    {
        "productId": "brams-15km",
        "model": "BRAMS AMS 15KM",
        "description": "Modelo regional de alta resolucao",
        "turns": (
            {"turn": "0", "status": "completed", "progress": 100},
            {"turn": "6", "status": "completed", "progress": 100},
            {"turn": "12", "status": "pending", "progress": 0},
            {"turn": "18", "status": "not_run", "progress": 0},
        ),
    },
    {
        "productId": "wrf",
        "model": "WRF",
        "description": "Weather Research and Forecasting",
        "turns": ({"turn": "0", "status": "completed", "progress": 100},),
    },
    {
        "productId": "eta-15km",
        "model": "ETA 15KM",
        "description": "Previsao regional com foco operacional",
        "turns": (
            {"turn": "0", "status": "with_problems", "progress": 22},
            {"turn": "6", "status": "not_run", "progress": 0},
            {"turn": "12", "status": "pending", "progress": 0},
            {"turn": "18", "status": "not_run", "progress": 0},
        ),
    },
    {
        "productId": "roms",
        "model": "ROMS",
        "description": "Modelo oceanico acoplado",
        "turns": (
            {"turn": "0", "status": "completed", "progress": 100},
            {"turn": "12", "status": "completed", "progress": 100},
        ),
    },
)

ALLOWED_PICTURE_CHECK_MODES = {"page", "items"}
ALLOWED_PICTURE_STATUSES = {"ok", "delayed", "offline", "undefined"}
ALLOWED_RADAR_STATUSES = {"ok", "delayed", "undefined", "off"}
ALLOWED_AVAILABILITY_EXCEPTION_TYPES = {"holiday", "pause", "extra"}
STATUS_PROGRESS = {
    "completed": 100,
    "with_problems": 38,
    "run_again": 52,
    "under_support": 66,
    "suspended": 0,
    "in_progress": 50,
    "pending": 0,
    "not_run": 0,
}


def list_picture_pages(connection: Connection) -> list[dict[str, object]]:
    page_table = legacy_tables["picture_page"]
    link_table = legacy_tables["picture_link"]

    pages = connection.execute(select(page_table).order_by(page_table.c.name.asc())).mappings().all()
    links = connection.execute(
        select(link_table).order_by(link_table.c.page_id.asc(), link_table.c.created_at.asc())
    ).mappings().all()

    links_by_page: dict[str, list[dict[str, object]]] = defaultdict(list)
    for link in links:
        serialized = serialize_legacy_row(link)
        serialized.setdefault("type", "link")
        links_by_page[str(link["page_id"])].append(serialized)

    result: list[dict[str, object]] = []
    for page in pages:
        page_dict = serialize_legacy_row(page)
        page_id = str(page["id"])
        page_links = links_by_page.get(page_id, [])
        delayed_links = sum(1 for item in page_links if item.get("status") == "delayed")
        offline_links = sum(1 for item in page_links if item.get("status") == "offline")
        online_links = sum(1 for item in page_links if item.get("status") == "ok")
        if offline_links > 0:
            page_status = "offline"
        elif delayed_links > 0:
            page_status = "delayed"
        else:
            page_status = "ok"
        page_dict.update(
            {
                "checkMode": page_dict.get("checkMode") or "page",
                "status": page_status,
                "delayedLinks": delayed_links,
                "offlineLinks": offline_links,
                "onlineLinks": online_links,
                "links": page_links,
            }
        )
        result.append(page_dict)

    return result


def create_picture_page(connection: Connection, data: dict[str, object]) -> dict[str, object]:
    page_table = legacy_tables["picture_page"]
    page_id = _required_text(data.get("id"))
    if page_id is None:
        raise ValueError("ID é obrigatório.")
    payload = _normalize_picture_page_payload(data)
    existing = connection.execute(
        select(page_table.c.id).where(page_table.c.id == page_id).limit(1)
    ).first()
    row = {
        "id": page_id,
        **payload,
        "created_at": now_naive(),
        "updated_at": now_naive(),
    }
    if existing is None:
        connection.execute(insert(page_table).values(row))
    else:
        connection.execute(
            update(page_table).where(page_table.c.id == page_id).values(**row)
        )
    connection.commit()
    return {"id": page_id}


def upsert_picture_page(connection: Connection, data: dict[str, object]) -> None:
    page_table = legacy_tables["picture_page"]
    page_id = _required_text(data.get("id"))
    if page_id is None:
        raise ValueError("ID é obrigatório.")

    payload = _normalize_picture_page_payload(data, preserve_status=True)
    existing = connection.execute(
        select(page_table).where(page_table.c.id == page_id).limit(1)
    ).mappings().first()
    if existing is None:
        connection.execute(
            insert(page_table).values(
                {
                    "id": page_id,
                    **payload,
                    "created_at": now_naive(),
                    "updated_at": now_naive(),
                }
            )
        )
    else:
        connection.execute(
            update(page_table)
            .where(page_table.c.id == page_id)
            .values(
                **payload,
                updated_at=now_naive(),
            )
        )
    connection.commit()


def delete_picture_page(connection: Connection, page_id: str) -> None:
    page_table = legacy_tables["picture_page"]
    link_table = legacy_tables["picture_link"]
    connection.execute(delete(link_table).where(link_table.c.page_id == page_id))
    connection.execute(delete(page_table).where(page_table.c.id == page_id))
    connection.commit()


def upsert_picture_link(connection: Connection, data: dict[str, object]) -> None:
    link_table = legacy_tables["picture_link"]
    page_table = legacy_tables["picture_page"]
    link_id = _required_text(data.get("id"))
    if link_id is None:
        raise ValueError("ID é obrigatório.")

    page_id = _required_text(data.get("pageId"))
    if page_id is None:
        raise ValueError("pageId é obrigatório.")

    page_exists = connection.execute(
        select(page_table.c.id).where(page_table.c.id == page_id).limit(1)
    ).first()
    if page_exists is None:
        raise LookupError("Página não encontrada.")

    payload = {
        "page_id": page_id,
        "slug": _required_text(data.get("slug")) or link_id,
        "name": _required_text(data.get("name")) or _required_text(data.get("slug")) or link_id,
        "url": _required_text(data.get("url")) or "",
        "size": _required_text(data.get("size")) or "",
        "last_update": _parse_datetimeish(data.get("lastUpdate")) or now_naive(),
        "delay": _required_text(data.get("delay")) or "",
        "delay_minutes": _optional_int(data.get("delayMinutes")),
        "status": _normalize_picture_status(data.get("status"), default="ok"),
    }

    existing = connection.execute(
        select(link_table.c.id).where(link_table.c.id == link_id).limit(1)
    ).first()
    row = {
        "id": link_id,
        **payload,
        "created_at": now_naive(),
    }
    if existing is None:
        connection.execute(insert(link_table).values(row))
    else:
        connection.execute(
            update(link_table).where(link_table.c.id == link_id).values(**row)
        )
    connection.commit()


def delete_picture_link(connection: Connection, link_id: str) -> None:
    link_table = legacy_tables["picture_link"]
    connection.execute(delete(link_table).where(link_table.c.id == link_id))
    connection.commit()


def list_radar_groups(connection: Connection) -> list[dict[str, object]]:
    table = legacy_tables["radar_group"]
    rows = connection.execute(
        select(table).order_by(table.c.sort_order.asc(), table.c.name.asc())
    ).mappings().all()
    return [serialize_legacy_row(row) for row in rows]


def upsert_radar_group(connection: Connection, data: dict[str, object]) -> None:
    table = legacy_tables["radar_group"]
    group_id = _required_text(data.get("id"))
    if group_id is None:
        raise ValueError("ID é obrigatório.")
    payload = {
        "slug": _required_text(data.get("slug")) or group_id,
        "name": _required_text(data.get("name")) or group_id,
        "sort_order": _optional_int(data.get("sortOrder")) or 0,
    }
    existing = connection.execute(select(table.c.id).where(table.c.id == group_id).limit(1)).first()
    if existing is None:
        connection.execute(
            insert(table).values(
                id=group_id,
                **payload,
                created_at=now_naive(),
                updated_at=now_naive(),
            )
        )
    else:
        connection.execute(
            update(table).where(table.c.id == group_id).values(**payload, updated_at=now_naive())
        )
    connection.commit()


def delete_radar_group(connection: Connection, group_id: str) -> None:
    radar_table = legacy_tables["radar"]
    group_table = legacy_tables["radar_group"]
    linked = connection.execute(
        select(radar_table.c.id).where(radar_table.c.group_id == group_id).limit(1)
    ).first()
    if linked is not None:
        raise LookupError("Este grupo possui radares vinculados e não pode ser excluído.")
    connection.execute(delete(group_table).where(group_table.c.id == group_id))
    connection.commit()


def list_radars(connection: Connection) -> list[dict[str, object]]:
    table = legacy_tables["radar"]
    rows = connection.execute(
        select(table).order_by(table.c.group_id.asc(), table.c.name.asc())
    ).mappings().all()
    result: list[dict[str, object]] = []
    for row in rows:
        serialized = serialize_legacy_row(row)
        if serialized.get("status") not in ALLOWED_RADAR_STATUSES:
            serialized["status"] = "undefined"
        result.append(serialized)
    return result


def upsert_radar(connection: Connection, data: dict[str, object]) -> None:
    table = legacy_tables["radar"]
    group_table = legacy_tables["radar_group"]
    radar_id = _required_text(data.get("id"))
    if radar_id is None:
        raise ValueError("ID é obrigatório.")
    group_id = _required_text(data.get("groupId"))
    if group_id is None:
        raise ValueError("groupId é obrigatório.")

    group_exists = connection.execute(
        select(group_table.c.id).where(group_table.c.id == group_id).limit(1)
    ).first()
    if group_exists is None:
        raise LookupError("Grupo não encontrado.")

    payload = {
        "group_id": group_id,
        "slug": _required_text(data.get("slug")) or radar_id,
        "name": _required_text(data.get("name")) or radar_id,
        "description": _required_text(data.get("description")),
        "webhook_url": _required_text(data.get("webhookUrl")),
        "log_url": _required_text(data.get("logUrl")),
        "status": _normalize_radar_status(data.get("status"), default="ok"),
        "delay": _required_text(data.get("delay")),
        "delay_minutes": _optional_int(data.get("delayMinutes")),
        "log_date": _parse_datetimeish(data.get("logDate")) or now_naive(),
        "active": _optional_bool(data.get("active"), default=True),
    }
    existing = connection.execute(select(table.c.id).where(table.c.id == radar_id).limit(1)).first()
    row = {
        "id": radar_id,
        **payload,
        "created_at": now_naive(),
    }
    if existing is None:
        connection.execute(insert(table).values(row))
    else:
        connection.execute(
            update(table).where(table.c.id == radar_id).values(**row)
        )
    connection.commit()


def delete_radar(connection: Connection, radar_id: str) -> None:
    table = legacy_tables["radar"]
    connection.execute(delete(table).where(table.c.id == radar_id))
    connection.commit()


def get_monitoring_products(
    connection: Connection,
    active_products: list[dict[str, object]],
) -> dict[str, object]:
    product_table = legacy_tables["product"]
    activity_table = legacy_tables["product_activity"]

    active_by_slug = {
        str(item.get("slug")): {
            "slug": str(item.get("slug")),
            "name": str(item.get("name") or item.get("slug") or ""),
        }
        for item in active_products
        if isinstance(item.get("slug"), str) and item.get("slug")
    }

    if active_by_slug:
        products = connection.execute(
            select(product_table).where(product_table.c.slug.in_(tuple(active_by_slug.keys())))
        ).mappings().all()
    else:
        products = connection.execute(
            select(product_table).where(product_table.c.available.is_(True))
        ).mappings().all()

    if not products:
        return {
            "referenceDate": _today_text(),
            "products": _build_seed_monitoring_products(active_by_slug),
        }

    selected_products = []
    for product_row in products:
        slug = str(product_row["slug"])
        selected_products.append(
                {
                    "id": str(product_row["id"]),
                    "slug": slug,
                    "name": active_by_slug.get(slug, {}).get("name", str(product_row["name"])),
                    "description": optional_str(product_row.get("description")),
                    "turns": normalize_turn_list(product_row.get("turns"), SHIFT_CODES),
                }
            )

    product_ids = [item["id"] for item in selected_products]
    activity_rows = []
    if product_ids:
        activity_rows = connection.execute(
            select(activity_table)
            .where(activity_table.c.product_id.in_(tuple(product_ids)))
            .order_by(
                activity_table.c.product_id.asc(),
                activity_table.c.date.asc(),
                activity_table.c.turn.asc(),
                activity_table.c.created_at.asc(),
            )
        ).mappings().all()

    reference_date = _latest_activity_date(activity_rows) or _today_text()
    activity_by_product_turn: dict[tuple[str, str], dict[str, object]] = {}
    for row in activity_rows:
        row_date = _date_text(row.get("date"))
        if row_date != reference_date:
            continue
        key = (str(row["product_id"]), str(row["turn"]))
        activity_by_product_turn[key] = serialize_legacy_row(row)

    output_products: list[dict[str, object]] = []
    for product_item in selected_products:
        turns: list[dict[str, object]] = []
        for turn_code in product_item["turns"]:
            activity = activity_by_product_turn.get((product_item["id"], str(turn_code)))
            if activity is None:
                status = _missing_turn_status(reference_date, turn_code)
                progress = 0
            else:
                status = _normalize_monitoring_status(activity.get("status"))
                progress = _status_progress(status)
            turns.append(
                {
                    "turn": str(turn_code),
                    "status": status,
                    "progress": progress,
                }
            )

        output_products.append(
            {
                "productId": product_item["slug"],
                "model": product_item["name"],
                "description": product_item["description"],
                "turns": turns,
            }
        )

    return {"referenceDate": reference_date, "products": output_products}


def _build_seed_monitoring_products(active_by_slug: dict[str, dict[str, str]]) -> list[dict[str, object]]:
    matched: list[dict[str, object]] = []
    for seed in SEED_MONITORING_PRODUCTS:
        product_id = str(seed["productId"])
        model = str(seed["model"])
        match = active_by_slug.get(product_id)
        if match is None:
            for candidate in active_by_slug.values():
                if candidate["name"].strip().lower() == model.strip().lower():
                    match = candidate
                    break
        if match is None:
            continue
        matched.append(
            {
                "productId": match["slug"],
                "model": match["name"],
                "description": seed.get("description"),
                "turns": [
                    {
                        "turn": str(turn["turn"]),
                        "status": _normalize_monitoring_status(turn["status"]),
                        "progress": _status_progress(str(turn["status"])),
                    }
                    for turn in seed["turns"]
                ],
            }
        )
    if matched:
        return matched

    fallback = []
    for slug, item in active_by_slug.items():
        fallback.append(
            {
                "productId": slug,
                "model": item["name"],
                "description": None,
                "turns": [
                    {
                        "turn": turn,
                        "status": "not_run",
                        "progress": 0,
                    }
                    for turn in SHIFT_CODES
                ],
            }
        )
    return fallback


def _normalize_picture_page_payload(
    data: dict[str, object],
    *,
    preserve_status: bool = False,
) -> dict[str, object]:
    status = _normalize_picture_status(data.get("status"), default="ok" if not preserve_status else None)
    payload = {
        "slug": _required_text(data.get("slug")) or "",
        "name": _required_text(data.get("name")) or "",
        "url": _required_text(data.get("url")) or "",
        "description": _required_text(data.get("description")),
        "check_mode": _normalize_check_mode(data.get("checkMode"), default="page"),
        "status": status or "ok",
        "delay": _required_text(data.get("delay")),
        "delay_minutes": _optional_int(data.get("delayMinutes")),
        "delayed_links": _optional_int(data.get("delayedLinks")) or 0,
        "offline_links": _optional_int(data.get("offlineLinks")) or 0,
    }
    return payload


def _normalize_check_mode(value: object | None, *, default: str = "page") -> str:
    text = _required_text(value)
    if text in ALLOWED_PICTURE_CHECK_MODES:
        return text
    return default


def _normalize_picture_status(value: object | None, *, default: str | None = None) -> str:
    text = _required_text(value)
    if text in ALLOWED_PICTURE_STATUSES:
        return text
    if default is not None:
        return default
    return "ok"


def _normalize_radar_status(value: object | None, *, default: str = "ok") -> str:
    text = _required_text(value)
    if text in ALLOWED_RADAR_STATUSES:
        return text
    return default


def _normalize_monitoring_status(value: object | None) -> str:
    status = normalize_model_run_status(value)
    if status == "completed":
        return "completed"
    if status in {"with_problems", "run_again", "under_support"}:
        return status
    if status == "suspended":
        return "suspended"
    if status == "in_progress":
        return "in_progress"
    if status == "pending":
        return "pending"
    return "not_run"


def _status_progress(status: str) -> int:
    return STATUS_PROGRESS.get(status, 0)


def _latest_activity_date(rows: list[dict[str, object]]) -> str | None:
    latest: date | None = None
    for row in rows:
        row_date = row.get("date")
        if isinstance(row_date, date) and (latest is None or row_date > latest):
            latest = row_date
    return latest.isoformat() if latest is not None else None


def _missing_turn_status(reference_date: str, turn_code: str) -> str:
    now = datetime.now().astimezone()
    today = now.date().isoformat()
    if reference_date == today and int(turn_code) > now.hour:
        return "pending"
    return "not_run"


def _date_text(value: object | None) -> str | None:
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, str):
        text = value.strip()
        return text or None
    return None


def _parse_datetimeish(value: object | None) -> datetime | None:
    if isinstance(value, datetime):
        return value
    text = optional_str(value)
    if text is None:
        return None
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def _required_text(value: object | None) -> str | None:
    text = optional_str(value)
    if text is None:
        return None
    normalized = text.strip()
    return normalized or None


def _optional_int(value: object | None) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            return int(text)
        except ValueError:
            return None
    return None


def _optional_bool(value: object | None, *, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes", "y", "on"}:
            return True
        if normalized in {"false", "0", "no", "n", "off"}:
            return False
    return default


def _today_text() -> str:
    return datetime.now().date().isoformat()
