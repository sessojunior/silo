from __future__ import annotations

import json
from types import SimpleNamespace

import pytest
from fastapi.responses import JSONResponse

from silo.api.routers import products as products_router
from silo.services.common import service_failure, service_success


def _payload(response):
    if isinstance(response, JSONResponse):
        return json.loads(response.body)
    return response


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("Produto Único", "produto-unico"),
        ("  Produto 123  ", "produto-123"),
        ("", ""),
    ],
)
def test_products_router_helpers_match_expected_normalization(value, expected) -> None:
    assert products_router.format_slug(value) == expected


def test_products_router_turn_priority_and_url_helpers() -> None:
    assert products_router._normalize_turns(["0", "12", "", None]) == ["0", "12"]  # noqa: SLF001
    assert products_router._normalize_turns("0, 6, 12") == ["0", "6", "12", "18"]  # noqa: SLF001
    assert products_router._normalize_priority("urgent") == "urgent"  # noqa: SLF001
    assert products_router._normalize_priority("bad") is None  # noqa: SLF001
    assert products_router._normalize_url("https://example.test/flow") == "https://example.test/flow"  # noqa: SLF001
    assert products_router._normalize_url("bad url") == "bad url"  # noqa: SLF001
    assert products_router._nullable_text("  texto  ") == "texto"  # noqa: SLF001
    assert products_router._nullable_text("   ") is None  # noqa: SLF001
    assert products_router._require_text("  texto  ") == "texto"  # noqa: SLF001
    assert products_router._require_text("   ") is None  # noqa: SLF001
    assert products_router._optional_str("  texto  ") == "  texto  "  # noqa: SLF001
    assert products_router._optional_str(None) is None  # noqa: SLF001


@pytest.mark.asyncio
async def test_products_router_crud_paths(monkeypatch) -> None:
    monkeypatch.setattr(
        products_router,
        "_list_products",
        lambda *args, **kwargs: {"items": [{"id": "product-1", "name": "Produto 1"}], "total": 1},
    )
    monkeypatch.setattr(
        products_router,
        "_create_product",
        lambda *args, **kwargs: service_success({"id": "product-1", "name": "Produto 1"}),
    )
    monkeypatch.setattr(
        products_router,
        "_update_product",
        lambda *args, **kwargs: service_success({"id": "product-1", "name": "Produto 1 atualizado"}),
    )
    monkeypatch.setattr(
        products_router,
        "_delete_product",
        lambda *args, **kwargs: service_success(None),
    )
    deleted_uploads: list[tuple[str, str]] = []
    monkeypatch.setattr(
        products_router,
        "delete_upload_file",
        lambda kind, filename: deleted_uploads.append((kind, filename)) or True,
    )

    list_all = await products_router.list_products(None, None, None, None, None, object(), object())
    assert list_all["data"]["items"][0]["id"] == "product-1"

    list_by_slug = await products_router.list_products("produto-1", None, None, None, None, object(), object())
    assert list_by_slug["data"]["products"][0]["id"] == "product-1"

    created = await products_router.create_product(
        {"name": "Produto 1", "slug": "produto-1"},
        object(),
        object(),
    )
    assert created.status_code == 201
    assert _payload(created)["data"]["id"] == "product-1"

    updated = await products_router.update_product(
        {"id": "product-1", "name": "Produto 1 atualizado"},
        object(),
        object(),
    )
    assert updated["data"]["name"] == "Produto 1 atualizado"

    deleted = await products_router.delete_product("product-1", object(), object())
    assert deleted["success"] is True

    missing_delete = _payload(await products_router.delete_product(None, object(), object()))
    assert missing_delete["success"] is False
    assert missing_delete["field"] == "id"

    monkeypatch.setattr(
        products_router,
        "_create_product",
        lambda *args, **kwargs: service_failure("Falha ao criar", 400, field="name"),
    )
    failed_create = _payload(
        await products_router.create_product({"name": "Produto 1"}, object(), object())
    )
    assert failed_create["success"] is False
    assert failed_create["field"] == "name"

    monkeypatch.setattr(
        products_router,
        "_update_product",
        lambda *args, **kwargs: service_failure("Falha ao atualizar", 404),
    )
    failed_update = _payload(
        await products_router.update_product({"id": "product-1", "name": "Produto"}, object(), object())
    )
    assert failed_update["success"] is False

    monkeypatch.setattr(
        products_router,
        "_delete_product",
        lambda *args, **kwargs: service_failure("Falha ao excluir", 404),
    )
    failed_delete = _payload(await products_router.delete_product("missing", object(), object()))
    assert failed_delete["success"] is False

    products_router._delete_upload_url("/uploads/manual/alpha.webp")  # noqa: SLF001
    products_router._delete_upload_url("/uploads/manual/alpha.webp?x=1")  # noqa: SLF001
    products_router._delete_upload_url("https://example.test/alpha.webp")  # noqa: SLF001
    assert deleted_uploads == [("manual", "alpha.webp"), ("manual", "alpha.webp")]
