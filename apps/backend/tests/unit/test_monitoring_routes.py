from __future__ import annotations

import json
from types import SimpleNamespace

import pytest
from fastapi.responses import JSONResponse

from silo.api.routers import monitoring as monitoring_router


def _payload(response):
    if isinstance(response, JSONResponse):
        return json.loads(response.body)
    return response


@pytest.mark.asyncio
async def test_monitoring_routes_cover_validation_and_success_paths(monkeypatch) -> None:
    page_calls: list[dict[str, object]] = []
    link_calls: list[dict[str, object]] = []
    radar_group_calls: list[dict[str, object]] = []
    radar_calls: list[dict[str, object]] = []

    async def _monitoring_products_stub(products):
        return {
            "referenceDate": "2026-03-06",
            "products": [{"productId": "bam", "turns": [{"status": "completed"}]}],
            "count": len(products),
        }

    async def _monitoring_products_error_stub(_products):
        raise RuntimeError("boom")

    monkeypatch.setattr(monitoring_router, "new_uuid", lambda: "page-new")
    monkeypatch.setattr(
        monitoring_router,
        "list_picture_pages",
        lambda db: [{"id": "page-1", "name": "Pagina 1"}],
    )
    monkeypatch.setattr(
        monitoring_router,
        "create_picture_page",
        lambda db, payload: page_calls.append(dict(payload)),
    )
    monkeypatch.setattr(
        monitoring_router,
        "upsert_picture_page",
        lambda db, payload: page_calls.append(dict(payload)),
    )
    monkeypatch.setattr(
        monitoring_router,
        "delete_picture_page",
        lambda db, page_id: page_calls.append({"delete": page_id}),
    )
    monkeypatch.setattr(
        monitoring_router,
        "upsert_picture_link",
        lambda db, payload: link_calls.append(dict(payload)) or None,
    )
    monkeypatch.setattr(
        monitoring_router,
        "delete_picture_link",
        lambda db, link_id: link_calls.append({"delete": link_id}),
    )
    monkeypatch.setattr(
        monitoring_router,
        "list_radar_groups",
        lambda db: [{"id": "group-1", "name": "Grupo 1"}],
    )
    monkeypatch.setattr(
        monitoring_router,
        "upsert_radar_group",
        lambda db, payload: radar_group_calls.append(dict(payload)) or None,
    )
    monkeypatch.setattr(
        monitoring_router,
        "delete_radar_group",
        lambda db, group_id: radar_group_calls.append({"delete": group_id}),
    )
    monkeypatch.setattr(
        monitoring_router,
        "list_radars",
        lambda db: [{"id": "radar-1", "name": "Radar 1"}],
    )
    monkeypatch.setattr(
        monitoring_router,
        "upsert_radar",
        lambda db, payload: radar_calls.append(dict(payload)) or None,
    )
    monkeypatch.setattr(
        monitoring_router,
        "delete_radar",
        lambda db, radar_id: radar_calls.append({"delete": radar_id}),
    )
    monkeypatch.setattr(
        monitoring_router,
        "get_monitoring_products_from_kafka_rest",
        _monitoring_products_stub,
    )

    pages = await monitoring_router.get_picture_pages(object(), object())
    assert pages["data"]["items"][0]["id"] == "page-1"

    pages_failure = _payload(
        await monitoring_router.get_picture_pages(object(), object())
    )
    assert pages_failure["success"] is True

    invalid_picture_page = _payload(
        await monitoring_router.post_picture_page(
            {"name": "Pagina sem url"},
            object(),
            object(),
        )
    )
    assert invalid_picture_page["success"] is False

    created_picture_page = await monitoring_router.post_picture_page(
        {
            "slug": "pagina-1",
            "name": "Pagina 1",
            "url": "https://example.test/pagina-1",
            "description": "Descricao",
            "checkMode": "page",
            "status": "ok",
            "delay": "0m",
            "delayMinutes": 0,
            "delayedLinks": 0,
            "offlineLinks": 0,
        },
        object(),
        object(),
    )
    assert created_picture_page.status_code == 201
    assert _payload(created_picture_page)["data"]["id"] == "page-new"

    updated_picture_page = await monitoring_router.put_picture_page(
        {
            "id": "page-1",
            "slug": "pagina-1",
            "name": "Pagina 1 atualizada",
            "url": "https://example.test/pagina-1",
            "description": "Descricao atualizada",
            "checkMode": "items",
            "status": "delayed",
        },
        object(),
        object(),
    )
    assert updated_picture_page["success"] is True
    assert page_calls

    deleted_picture_page = await monitoring_router.delete_picture_page_route("page-1", object(), object())
    assert deleted_picture_page["success"] is True

    missing_picture_page = _payload(
        await monitoring_router.delete_picture_page_route(None, object(), object())
    )
    assert missing_picture_page["success"] is False

    picture_link_missing = _payload(
        await monitoring_router.put_picture_link(
            {"id": "link-1", "pageId": "page-1", "slug": "link-1"},
            object(),
            object(),
        )
    )
    assert picture_link_missing["success"] is False

    picture_link = await monitoring_router.put_picture_link(
        {
            "id": "link-1",
            "pageId": "page-1",
            "slug": "link-1",
            "name": "Link 1",
            "url": "https://example.test/link-1",
            "size": "10 KB",
            "lastUpdate": "2026-03-06T10:00:00Z",
            "delay": "0m",
            "delayMinutes": 0,
            "status": "ok",
        },
        object(),
        object(),
    )
    assert picture_link["success"] is True

    missing_link_delete = _payload(await monitoring_router.delete_picture_link_route(None, object(), object()))
    assert missing_link_delete["success"] is False
    deleted_link = await monitoring_router.delete_picture_link_route("link-1", object(), object())
    assert deleted_link["success"] is True

    radar_groups = await monitoring_router.get_radar_groups(object(), object())
    assert radar_groups["data"]["items"][0]["id"] == "group-1"

    radar_group_invalid = _payload(
        await monitoring_router.post_radar_group({"slug": "grupo-sem-nome"}, object(), object())
    )
    assert radar_group_invalid["success"] is False

    radar_group = await monitoring_router.post_radar_group(
        {"id": "group-1", "slug": "group-1", "name": "Grupo 1", "sortOrder": 1},
        object(),
        object(),
    )
    assert radar_group["success"] is True

    radar_group_update = await monitoring_router.put_radar_group(
        {"id": "group-1", "slug": "group-1", "name": "Grupo 1 atualizado", "sortOrder": 2},
        object(),
        object(),
    )
    assert radar_group_update["success"] is True

    radar_group_delete_missing = _payload(
        await monitoring_router.delete_radar_group_route(None, object(), object())
    )
    assert radar_group_delete_missing["success"] is False
    radar_group_delete = await monitoring_router.delete_radar_group_route("group-1", object(), object())
    assert radar_group_delete["success"] is True

    radars = await monitoring_router.get_radars(object(), object())
    assert radars["data"]["items"][0]["id"] == "radar-1"

    radar_invalid = _payload(
        await monitoring_router.put_radar(
            {"id": "radar-1", "slug": "radar-1", "name": "Radar sem grupo"},
            object(),
            object(),
        )
    )
    assert radar_invalid["success"] is False

    radar = await monitoring_router.put_radar(
        {
            "id": "radar-1",
            "slug": "radar-1",
            "groupId": "group-1",
            "name": "Radar 1",
            "description": "Descricao",
            "webhookUrl": "https://example.test/radar-1",
            "logUrl": "https://example.test/radar-1/log",
            "status": "ok",
            "delay": "0m",
            "delayMinutes": 0,
            "logDate": "2026-03-06T10:00:00Z",
            "active": True,
        },
        object(),
        object(),
    )
    assert radar["success"] is True

    radar_delete_missing = _payload(await monitoring_router.delete_radar_route(None, object(), object()))
    assert radar_delete_missing["success"] is False
    radar_delete = await monitoring_router.delete_radar_route("radar-1", object(), object())
    assert radar_delete["success"] is True

    seed = await monitoring_router.seed_radars(object())
    assert seed["success"] is True

    monitoring_products = await monitoring_router.monitoring_products(
        {"products": [{"slug": "bam", "name": "BAM"}]},
        SimpleNamespace(id="user-1"),
    )
    assert monitoring_products["data"]["referenceDate"] == "2026-03-06"
    assert monitoring_products["data"]["count"] == 1

    monitoring_products_no_list = await monitoring_router.monitoring_products({}, SimpleNamespace(id="user-1"))
    assert monitoring_products_no_list["data"]["count"] == 0

    monkeypatch.setattr(
        monitoring_router,
        "get_monitoring_products_from_kafka_rest",
        _monitoring_products_error_stub,
    )
    monitoring_error = _payload(
        await monitoring_router.monitoring_products({"products": []}, SimpleNamespace(id="user-1"))
    )
    assert monitoring_error["success"] is False


@pytest.mark.asyncio
async def test_monitoring_routes_cover_error_and_helper_branches(monkeypatch) -> None:
    def _body(response):
        if isinstance(response, JSONResponse):
            return json.loads(response.body)
        return response

    monkeypatch.setattr(monitoring_router, "new_uuid", lambda: "uuid-new")

    assert monitoring_router._required_text("  texto  ") == "texto"  # noqa: SLF001
    assert monitoring_router._required_text("   ") is None  # noqa: SLF001
    assert monitoring_router._optional_text("  texto  ") == "texto"  # noqa: SLF001
    assert monitoring_router._optional_text(123) is None  # noqa: SLF001
    assert monitoring_router._optional_int("7") == 7  # noqa: SLF001
    assert monitoring_router._optional_int(True) is None  # noqa: SLF001
    assert monitoring_router._optional_bool("on") is True  # noqa: SLF001
    assert monitoring_router._optional_bool("off") is False  # noqa: SLF001
    assert monitoring_router._optional_bool(None, default=True) is True  # noqa: SLF001

    invalid_page = monitoring_router._validate_picture_page_payload({"name": "Página 1"}, require_id=True)  # noqa: SLF001
    assert isinstance(invalid_page, JSONResponse)
    valid_page = monitoring_router._validate_picture_page_payload(  # noqa: SLF001
        {
            "id": "page-1",
            "slug": "page-1",
            "name": "Página 1",
            "url": "https://example.test/page-1",
            "checkMode": "page",
            "status": "ok",
        },
        require_id=True,
    )
    assert valid_page["id"] == "page-1"

    invalid_link = monitoring_router._validate_picture_link_payload({"pageId": "page-1"})  # noqa: SLF001
    assert isinstance(invalid_link, JSONResponse)
    valid_link = monitoring_router._validate_picture_link_payload(  # noqa: SLF001
        {
            "id": "link-1",
            "pageId": "page-1",
            "slug": "link-1",
            "url": "https://example.test/link-1",
            "status": "ok",
        }
    )
    assert valid_link["name"] == "link-1"

    invalid_group = monitoring_router._validate_radar_group_payload({"slug": "group-1"})  # noqa: SLF001
    assert isinstance(invalid_group, JSONResponse)
    valid_group = monitoring_router._validate_radar_group_payload(  # noqa: SLF001
        {"id": "group-1", "slug": "group-1", "name": "Grupo 1", "sortOrder": "7"}
    )
    assert valid_group["sortOrder"] == 7

    invalid_radar = monitoring_router._validate_radar_payload({"slug": "radar-1"})  # noqa: SLF001
    assert isinstance(invalid_radar, JSONResponse)
    valid_radar = monitoring_router._validate_radar_payload(  # noqa: SLF001
        {
            "id": "radar-1",
            "slug": "radar-1",
            "groupId": "group-1",
            "name": "Radar 1",
            "active": "off",
        }
    )
    assert valid_radar["active"] is False

    monkeypatch.setattr(
        monitoring_router,
        "list_picture_pages",
        lambda _db: (_ for _ in ()).throw(RuntimeError("boom")),
    )
    assert _body(await monitoring_router.get_picture_pages(object(), object()))["success"] is False

    monkeypatch.setattr(
        monitoring_router,
        "create_picture_page",
        lambda _db, _payload: (_ for _ in ()).throw(RuntimeError("boom")),
    )
    assert _body(
        await monitoring_router.post_picture_page(
            {
                "slug": "page-2",
                "name": "Página 2",
                "url": "https://example.test/page-2",
                "checkMode": "page",
                "status": "ok",
            },
            object(),
            object(),
        )
    )["success"] is False

    monkeypatch.setattr(
        monitoring_router,
        "upsert_picture_page",
        lambda _db, _payload: (_ for _ in ()).throw(LookupError("Página não encontrada.")),
    )
    assert _body(
        await monitoring_router.put_picture_page(
            {
                "id": "page-2",
                "slug": "page-2",
                "name": "Página 2",
                "url": "https://example.test/page-2",
                "checkMode": "items",
                "status": "delayed",
            },
            object(),
            object(),
        )
    )["success"] is False

    monkeypatch.setattr(
        monitoring_router,
        "delete_picture_page",
        lambda _db, _id: (_ for _ in ()).throw(RuntimeError("boom")),
    )
    assert _body(await monitoring_router.delete_picture_page_route("page-1", object(), object()))["success"] is False

    monkeypatch.setattr(
        monitoring_router,
        "upsert_picture_link",
        lambda _db, _payload: (_ for _ in ()).throw(ValueError("Link inválido.")),
    )
    assert _body(
        await monitoring_router.put_picture_link(
            {
                "id": "link-2",
                "pageId": "page-1",
                "slug": "link-2",
                "url": "https://example.test/link-2",
                "status": "ok",
            },
            object(),
            object(),
        )
    )["success"] is False

    monkeypatch.setattr(
        monitoring_router,
        "delete_picture_link",
        lambda _db, _id: (_ for _ in ()).throw(RuntimeError("boom")),
    )
    assert _body(await monitoring_router.delete_picture_link_route("link-1", object(), object()))["success"] is False

    monkeypatch.setattr(
        monitoring_router,
        "list_radar_groups",
        lambda _db: (_ for _ in ()).throw(RuntimeError("boom")),
    )
    assert _body(await monitoring_router.get_radar_groups(object(), object()))["success"] is False

    monkeypatch.setattr(
        monitoring_router,
        "upsert_radar_group",
        lambda _db, _payload: (_ for _ in ()).throw(RuntimeError("boom")),
    )
    assert _body(
        await monitoring_router.post_radar_group(
            {"slug": "group-2", "name": "Grupo 2"},
            object(),
            object(),
        )
    )["success"] is False

    monkeypatch.setattr(
        monitoring_router,
        "delete_radar_group",
        lambda _db, _id: (_ for _ in ()).throw(LookupError("Grupo não encontrado.")),
    )
    assert _body(await monitoring_router.delete_radar_group_route("group-1", object(), object()))["success"] is False

    monkeypatch.setattr(
        monitoring_router,
        "list_radars",
        lambda _db: (_ for _ in ()).throw(RuntimeError("boom")),
    )
    assert _body(await monitoring_router.get_radars(object(), object()))["success"] is False

    monkeypatch.setattr(
        monitoring_router,
        "upsert_radar",
        lambda _db, _payload: (_ for _ in ()).throw(ValueError("Radar inválido.")),
    )
    assert _body(
        await monitoring_router.put_radar(
            {
                "id": "radar-2",
                "slug": "radar-2",
                "groupId": "group-1",
                "name": "Radar 2",
            },
            object(),
            object(),
        )
    )["success"] is False

    monkeypatch.setattr(
        monitoring_router,
        "delete_radar",
        lambda _db, _id: (_ for _ in ()).throw(RuntimeError("boom")),
    )
    assert _body(await monitoring_router.delete_radar_route("radar-1", object(), object()))["success"] is False
