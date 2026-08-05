from __future__ import annotations

import json
from datetime import datetime

import pytest
from fastapi.responses import JSONResponse
from sqlalchemy import Column, DateTime, Integer, MetaData, String, Table, create_engine, insert

from silo.api.routers import incidents as incidents_router


FIXED_NOW = datetime(2026, 8, 4, 12, 0)


def _build_tables() -> dict[str, Table]:
    metadata = MetaData()
    return {
        "product_problem_category": Table(
            "product_problem_category",
            metadata,
            Column("id", String, primary_key=True),
            Column("name", String, nullable=False),
            Column("color", String, nullable=False),
            Column("is_system", Integer, nullable=False),
            Column("sort_order", Integer, nullable=False),
            Column("updated_at", DateTime, nullable=True),
        ),
        "product_activity": Table(
            "product_activity",
            metadata,
            Column("id", String, primary_key=True),
            Column("problem_category_id", String, nullable=False),
        ),
        "product_problem": Table(
            "product_problem",
            metadata,
            Column("id", String, primary_key=True),
            Column("problem_category_id", String, nullable=False),
        ),
    }


def _payload(response):
    if isinstance(response, JSONResponse):
        return json.loads(response.body)
    return response


def _seed_incident_data(connection, tables: dict[str, Table]) -> None:  # type: ignore[no-untyped-def]
    connection.execute(
        insert(tables["product_problem_category"]),
        [
            {
                "id": incidents_router.NO_INCIDENTS_CATEGORY_ID,
                "name": "Nao houve incidentes",
                "color": "#10B981",
                "is_system": 1,
                "sort_order": 0,
                "updated_at": FIXED_NOW,
            },
            {
                "id": "category-1",
                "name": "Falha de modelo",
                "color": "#EF4444",
                "is_system": 0,
                "sort_order": 10,
                "updated_at": FIXED_NOW,
            },
            {
                "id": "category-2",
                "name": "Atraso de dados",
                "color": "#F59E0B",
                "is_system": 0,
                "sort_order": 20,
                "updated_at": FIXED_NOW,
            },
        ],
    )
    connection.execute(
        insert(tables["product_activity"]),
        [
            {"id": "activity-1", "problem_category_id": "category-1"},
            {"id": "activity-2", "problem_category_id": "category-1"},
        ],
    )
    connection.execute(
        insert(tables["product_problem"]),
        [{"id": "problem-1", "problem_category_id": "category-1"}],
    )


def test_incident_crud_helpers(monkeypatch: pytest.MonkeyPatch) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    tables = _build_tables()
    tables["product_problem_category"].metadata.create_all(engine)

    monkeypatch.setattr(incidents_router, "legacy_tables", tables)
    monkeypatch.setattr(incidents_router, "_now_naive", lambda: FIXED_NOW)
    monkeypatch.setattr(incidents_router, "_new_uuid", lambda: "new-incident-id")

    with engine.begin() as connection:
        _seed_incident_data(connection, tables)

    with engine.connect() as connection:
        items = incidents_router._list_incidents(connection)  # noqa: SLF001
        assert [item["id"] for item in items] == ["category-1", "category-2"]

        invalid_create = incidents_router._create_incident(connection, {"name": "A"})  # noqa: SLF001
        assert invalid_create["ok"] is False
        assert invalid_create["error"].startswith("Nome do incidente")

        duplicate_create = incidents_router._create_incident(connection, {"name": "Falha de modelo"})  # noqa: SLF001
        assert duplicate_create["ok"] is False

        created = incidents_router._create_incident(  # noqa: SLF001
            connection,
            {"name": "Novo incidente", "color": "#111111"},
        )
        assert created["ok"] is True
        assert created["data"]["id"] == "new-incident-id"

        invalid_update = incidents_router._update_incident(connection, {"id": "category-1", "name": "A"})  # noqa: SLF001
        assert invalid_update["ok"] is False

        duplicate_update = incidents_router._update_incident(  # noqa: SLF001
            connection,
            {"id": "category-2", "name": "Falha de modelo"},
        )
        assert duplicate_update["ok"] is False

        system_update = incidents_router._update_incident(  # noqa: SLF001
            connection,
            {"id": incidents_router.NO_INCIDENTS_CATEGORY_ID, "name": "Nao mexer"},
        )
        assert system_update["ok"] is False

        updated = incidents_router._update_incident(  # noqa: SLF001
            connection,
            {"id": "category-2", "name": "Incidente atualizado", "color": "#222222"},
        )
        assert updated["ok"] is True

        usage = incidents_router._get_incident_usage(connection, "category-1")  # noqa: SLF001
        assert usage["data"]["inUse"] is True
        assert usage["data"]["usageCount"] == 3
        assert usage["data"]["usageDetails"] == {"activities": 2, "problems": 1}

        used_delete = incidents_router._delete_incident(connection, "category-1")  # noqa: SLF001
        assert used_delete["ok"] is False

        safe_delete = incidents_router._delete_incident(connection, "category-2")  # noqa: SLF001
        assert safe_delete["ok"] is True

        unsafe_image = incidents_router._delete_incident_image("../bad.webp")  # noqa: SLF001
        assert unsafe_image["ok"] is False


@pytest.mark.asyncio
async def test_incident_route_wrappers(monkeypatch: pytest.MonkeyPatch) -> None:
    deleted_uploads: list[tuple[str, str]] = []

    monkeypatch.setattr(incidents_router, "list_upload_files", lambda kind: [{"filename": f"{kind}-1.webp"}])
    monkeypatch.setattr(incidents_router, "decode_base64_data_uri", lambda _value: b"image-bytes")
    monkeypatch.setattr(
        incidents_router,
        "store_buffer_as_webp",
        lambda kind, filename, buffer: type("Stored", (), {"filename": filename, "url": f"/uploads/{kind}/{filename}"})(),
    )
    monkeypatch.setattr(incidents_router, "is_safe_filename", lambda filename: filename != "bad.webp")
    monkeypatch.setattr(
        incidents_router,
        "delete_upload_file",
        lambda kind, filename: deleted_uploads.append((kind, filename)) or True,
    )
    monkeypatch.setattr(incidents_router, "_delete_incident_image", lambda filename: {"success": True, "data": None})

    items = _payload(await incidents_router.list_images(object()))
    assert items["data"]["items"][0]["filename"] == "incidents-1.webp"

    created = _payload(
        await incidents_router.create_image(
            {"image": "data:image/webp;base64,AAA", "filename": "incident.webp"},
            object(),
        )
    )
    assert created["data"]["filename"] == "incident.webp"
    assert created["data"]["url"] == "/uploads/incidents/incident.webp"

    invalid_payload = _payload(await incidents_router.create_image({"image": 1, "filename": "x"}, object()))
    assert invalid_payload["success"] is False

    invalid_delete = _payload(await incidents_router.delete_image(filename=None, _current_user=object()))
    assert invalid_delete["success"] is False

    deleted = _payload(await incidents_router.delete_image(filename="incident.webp", _current_user=object()))
    assert deleted["success"] is True
    assert deleted_uploads == []


@pytest.mark.asyncio
async def test_incident_route_wrappers_cover_error_and_helper_branches(monkeypatch: pytest.MonkeyPatch) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    tables = _build_tables()
    tables["product_problem_category"].metadata.create_all(engine)

    monkeypatch.setattr(incidents_router, "legacy_tables", tables)
    monkeypatch.setattr(incidents_router, "_now_naive", lambda: FIXED_NOW)
    monkeypatch.setattr(incidents_router, "_new_uuid", lambda: "new-incident-id")

    with engine.begin() as connection:
        _seed_incident_data(connection, tables)

    deleted_uploads: list[tuple[str, str]] = []
    monkeypatch.setattr(incidents_router, "is_safe_filename", lambda filename: filename != "bad.webp")
    monkeypatch.setattr(
        incidents_router,
        "delete_upload_file",
        lambda kind, filename: deleted_uploads.append((kind, filename)) or True,
    )
    monkeypatch.setattr(
        incidents_router,
        "list_upload_files",
        lambda kind: [{"filename": f"{kind}-1.webp"}],
    )

    with engine.connect() as connection:
        assert incidents_router._optional_str("  texto  ") == "  texto  "  # noqa: SLF001
        assert incidents_router._optional_str(123) is None  # noqa: SLF001
        assert incidents_router._new_uuid() == "new-incident-id"  # noqa: SLF001
        assert incidents_router._now_naive() == FIXED_NOW  # noqa: SLF001

        safe_delete = incidents_router._delete_incident_image("incident.webp")  # noqa: SLF001
        assert safe_delete["ok"] is True
        unsafe_delete = incidents_router._delete_incident_image("bad.webp")  # noqa: SLF001
        assert unsafe_delete["ok"] is False
        assert deleted_uploads == [("incidents", "incident.webp")]

        incidents = _payload(await incidents_router.list_incidents(object(), connection))
        assert incidents["data"][0]["id"] == "category-1"

        monkeypatch.setattr(
            incidents_router,
            "_create_incident",
            lambda *_args, **_kwargs: incidents_router.service_failure("boom", 500),
        )
        create_error = _payload(
            await incidents_router.create_incident({"name": "Novo incidente"}, object(), connection)
        )
        assert create_error["success"] is False

        monkeypatch.setattr(
            incidents_router,
            "_update_incident",
            lambda *_args, **_kwargs: incidents_router.service_failure("boom", 500),
        )
        update_error = _payload(
            await incidents_router.update_incident({"id": "category-1", "name": "Novo nome"}, object(), connection)
        )
        assert update_error["success"] is False

        monkeypatch.setattr(
            incidents_router,
            "_delete_incident",
            lambda *_args, **_kwargs: incidents_router.service_failure("boom", 500),
        )
        delete_error = _payload(await incidents_router.delete_incident("category-1", object(), connection))
        assert delete_error["success"] is False

        monkeypatch.setattr(
            incidents_router,
            "_get_incident_usage",
            lambda *_args, **_kwargs: incidents_router.service_failure("boom", 500),
        )
        usage_error = _payload(await incidents_router.get_usage("category-1", object(), connection))
        assert usage_error["success"] is False

        list_images = _payload(await incidents_router.list_images(connection))
        assert list_images["data"]["items"][0]["filename"] == "incidents-1.webp"

        monkeypatch.setattr(
            incidents_router,
            "decode_base64_data_uri",
            lambda _value: b"image-bytes",
        )
        monkeypatch.setattr(
            incidents_router,
            "store_buffer_as_webp",
            lambda kind, filename, buffer: {"error": "Falha ao salvar imagem"},
        )
        image_error = _payload(
            await incidents_router.create_image(
                {"image": "data:image/webp;base64,AAA", "filename": "incident.webp"},
                connection,
            )
        )
        assert image_error["success"] is False

        monkeypatch.setattr(
            incidents_router,
            "_delete_incident_image",
            lambda filename: incidents_router.service_failure("boom", 500),
        )
        delete_image_error = _payload(
            await incidents_router.delete_image(filename="incident.webp", _current_user=object())
        )
        assert delete_image_error["success"] is False
