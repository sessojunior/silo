from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, JSON, MetaData, String, Table, create_engine, select

from silo.api.routers import contacts as contacts_router
from silo.api.routers import products as products_router


def test_products_router_database_helpers_cover_crud_and_cleanup(monkeypatch) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    tables = _make_products_tables(MetaData())
    tables["product"].metadata.create_all(engine)

    deleted_uploads: list[tuple[str, str]] = []
    monkeypatch.setattr(products_router, "legacy_tables", tables)
    monkeypatch.setattr(products_router, "delete_upload_file", lambda kind, filename: deleted_uploads.append((kind, filename)) or True)
    monkeypatch.setattr(products_router, "is_upload_kind", lambda kind: kind in {"manual", "problems", "solutions"})
    monkeypatch.setattr(products_router, "is_safe_filename", lambda filename: filename != "bad.webp")

    with engine.begin() as connection:
        connection.execute(
            tables["product"].insert(),
            [
                {
                    "id": "product-1",
                    "name": "Alpha",
                    "slug": "alpha",
                    "available": True,
                    "priority": "normal",
                    "turns": ["0", "6"],
                    "description": "Alpha product",
                    "url_product_flow": "https://example.test/alpha",
                    "created_at": datetime(2026, 7, 23, 12, 0, 0),
                    "updated_at": datetime(2026, 7, 23, 12, 0, 0),
                },
                {
                    "id": "product-2",
                    "name": "Beta",
                    "slug": "beta",
                    "available": False,
                    "priority": "urgent",
                    "turns": ["12"],
                    "description": "Beta product",
                    "url_product_flow": "https://example.test/beta",
                    "created_at": datetime(2026, 7, 23, 12, 0, 0),
                    "updated_at": datetime(2026, 7, 23, 12, 0, 0),
                },
                {
                    "id": "product-3",
                    "name": "Beef",
                    "slug": "beef",
                    "available": False,
                    "priority": "normal",
                    "turns": ["18"],
                    "description": "Beef product",
                    "url_product_flow": "https://example.test/beef",
                    "created_at": datetime(2026, 7, 23, 12, 0, 0),
                    "updated_at": datetime(2026, 7, 23, 12, 0, 0),
                },
            ],
        )
        connection.execute(
            tables["product_activity"].insert(),
            [{"id": "activity-1", "product_id": "product-1"}],
        )
        connection.execute(
            tables["product_activity_history"].insert(),
            [{"id": "history-1", "product_activity_id": "activity-1"}],
        )
        connection.execute(
            tables["product_availability_exception"].insert(),
            [{"id": "availability-1", "product_id": "product-1"}],
        )
        connection.execute(
            tables["product_contact"].insert(),
            [{"id": "product-contact-1", "product_id": "product-1"}],
        )
        connection.execute(
            tables["product_dependency"].insert(),
            [{"id": "dependency-1", "product_id": "product-1"}],
        )
        connection.execute(
            tables["product_manual"].insert(),
            [{"id": "manual-1", "product_id": "product-1"}],
        )
        connection.execute(
            tables["product_manual_chunk"].insert(),
            [{"id": "manual-chunk-1", "product_id": "product-1"}],
        )
        connection.execute(
            tables["product_problem"].insert(),
            [{"id": "problem-1", "product_id": "product-1"}],
        )
        connection.execute(
            tables["product_problem_image"].insert(),
            [
                {
                    "id": "problem-image-1",
                    "product_problem_id": "problem-1",
                    "image": "/uploads/problems/problem-1.webp",
                }
            ],
        )
        connection.execute(
            tables["product_solution"].insert(),
            [{"id": "solution-1", "product_problem_id": "problem-1"}],
        )
        connection.execute(
            tables["product_solution_checked"].insert(),
            [{"id": "solution-checked-1", "product_solution_id": "solution-1"}],
        )
        connection.execute(
            tables["product_solution_image"].insert(),
            [
                {
                    "id": "solution-image-1",
                    "product_solution_id": "solution-1",
                    "image": "/uploads/solutions/solution-1.webp",
                }
            ],
        )

    with engine.connect() as connection:
        slug_listing = products_router._list_products(  # noqa: SLF001
            connection,
            slug=" alpha ",
            name=None,
            page=1,
            limit=20,
            available=True,
        )
        name_listing = products_router._list_products(  # noqa: SLF001
            connection,
            slug=None,
            name="be",
            page=1,
            limit=1,
            available=False,
        )

        created = products_router._create_product(  # noqa: SLF001
            connection,
            {
                "name": "Gamma",
                "slug": "gamma-flow",
                "available": False,
                "priority": "urgent",
                "turns": ["0", "12", "12"],
                "description": "  Gamma product  ",
                "urlProductFlow": "https://example.test/gamma",
            },
        )
        duplicate_slug = products_router._create_product(  # noqa: SLF001
            connection,
            {"name": "Gamma 2", "slug": "gamma-flow"},
        )
        invalid_name = products_router._create_product(connection, {"name": "   "})  # noqa: SLF001
        invalid_slug = products_router._create_product(connection, {"name": "Delta", "slug": "!!!"})  # noqa: SLF001

        updated = products_router._update_product(  # noqa: SLF001
            connection,
            {
                "id": "product-1",
                "name": "Alpha Prime",
                "slug": "alpha-prime",
                "available": False,
                "priority": "low",
                "turns": ["18"],
                "description": "  Updated  ",
                "urlProductFlow": "https://example.test/alpha-prime",
            },
        )
        duplicate_update = products_router._update_product(  # noqa: SLF001
            connection,
            {"id": "product-1", "name": "Alpha Prime", "slug": "beta"},
        )
        missing_update = products_router._update_product(  # noqa: SLF001
            connection,
            {"id": "missing", "name": "Missing"},
        )
        invalid_update = products_router._update_product(  # noqa: SLF001
            connection,
            {"id": "product-1", "name": "Alpha Prime", "slug": "!!!"},
        )

        deleted = products_router._delete_product(connection, "product-1")  # noqa: SLF001
        missing_delete = products_router._delete_product(connection, "missing")  # noqa: SLF001

        remaining_product = connection.execute(select(tables["product"].c.id).where(tables["product"].c.id == "product-1")).first()
        remaining_history = connection.execute(select(tables["product_activity_history"].c.id)).first()
        remaining_manual = connection.execute(select(tables["product_manual"].c.id)).first()

    assert slug_listing["total"] == 1
    assert slug_listing["items"][0]["slug"] == "alpha"
    assert name_listing["total"] == 1
    assert name_listing["items"][0]["slug"] == "beef"
    assert created["ok"] is True
    assert created["data"]["slug"] == "gamma-flow"
    assert created["data"]["priority"] == "urgent"
    assert created["data"]["available"] is False
    assert created["data"]["turns"] == ["0", "12"]
    assert created["data"]["urlProductFlow"] == "https://example.test/gamma"
    assert duplicate_slug["ok"] is False and duplicate_slug["field"] == "name"
    assert invalid_name["ok"] is False
    assert invalid_slug["ok"] is False and invalid_slug["field"] == "slug"
    assert updated["ok"] is True
    assert updated["data"]["name"] == "Alpha Prime"
    assert updated["data"]["slug"] == "alpha-prime"
    assert updated["data"]["available"] is False
    assert updated["data"]["priority"] == "low"
    assert updated["data"]["turns"] == ["18"]
    assert updated["data"]["description"] == "Updated"
    assert updated["data"]["urlProductFlow"] == "https://example.test/alpha-prime"
    assert duplicate_update["ok"] is False and duplicate_update["field"] == "slug"
    assert missing_update["ok"] is False and missing_update["status"] == 404
    assert invalid_update["ok"] is False and invalid_update["field"] == "slug"
    assert deleted["ok"] is True
    assert missing_delete["ok"] is False and missing_delete["status"] == 404
    assert remaining_product is None
    assert remaining_history is None
    assert remaining_manual is None
    assert deleted_uploads == [
        ("problems", "problem-1.webp"),
        ("solutions", "solution-1.webp"),
    ]
    assert isinstance(products_router._new_uuid(), str)  # noqa: SLF001
    assert isinstance(products_router._now_naive(), datetime)  # noqa: SLF001


def test_contacts_router_database_helpers_cover_crud_and_cleanup(monkeypatch) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    tables = _make_contacts_tables(MetaData())
    tables["contact"].metadata.create_all(engine)

    deleted_uploads: list[tuple[str, str]] = []
    monkeypatch.setattr(contacts_router, "legacy_tables", tables)
    monkeypatch.setattr(contacts_router, "delete_upload_file", lambda kind, filename: deleted_uploads.append((kind, filename)) or True)
    monkeypatch.setattr(contacts_router, "is_upload_kind", lambda kind: kind == "avatars")
    monkeypatch.setattr(contacts_router, "is_safe_filename", lambda filename: filename != "bad.webp")

    with engine.begin() as connection:
        connection.execute(
            tables["contact"].insert(),
            [
                {
                    "id": "contact-1",
                    "name": "Ana",
                    "role": "Sales",
                    "team": "Growth",
                    "email": "ana@example.test",
                    "phone": "111",
                    "image": "/uploads/avatars/contact-1.webp",
                    "active": True,
                    "updated_at": datetime(2026, 7, 23, 12, 0, 0),
                },
                {
                    "id": "contact-2",
                    "name": "Bruno",
                    "role": "Support",
                    "team": "Ops",
                    "email": "bruno@example.test",
                    "phone": "222",
                    "image": "/uploads/avatars/contact-2.webp",
                    "active": False,
                    "updated_at": datetime(2026, 7, 23, 12, 0, 0),
                },
            ],
        )
        connection.execute(
            tables["product_contact"].insert(),
            [{"id": "product-contact-1", "contact_id": "contact-1"}],
        )

    with engine.connect() as connection:
        listed_active = contacts_router._list_contacts(connection, search="ana", status="active")  # noqa: SLF001
        listed_inactive = contacts_router._list_contacts(connection, search="ops", status="inactive")  # noqa: SLF001
        created = contacts_router._create_contact(  # noqa: SLF001
            connection,
            {
                "name": "Carla",
                "role": "Marketing",
                "team": "Ops",
                "email": "carla@example.test",
                "phone": "333",
                "imageUrl": "/uploads/avatars/contact-3.webp",
                "active": True,
            },
        )
        duplicate_email = contacts_router._create_contact(  # noqa: SLF001
            connection,
            {
                "name": "Carla 2",
                "role": "Marketing",
                "team": "Ops",
                "email": "ana@example.test",
            },
        )
        invalid_email = contacts_router._create_contact(connection, {"name": "Dan", "role": "QA", "team": "Ops", "email": 42})  # noqa: SLF001
        invalid_data = contacts_router._create_contact(connection, {"name": "Dan", "role": "QA", "team": "Ops", "email": "   "})  # noqa: SLF001

        contacts_router.select_now(connection)  # noqa: SLF001

        updated = contacts_router._update_contact(  # noqa: SLF001
            connection,
            {
                "id": "contact-1",
                "name": "Ana Prime",
                "role": "Sales",
                "team": "Growth",
                "email": "ana.prime@example.test",
                "removeImage": True,
            },
        )
        duplicate_update = contacts_router._update_contact(  # noqa: SLF001
            connection,
            {
                "id": "contact-1",
                "name": "Ana Prime",
                "role": "Sales",
                "team": "Growth",
                "email": "bruno@example.test",
            },
        )
        missing_update = contacts_router._update_contact(  # noqa: SLF001
            connection,
            {
                "id": "missing",
                "name": "Missing",
                "role": "Sales",
                "team": "Growth",
                "email": "missing@example.test",
            },
        )

        deleted = contacts_router._delete_contact(connection, "contact-1")  # noqa: SLF001
        missing_delete = contacts_router._delete_contact(connection, "missing")  # noqa: SLF001

        remaining_contact = connection.execute(select(tables["contact"].c.id).where(tables["contact"].c.id == "contact-1")).first()
        remaining_link = connection.execute(select(tables["product_contact"].c.id).where(tables["product_contact"].c.contact_id == "contact-1")).first()

    assert listed_active["items"][0]["id"] == "contact-1"
    assert listed_active["total"] == 1
    assert listed_inactive["items"][0]["id"] == "contact-2"
    assert listed_inactive["total"] == 1
    assert created["ok"] is True
    assert isinstance(created["data"]["id"], str)
    assert duplicate_email["ok"] is False and duplicate_email["field"] == "email"
    assert invalid_email["ok"] is False and invalid_email["field"] == "email"
    assert invalid_data["ok"] is False and invalid_data["status"] == 400
    assert updated["ok"] is True
    assert duplicate_update["ok"] is False and duplicate_update["field"] == "email"
    assert missing_update["ok"] is False and missing_update["status"] == 404
    assert deleted["ok"] is True
    assert missing_delete["ok"] is False and missing_delete["status"] == 404
    assert remaining_contact is None
    assert remaining_link is None
    assert deleted_uploads == [("avatars", "contact-1.webp")]
    assert isinstance(contacts_router._new_uuid(), str)  # noqa: SLF001
    assert isinstance(contacts_router.select_now(engine.connect()), datetime)  # noqa: SLF001


def _make_products_tables(metadata: MetaData) -> dict[str, Table]:
    product = Table(
        "product",
        metadata,
        Column("id", String, primary_key=True),
        Column("name", String, nullable=False),
        Column("slug", String, nullable=False),
        Column("available", Boolean, nullable=False),
        Column("priority", String, nullable=False),
        Column("turns", JSON, nullable=False),
        Column("description", String, nullable=True),
        Column("url_product_flow", String, nullable=True),
        Column("created_at", DateTime, nullable=False),
        Column("updated_at", DateTime, nullable=False),
    )
    product_activity = Table(
        "product_activity",
        metadata,
        Column("id", String, primary_key=True),
        Column("product_id", String, nullable=False),
    )
    product_activity_history = Table(
        "product_activity_history",
        metadata,
        Column("id", String, primary_key=True),
        Column("product_activity_id", String, nullable=False),
    )
    product_availability_exception = Table(
        "product_availability_exception",
        metadata,
        Column("id", String, primary_key=True),
        Column("product_id", String, nullable=False),
    )
    product_contact = Table(
        "product_contact",
        metadata,
        Column("id", String, primary_key=True),
        Column("product_id", String, nullable=False),
    )
    product_dependency = Table(
        "product_dependency",
        metadata,
        Column("id", String, primary_key=True),
        Column("product_id", String, nullable=False),
    )
    product_manual = Table(
        "product_manual",
        metadata,
        Column("id", String, primary_key=True),
        Column("product_id", String, nullable=False),
    )
    product_manual_chunk = Table(
        "product_manual_chunk",
        metadata,
        Column("id", String, primary_key=True),
        Column("product_id", String, nullable=False),
    )
    product_problem = Table(
        "product_problem",
        metadata,
        Column("id", String, primary_key=True),
        Column("product_id", String, nullable=False),
    )
    product_problem_image = Table(
        "product_problem_image",
        metadata,
        Column("id", String, primary_key=True),
        Column("product_problem_id", String, nullable=False),
        Column("image", String, nullable=True),
    )
    product_solution = Table(
        "product_solution",
        metadata,
        Column("id", String, primary_key=True),
        Column("product_problem_id", String, nullable=False),
    )
    product_solution_checked = Table(
        "product_solution_checked",
        metadata,
        Column("id", String, primary_key=True),
        Column("product_solution_id", String, nullable=False),
    )
    product_solution_image = Table(
        "product_solution_image",
        metadata,
        Column("id", String, primary_key=True),
        Column("product_solution_id", String, nullable=False),
        Column("image", String, nullable=True),
    )
    return {
        "product": product,
        "product_activity": product_activity,
        "product_activity_history": product_activity_history,
        "product_availability_exception": product_availability_exception,
        "product_contact": product_contact,
        "product_dependency": product_dependency,
        "product_manual": product_manual,
        "product_manual_chunk": product_manual_chunk,
        "product_problem": product_problem,
        "product_problem_image": product_problem_image,
        "product_solution": product_solution,
        "product_solution_checked": product_solution_checked,
        "product_solution_image": product_solution_image,
    }


def _make_contacts_tables(metadata: MetaData) -> dict[str, Table]:
    contact = Table(
        "contact",
        metadata,
        Column("id", String, primary_key=True),
        Column("name", String, nullable=False),
        Column("role", String, nullable=False),
        Column("team", String, nullable=False),
        Column("email", String, nullable=False),
        Column("phone", String, nullable=True),
        Column("image", String, nullable=True),
        Column("active", Boolean, nullable=False),
        Column("updated_at", DateTime, nullable=True),
    )
    product_contact = Table(
        "product_contact",
        metadata,
        Column("id", String, primary_key=True),
        Column("contact_id", String, nullable=False),
    )
    return {"contact": contact, "product_contact": product_contact}
