from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime

import pytest
from sqlalchemy import Boolean, Column, Date, DateTime, Integer, JSON, MetaData, String, Table, create_engine, insert

from silo.services import monitoring_data


@dataclass(frozen=True, slots=True)
class _MonitoringIds:
    page_1: str = "page-1"
    page_2: str = "page-2"
    link_1: str = "link-1"
    link_2: str = "link-2"
    group_1: str = "group-1"
    group_2: str = "group-2"
    radar_1: str = "radar-1"
    radar_2: str = "radar-2"
    product_1: str = "product-1"
    product_2: str = "product-2"
    activity_1: str = "activity-1"
    activity_2: str = "activity-2"


class _FixedDateTime(datetime):
    @classmethod
    def now(cls, tz=None):  # type: ignore[override]
        value = cls(2026, 3, 6, 10, 0, tzinfo=UTC)
        if tz is None:
            return value
        return value.astimezone(tz)


def _build_tables() -> dict[str, Table]:
    metadata = MetaData()
    return {
        "picture_page": Table(
            "picture_page",
            metadata,
            Column("id", String, primary_key=True),
            Column("slug", String, nullable=False),
            Column("name", String, nullable=False),
            Column("url", String, nullable=False),
            Column("description", String, nullable=True),
            Column("check_mode", String, nullable=False),
            Column("status", String, nullable=False),
            Column("delay", String, nullable=True),
            Column("delay_minutes", Integer, nullable=True),
            Column("delayed_links", Integer, nullable=False),
            Column("offline_links", Integer, nullable=False),
            Column("created_at", DateTime, nullable=False),
            Column("updated_at", DateTime, nullable=False),
        ),
        "picture_link": Table(
            "picture_link",
            metadata,
            Column("id", String, primary_key=True),
            Column("page_id", String, nullable=False),
            Column("slug", String, nullable=False),
            Column("name", String, nullable=False),
            Column("url", String, nullable=False),
            Column("size", String, nullable=False),
            Column("last_update", DateTime, nullable=False),
            Column("delay", String, nullable=False),
            Column("delay_minutes", Integer, nullable=True),
            Column("status", String, nullable=False),
            Column("created_at", DateTime, nullable=False),
        ),
        "radar_group": Table(
            "radar_group",
            metadata,
            Column("id", String, primary_key=True),
            Column("slug", String, nullable=False),
            Column("name", String, nullable=False),
            Column("sort_order", Integer, nullable=False),
            Column("created_at", DateTime, nullable=False),
            Column("updated_at", DateTime, nullable=False),
        ),
        "radar": Table(
            "radar",
            metadata,
            Column("id", String, primary_key=True),
            Column("group_id", String, nullable=False),
            Column("slug", String, nullable=False),
            Column("name", String, nullable=False),
            Column("description", String, nullable=True),
            Column("webhook_url", String, nullable=True),
            Column("log_url", String, nullable=True),
            Column("status", String, nullable=False),
            Column("delay", String, nullable=True),
            Column("delay_minutes", Integer, nullable=True),
            Column("log_date", DateTime, nullable=False),
            Column("active", Boolean, nullable=False),
            Column("created_at", DateTime, nullable=False),
        ),
        "product": Table(
            "product",
            metadata,
            Column("id", String, primary_key=True),
            Column("slug", String, nullable=False),
            Column("name", String, nullable=False),
            Column("available", Boolean, nullable=False),
            Column("turns", JSON, nullable=False),
            Column("description", String, nullable=True),
        ),
        "product_activity": Table(
            "product_activity",
            metadata,
            Column("id", String, primary_key=True),
            Column("product_id", String, nullable=False),
            Column("user_id", String, nullable=True),
            Column("date", Date, nullable=False),
            Column("turn", Integer, nullable=False),
            Column("status", String, nullable=False),
            Column("description", String, nullable=True),
            Column("intervention", String, nullable=True),
            Column("problem_category_id", String, nullable=True),
            Column("created_at", DateTime, nullable=False),
            Column("updated_at", DateTime, nullable=False),
        ),
    }


def _seed_monitoring_data(connection, tables: dict[str, Table]) -> _MonitoringIds:  # type: ignore[no-untyped-def]
    ids = _MonitoringIds()
    now = datetime(2026, 3, 6, 10, 0, tzinfo=UTC).replace(tzinfo=None)

    connection.execute(
        insert(tables["picture_page"]),
        [
            {
                "id": ids.page_1,
                "slug": "page-1",
                "name": "Página 1",
                "url": "https://example.test/page-1",
                "description": "Primeira página",
                "check_mode": "page",
                "status": "ok",
                "delay": "0m",
                "delay_minutes": 0,
                "delayed_links": 0,
                "offline_links": 0,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": ids.page_2,
                "slug": "page-2",
                "name": "Página 2",
                "url": "https://example.test/page-2",
                "description": "Segunda página",
                "check_mode": "items",
                "status": "delayed",
                "delay": "5m",
                "delay_minutes": 5,
                "delayed_links": 1,
                "offline_links": 0,
                "created_at": now,
                "updated_at": now,
            },
        ],
    )
    connection.execute(
        insert(tables["picture_link"]),
        [
            {
                "id": ids.link_1,
                "page_id": ids.page_1,
                "slug": "link-1",
                "name": "Link 1",
                "url": "https://example.test/link-1",
                "size": "120 KB",
                "last_update": now,
                "delay": "0m",
                "delay_minutes": 0,
                "status": "offline",
                "created_at": now,
            },
            {
                "id": ids.link_2,
                "page_id": ids.page_2,
                "slug": "link-2",
                "name": "Link 2",
                "url": "https://example.test/link-2",
                "size": "200 KB",
                "last_update": now,
                "delay": "5m",
                "delay_minutes": 5,
                "status": "delayed",
                "created_at": now,
            },
        ],
    )
    connection.execute(
        insert(tables["radar_group"]),
        [
            {
                "id": ids.group_1,
                "slug": "group-1",
                "name": "Grupo 1",
                "sort_order": 1,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": ids.group_2,
                "slug": "group-2",
                "name": "Grupo 2",
                "sort_order": 0,
                "created_at": now,
                "updated_at": now,
            },
        ],
    )
    connection.execute(
        insert(tables["radar"]),
        [
            {
                "id": ids.radar_1,
                "group_id": ids.group_1,
                "slug": "radar-1",
                "name": "Radar 1",
                "description": "Radar principal",
                "webhook_url": "https://example.test/radar-1",
                "log_url": "https://example.test/radar-1/log",
                "status": "ok",
                "delay": "0m",
                "delay_minutes": 0,
                "log_date": now,
                "active": True,
                "created_at": now,
            },
            {
                "id": ids.radar_2,
                "group_id": ids.group_1,
                "slug": "radar-2",
                "name": "Radar 2",
                "description": "Radar secundário",
                "webhook_url": "https://example.test/radar-2",
                "log_url": "https://example.test/radar-2/log",
                "status": "unexpected",
                "delay": "10m",
                "delay_minutes": 10,
                "log_date": now,
                "active": False,
                "created_at": now,
            },
        ],
    )
    connection.execute(
        insert(tables["product"]),
        [
            {
                "id": ids.product_1,
                "slug": "bam",
                "name": "BAM",
                "available": True,
                "turns": ["0", "12"],
                "description": "Produto BAM",
            },
            {
                "id": ids.product_2,
                "slug": "smec",
                "name": "SMEC",
                "available": True,
                "turns": ["0", "6", "12"],
                "description": "Produto SMEC",
            },
        ],
    )
    connection.execute(
        insert(tables["product_activity"]),
        [
            {
                "id": ids.activity_1,
                "product_id": ids.product_1,
                "user_id": "user-1",
                "date": date(2026, 3, 6),
                "turn": 0,
                "status": "completed",
                "description": "Execução concluída",
                "intervention": None,
                "problem_category_id": None,
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": ids.activity_2,
                "product_id": ids.product_1,
                "user_id": "user-1",
                "date": date(2026, 3, 6),
                "turn": 6,
                "status": "with_problems",
                "description": "Com problema",
                "intervention": "Ajuste manual",
                "problem_category_id": None,
                "created_at": now,
                "updated_at": now,
            },
        ],
    )
    return ids


@pytest.fixture()
def monitoring_connection(tmp_path, monkeypatch):
    engine = create_engine(
        f"sqlite+pysqlite:///{tmp_path / 'monitoring.sqlite3'}",
        future=True,
        connect_args={"check_same_thread": False},
    )
    tables = _build_tables()
    tables["picture_page"].metadata.create_all(engine)
    monkeypatch.setattr(monitoring_data, "legacy_tables", tables)
    monkeypatch.setattr(monitoring_data, "datetime", _FixedDateTime)
    with engine.begin() as connection:
        ids = _seed_monitoring_data(connection, tables)

    connection = engine.connect()
    try:
        yield connection, ids, tables
    finally:
        connection.close()


def test_monitoring_data_pages_radars_and_products(monitoring_connection) -> None:
    connection, ids, tables = monitoring_connection

    pages = monitoring_data.list_picture_pages(connection)
    assert [page["id"] for page in pages] == [ids.page_1, ids.page_2]
    assert pages[0]["status"] == "offline"
    assert pages[0]["offlineLinks"] == 1
    assert pages[1]["status"] == "delayed"
    assert pages[1]["delayedLinks"] == 1

    created_page = monitoring_data.create_picture_page(
        connection,
        {
            "id": "page-3",
            "slug": "page-3",
            "name": "Página 3",
            "url": "https://example.test/page-3",
            "description": "Terceira página",
            "checkMode": "items",
            "status": "offline",
            "delay": "7m",
            "delayMinutes": 7,
        },
    )
    assert created_page == {"id": "page-3"}

    monitoring_data.upsert_picture_page(
        connection,
        {
            "id": "page-3",
            "slug": "page-3",
            "name": "Página 3 atualizada",
            "url": "https://example.test/page-3",
            "description": "Terceira página atualizada",
            "checkMode": "bad-value",
            "status": "bad-value",
            "delay": "9m",
            "delayMinutes": 9,
        },
    )
    page_row = connection.execute(
        tables["picture_page"].select().where(tables["picture_page"].c.id == "page-3")
    ).mappings().first()
    assert page_row is not None
    assert page_row["name"] == "Página 3 atualizada"
    assert page_row["check_mode"] == "page"
    assert page_row["status"] == "ok"

    monitoring_data.upsert_picture_link(
        connection,
        {
            "id": "link-3",
            "pageId": "page-3",
            "slug": "link-3",
            "name": "Link 3",
            "url": "https://example.test/link-3",
            "size": "90 KB",
            "lastUpdate": "2026-03-06T10:00:00",
            "delay": "1m",
            "delayMinutes": 1,
            "status": "ok",
        },
    )
    monitoring_data.upsert_picture_link(
        connection,
        {
            "id": "link-3",
            "pageId": "page-3",
            "slug": "link-3",
            "name": "Link 3 atualizado",
            "url": "https://example.test/link-3",
            "size": "95 KB",
            "lastUpdate": "2026-03-06T10:05:00",
            "delay": "2m",
            "delayMinutes": 2,
            "status": "delayed",
        },
    )
    link_row = connection.execute(
        tables["picture_link"].select().where(tables["picture_link"].c.id == "link-3")
    ).mappings().first()
    assert link_row is not None
    assert link_row["name"] == "Link 3 atualizado"
    assert link_row["status"] == "delayed"

    radar_groups = monitoring_data.list_radar_groups(connection)
    assert [group["id"] for group in radar_groups] == [ids.group_2, ids.group_1]

    monitoring_data.upsert_radar_group(
        connection,
        {"id": "group-3", "slug": "group-3", "name": "Grupo 3", "sortOrder": 3},
    )
    monitoring_data.upsert_radar_group(
        connection,
        {"id": "group-3", "slug": "group-3", "name": "Grupo 3 atualizado", "sortOrder": 4},
    )
    group_row = connection.execute(
        tables["radar_group"].select().where(tables["radar_group"].c.id == "group-3")
    ).mappings().first()
    assert group_row is not None
    assert group_row["name"] == "Grupo 3 atualizado"
    assert group_row["sort_order"] == 4

    radars = monitoring_data.list_radars(connection)
    assert any(radar["status"] == "undefined" for radar in radars)
    assert any(radar["groupId"] == ids.group_1 for radar in radars)

    monitoring_data.upsert_radar(
        connection,
        {
            "id": "radar-3",
            "groupId": ids.group_2,
            "slug": "radar-3",
            "name": "Radar 3",
            "description": "Radar novo",
            "webhookUrl": "https://example.test/radar-3",
            "logUrl": "https://example.test/radar-3/log",
            "status": "off",
            "delay": "3m",
            "delayMinutes": 3,
            "logDate": "2026-03-06T10:00:00",
            "active": False,
        },
    )
    radar_row = connection.execute(
        tables["radar"].select().where(tables["radar"].c.id == "radar-3")
    ).mappings().first()
    assert radar_row is not None
    assert radar_row["status"] == "off"
    assert radar_row["active"] is False

    monitoring_data.delete_picture_link(connection, ids.link_1)
    assert (
        connection.execute(
            tables["picture_link"].select().where(tables["picture_link"].c.id == ids.link_1)
        ).mappings().first()
        is None
    )

    monitoring_data.delete_picture_page(connection, ids.page_2)
    assert (
        connection.execute(
            tables["picture_page"].select().where(tables["picture_page"].c.id == ids.page_2)
        ).mappings().first()
        is None
    )

    monitoring_data.delete_radar(connection, ids.radar_2)
    assert (
        connection.execute(
            tables["radar"].select().where(tables["radar"].c.id == ids.radar_2)
        ).mappings().first()
        is None
    )

    monitoring_data.delete_radar_group(connection, "group-3")
    assert (
        connection.execute(
            tables["radar_group"].select().where(tables["radar_group"].c.id == "group-3")
        ).mappings().first()
        is None
    )

    monitoring_products = monitoring_data.get_monitoring_products(
        connection,
        [{"slug": "bam", "name": "BAM"}],
    )
    assert monitoring_products["referenceDate"] == "2026-03-06"
    assert monitoring_products["products"][0]["productId"] == "bam"
    assert monitoring_products["products"][0]["turns"][0]["status"] == "completed"
    assert monitoring_products["products"][0]["turns"][1]["status"] == "pending"


def test_monitoring_data_rejects_invalid_inputs_and_missing_links(monitoring_connection) -> None:
    connection, ids, _tables = monitoring_connection

    with pytest.raises(ValueError):
        monitoring_data.create_picture_page(connection, {"name": "Sem id"})

    with pytest.raises(ValueError):
        monitoring_data.upsert_picture_page(connection, {"name": "Sem id"})

    with pytest.raises(ValueError):
        monitoring_data.upsert_picture_link(connection, {"pageId": ids.page_1})

    with pytest.raises(LookupError):
        monitoring_data.upsert_picture_link(
            connection,
            {
                "id": "missing-link",
                "pageId": "missing-page",
                "name": "Link",
                "slug": "link",
                "url": "https://example.test",
                "size": "1 KB",
                "delay": "0m",
            },
        )

    with pytest.raises(LookupError):
        monitoring_data.delete_radar_group(connection, ids.group_1)

    with pytest.raises(LookupError):
        monitoring_data.upsert_radar(
            connection,
            {
                "id": "radar-missing",
                "groupId": "missing-group",
                "name": "Radar",
            },
        )


def test_monitoring_data_seed_fallback_when_products_are_missing(tmp_path, monkeypatch) -> None:
    engine = create_engine(
        f"sqlite+pysqlite:///{tmp_path / 'monitoring-empty.sqlite3'}",
        future=True,
        connect_args={"check_same_thread": False},
    )
    tables = _build_tables()
    tables["picture_page"].metadata.create_all(engine)
    monkeypatch.setattr(monitoring_data, "legacy_tables", tables)
    monkeypatch.setattr(monitoring_data, "datetime", _FixedDateTime)

    with engine.connect() as connection:
        fallback = monitoring_data.get_monitoring_products(
            connection,
            [{"slug": "bam", "name": "BAM"}],
        )

    assert fallback["referenceDate"] == "2026-03-06"
    assert fallback["products"][0]["productId"] == "bam"
    assert fallback["products"][0]["turns"][0]["status"] == "completed"


def test_monitoring_data_helpers_cover_normalization_and_seed_matching(monkeypatch) -> None:
    monkeypatch.setattr(monitoring_data, "datetime", _FixedDateTime)

    matched = monitoring_data._build_seed_monitoring_products(  # noqa: SLF001
        {
            "bam": {"slug": "bam", "name": "BAM"},
            "smec-alias": {"slug": "smec-alias", "name": "SMEC"},
            "ignored": {"slug": "ignored", "name": "IGNORED"},
        }
    )
    assert [item["productId"] for item in matched] == ["bam", "smec-alias"]
    assert matched[1]["turns"][0]["status"] == "completed"

    assert monitoring_data._normalize_check_mode("items") == "items"  # noqa: SLF001
    assert monitoring_data._normalize_check_mode("bad") == "page"  # noqa: SLF001
    assert monitoring_data._normalize_picture_status("offline") == "offline"  # noqa: SLF001
    assert monitoring_data._normalize_picture_status("bad") == "ok"  # noqa: SLF001
    assert monitoring_data._normalize_picture_status("bad", default="delayed") == "delayed"  # noqa: SLF001
    assert monitoring_data._normalize_radar_status("off") == "off"  # noqa: SLF001
    assert monitoring_data._normalize_radar_status("bad") == "ok"  # noqa: SLF001

    assert monitoring_data._normalize_monitoring_status("completed") == "completed"  # noqa: SLF001
    assert monitoring_data._normalize_monitoring_status("with_problems") == "with_problems"  # noqa: SLF001
    assert monitoring_data._normalize_monitoring_status("run_again") == "run_again"  # noqa: SLF001
    assert monitoring_data._normalize_monitoring_status("under_support") == "under_support"  # noqa: SLF001
    assert monitoring_data._normalize_monitoring_status("suspended") == "suspended"  # noqa: SLF001
    assert monitoring_data._normalize_monitoring_status("in_progress") == "in_progress"  # noqa: SLF001
    assert monitoring_data._normalize_monitoring_status("pending") == "pending"  # noqa: SLF001
    assert monitoring_data._normalize_monitoring_status("not_run") == "not_run"  # noqa: SLF001

    assert monitoring_data._status_progress("completed") == 100  # noqa: SLF001
    assert monitoring_data._status_progress("missing") == 0  # noqa: SLF001

    assert monitoring_data._latest_activity_date([]) is None  # noqa: SLF001
    assert monitoring_data._latest_activity_date([{ "date": date(2026, 3, 5) }, { "date": date(2026, 3, 6) }]) == "2026-03-06"  # noqa: SLF001

    assert monitoring_data._missing_turn_status("2026-03-06", "12") == "pending"  # noqa: SLF001
    assert monitoring_data._missing_turn_status("2026-03-06", "0") == "not_run"  # noqa: SLF001
    assert monitoring_data._missing_turn_status("2026-03-05", "12") == "not_run"  # noqa: SLF001

    assert monitoring_data._date_text(date(2026, 3, 6)) == "2026-03-06"  # noqa: SLF001
    assert monitoring_data._date_text(" 2026-03-06 ") == "2026-03-06"  # noqa: SLF001
    assert monitoring_data._date_text("   ") is None  # noqa: SLF001
    assert monitoring_data._date_text(None) is None  # noqa: SLF001

    parsed = monitoring_data._parse_datetimeish("2026-03-06T10:00:00")  # noqa: SLF001
    assert parsed is not None and parsed.year == 2026 and parsed.minute == 0
    assert monitoring_data._parse_datetimeish(_FixedDateTime(2026, 3, 6, 10, 0, tzinfo=UTC)) is not None  # noqa: SLF001
    assert monitoring_data._parse_datetimeish("bad") is None  # noqa: SLF001
    assert monitoring_data._parse_datetimeish(None) is None  # noqa: SLF001

    assert monitoring_data._required_text("  texto  ") == "texto"  # noqa: SLF001
    assert monitoring_data._required_text("   ") is None  # noqa: SLF001
    assert monitoring_data._required_text(None) is None  # noqa: SLF001

    assert monitoring_data._optional_int(True) is None  # noqa: SLF001
    assert monitoring_data._optional_int(7) == 7  # noqa: SLF001
    assert monitoring_data._optional_int("8") == 8  # noqa: SLF001
    assert monitoring_data._optional_int("   ") is None  # noqa: SLF001
    assert monitoring_data._optional_int("bad") is None  # noqa: SLF001
    assert monitoring_data._optional_int(None) is None  # noqa: SLF001

    assert monitoring_data._optional_bool(True) is True  # noqa: SLF001
    assert monitoring_data._optional_bool(False) is False  # noqa: SLF001
    assert monitoring_data._optional_bool("true") is True  # noqa: SLF001
    assert monitoring_data._optional_bool("off") is False  # noqa: SLF001
    assert monitoring_data._optional_bool("maybe", default=True) is True  # noqa: SLF001
    assert monitoring_data._optional_bool("maybe", default=False) is False  # noqa: SLF001

    assert monitoring_data._today_text() == "2026-03-06"  # noqa: SLF001
