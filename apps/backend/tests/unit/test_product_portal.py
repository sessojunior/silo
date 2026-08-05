from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, date, datetime
from itertools import count

import pytest
from sqlalchemy import Boolean, Column, Date, DateTime, Integer, JSON, MetaData, String, Table, UniqueConstraint, create_engine, insert, select

from silo.db.models import TABLE_COLUMN_SPECS
from silo.services import product_portal


FIXED_NOW = datetime(2026, 8, 3, 12, 0, 0)


@dataclass(frozen=True, slots=True)
class _ProductPortalIds:
    product_1: str = "product-1"
    product_2: str = "product-2"
    product_3: str = "product-3"
    user_active_1: str = "user-active-1"
    user_active_2: str = "user-active-2"
    user_inactive: str = "user-inactive"
    contact_1: str = "contact-1"
    contact_2: str = "contact-2"
    availability_1: str = "availability-1"
    activity_1: str = "activity-1"
    activity_2: str = "activity-2"
    dependency_root_1: str = "dependency-root-1"
    dependency_root_2: str = "dependency-root-2"
    dependency_child_1: str = "dependency-child-1"
    dependency_other_product: str = "dependency-other-product"
    manual_1: str = "manual-1"
    category_1: str = "category-1"
    category_2: str = "category-2"
    category_3: str = "category-3"
    problem_1: str = "problem-1"
    problem_2: str = "problem-2"
    problem_3: str = "problem-3"
    problem_image_1: str = "problem-image-1"
    solution_1: str = "solution-1"
    solution_2: str = "solution-2"
    solution_3: str = "solution-3"
    solution_4: str = "solution-4"
    solution_image_1: str = "solution-image-1"
    solution_image_2: str = "solution-image-2"


def _sqlalchemy_type(type_name: str):
    return {
        "text": String,
        "boolean": Boolean,
        "integer": Integer,
        "date": Date,
        "timestamp": DateTime,
        "jsonb": JSON,
        "uuid": String,
        "vector768": JSON,
    }.get(type_name, String)


def _build_tables() -> dict[str, Table]:
    wanted_tables = {
        "product",
        "user",
        "contact",
        "product_contact",
        "product_availability_exception",
        "product_activity",
        "product_activity_history",
        "product_dependency",
        "product_manual",
        "product_manual_chunk",
        "product_problem_category",
        "product_problem",
        "product_problem_image",
        "product_solution",
        "product_solution_checked",
        "product_solution_image",
    }
    metadata = MetaData()
    tables: dict[str, Table] = {}

    for table_name, column_specs in TABLE_COLUMN_SPECS:
        if table_name not in wanted_tables:
            continue

        columns = [
            Column(
                column_name,
                _sqlalchemy_type(type_name),
                primary_key=is_pk,
                nullable=not required if not is_pk else False,
            )
            for column_name, type_name, is_pk, required in column_specs
        ]
        constraints = []
        if table_name == "product_availability_exception":
            constraints.append(
                UniqueConstraint(
                    "product_id",
                    "date",
                    "type",
                    name="uq_product_availability_exception_product_date_type_test",
                )
            )
        if table_name == "product_activity":
            constraints.append(
                UniqueConstraint(
                    "product_id",
                    "date",
                    "turn",
                    name="uq_product_activity_product_date_turn_test",
                )
            )

        tables[table_name] = Table(table_name, metadata, *columns, *constraints)

    return tables


def _seed_product_portal_data(connection, tables: dict[str, Table]) -> _ProductPortalIds:  # type: ignore[no-untyped-def]
    ids = _ProductPortalIds()

    connection.execute(
        insert(tables["product"]),
        [
            {
                "id": ids.product_1,
                "name": "Produto Alpha",
                "slug": "produto-alpha",
                "available": True,
                "priority": "high",
                "turns": ["0", "6", "12", "18"],
                "description": "Produto principal",
                "url_product_flow": None,
                "data_product_flow": [],
            },
            {
                "id": ids.product_2,
                "name": "Produto Beta",
                "slug": "produto-beta",
                "available": True,
                "priority": "normal",
                "turns": ["0", "6"],
                "description": "Produto com turnos limitados",
                "url_product_flow": None,
                "data_product_flow": [],
            },
            {
                "id": ids.product_3,
                "name": "Produto Gamma",
                "slug": "produto-gamma",
                "available": False,
                "priority": "low",
                "turns": ["0", "6", "12", "18"],
                "description": "Produto indisponivel",
                "url_product_flow": None,
                "data_product_flow": [],
            },
        ],
    )
    connection.execute(
        insert(tables["user"]),
        [
            {
                "id": ids.user_active_1,
                "name": "User Alpha",
                "email": "alpha@example.test",
                "email_verified": True,
                "image": "/uploads/avatars/user-alpha.webp",
                "created_at": FIXED_NOW - datetime.resolution,
                "updated_at": FIXED_NOW - datetime.resolution,
                "is_active": True,
                "last_login": FIXED_NOW,
            },
            {
                "id": ids.user_active_2,
                "name": "User Beta",
                "email": "beta@example.test",
                "email_verified": True,
                "image": "/uploads/avatars/user-beta.webp",
                "created_at": FIXED_NOW - datetime.resolution,
                "updated_at": FIXED_NOW - datetime.resolution,
                "is_active": True,
                "last_login": FIXED_NOW,
            },
            {
                "id": ids.user_inactive,
                "name": "User Disabled",
                "email": "disabled@example.test",
                "email_verified": False,
                "image": None,
                "created_at": FIXED_NOW - datetime.resolution,
                "updated_at": FIXED_NOW - datetime.resolution,
                "is_active": False,
                "last_login": None,
            },
        ],
    )
    connection.execute(
        insert(tables["contact"]),
        [
            {
                "id": ids.contact_1,
                "name": "Alice Contact",
                "role": "Owner",
                "team": "Ops",
                "email": "alice@example.test",
                "phone": "1111-1111",
                "image": None,
                "active": True,
                "created_at": FIXED_NOW,
                "updated_at": FIXED_NOW,
            },
            {
                "id": ids.contact_2,
                "name": "Bob Contact",
                "role": "Backup",
                "team": "Support",
                "email": "bob@example.test",
                "phone": "2222-2222",
                "image": None,
                "active": False,
                "created_at": FIXED_NOW,
                "updated_at": FIXED_NOW,
            },
        ],
    )
    connection.execute(
        insert(tables["product_contact"]),
        [
            {
                "id": "product-contact-1",
                "product_id": ids.product_1,
                "contact_id": ids.contact_1,
                "created_at": FIXED_NOW,
            },
            {
                "id": "product-contact-2",
                "product_id": ids.product_1,
                "contact_id": ids.contact_2,
                "created_at": FIXED_NOW,
            },
        ],
    )
    connection.execute(
        insert(tables["product_availability_exception"]),
        [
            {
                "id": ids.availability_1,
                "product_id": ids.product_1,
                "date": date(2026, 8, 4),
                "type": "pause",
                "description": "Manutencao agendada",
                "created_at": FIXED_NOW,
                "updated_at": FIXED_NOW,
            }
        ],
    )
    connection.execute(
        insert(tables["product_activity"]),
        [
            {
                "id": ids.activity_1,
                "product_id": ids.product_1,
                "user_id": ids.user_active_1,
                "date": date(2026, 8, 2),
                "turn": 12,
                "status": "completed",
                "problem_category_id": None,
                "description": "Atividade inicial",
                "intervention": None,
                "created_at": FIXED_NOW - datetime.resolution,
                "updated_at": FIXED_NOW - datetime.resolution,
            }
        ],
    )
    connection.execute(
        insert(tables["product_problem_category"]),
        [
            {
                "id": ids.category_1,
                "name": "Category One",
                "color": "#ff0000",
                "is_system": False,
                "sort_order": 0,
                "created_at": FIXED_NOW,
                "updated_at": FIXED_NOW,
            },
            {
                "id": ids.category_2,
                "name": "Category Two",
                "color": "#00ff00",
                "is_system": False,
                "sort_order": 1,
                "created_at": FIXED_NOW,
                "updated_at": FIXED_NOW,
            },
        ],
    )
    connection.execute(
        insert(tables["product_dependency"]),
        [
            {
                "id": ids.dependency_other_product,
                "product_id": ids.product_2,
                "name": "Outro produto",
                "icon": None,
                "description": "Fora do produto alvo",
                "parent_id": None,
                "tree_path": "/0",
                "tree_depth": 0,
                "sort_key": "000",
                "created_at": FIXED_NOW,
                "updated_at": FIXED_NOW,
            }
        ],
    )

    return ids


@pytest.fixture()
def product_portal_connection(tmp_path, monkeypatch):
    engine = create_engine(
        f"sqlite+pysqlite:///{tmp_path / 'product-portal.sqlite3'}",
        future=True,
        connect_args={"check_same_thread": False},
    )
    tables = _build_tables()
    tables["product"].metadata.create_all(engine)

    ids = _ProductPortalIds()
    id_counter = count(1)
    sent_emails: list[tuple[str, str, str]] = []

    monkeypatch.setattr(product_portal, "legacy_tables", tables)
    monkeypatch.setattr(product_portal, "now_naive", lambda: FIXED_NOW)
    monkeypatch.setattr(product_portal, "new_uuid", lambda: f"uuid-{next(id_counter)}")
    monkeypatch.setattr(
        product_portal,
        "send_plain_email",
        lambda *, to, subject, text: sent_emails.append((to, subject, text)),
    )
    monkeypatch.setattr(product_portal, "upsert_problem_embedding", lambda *args, **kwargs: None)
    monkeypatch.setattr(product_portal, "upsert_solution_embedding", lambda *args, **kwargs: None)
    monkeypatch.setattr(product_portal, "upsert_manual_chunks", lambda *args, **kwargs: None)
    monkeypatch.setattr(
        product_portal,
        "get_product_data_flow_pipelines_from_kafka_rest_sync",
        lambda **kwargs: [
            {
                "model": kwargs["slug"],
                "date": kwargs.get("date") or "2026-08-03",
                "turn": kwargs.get("turn") or "12",
                "groups": [{"tasks": [{"progress": 100}]}],
            }
        ],
    )

    with engine.begin() as connection:
        _seed_product_portal_data(connection, tables)

    connection = engine.connect()
    try:
        yield connection, ids, tables, sent_emails
    finally:
        connection.close()


def _call(connection, func: Callable[..., object], /, *args, **kwargs):
    with product_portal.bind_connection(connection):
        return func(*args, **kwargs)


def _success_data(result: dict[str, object]) -> dict[str, object]:
    assert result["ok"] is True
    return result["data"]  # type: ignore[return-value]


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (date(2026, 8, 3), datetime(2026, 8, 3, 0, 0)),
        ("2026-08-03", datetime(2026, 8, 3, 0, 0)),
        (datetime(2026, 8, 3, 14, 45), datetime(2026, 8, 3, 14, 45)),
    ],
)
def test_product_portal_date_helper(value, expected) -> None:
    assert product_portal._date_to_datetime(value) == expected  # noqa: SLF001


def test_product_portal_activity_availability_and_history_paths(product_portal_connection) -> None:
    connection, ids, tables, sent_emails = product_portal_connection

    available = _success_data(
        _call(
            connection,
            product_portal.get_product_activity_availability,
            product_id=ids.product_1,
            date_value="2026-08-03",
            turn=6,
        )
    )
    assert available["reason"] == "available"
    assert available["fits"] is True

    conflict = _success_data(
        _call(
            connection,
            product_portal.get_product_activity_availability,
            product_id=ids.product_1,
            date_value="2026-08-02",
            turn=12,
        )
    )
    assert conflict["reason"] == "conflict"
    assert conflict["fits"] is False
    assert conflict["conflictCount"] >= 1

    skipped_activity = _success_data(
        _call(
            connection,
            product_portal.get_product_activity_availability,
            product_id=ids.product_1,
            date_value="2026-08-02",
            turn=12,
            activity_id=ids.activity_1,
        )
    )
    assert skipped_activity["fits"] is True
    assert skipped_activity["reason"] == "available"

    turn_not_allowed = _success_data(
        _call(
            connection,
            product_portal.get_product_activity_availability,
            product_id=ids.product_2,
            date_value="2026-08-03",
            turn=12,
        )
    )
    assert turn_not_allowed["reason"] == "turn_not_allowed"
    assert turn_not_allowed["fits"] is False

    unavailable = _success_data(
        _call(
            connection,
            product_portal.get_product_activity_availability,
            product_id=ids.product_3,
            date_value="2026-08-03",
            turn=6,
        )
    )
    assert unavailable["reason"] == "product_unavailable"
    assert unavailable["fits"] is False

    missing_product = _call(
        connection,
        product_portal.get_product_activity_availability,
        product_id="missing-product",
        date_value="2026-08-03",
        turn=6,
    )
    assert missing_product["ok"] is False

    history_invalid_date = _call(
        connection,
        product_portal.list_product_activity_history,
        product_id=ids.product_1,
        date_value="bad-date",
        turn_value=12,
    )
    assert history_invalid_date["ok"] is False

    history_missing_turn = _call(
        connection,
        product_portal.list_product_activity_history,
        product_id=ids.product_1,
        date_value="2026-08-02",
        turn_value="bad",
    )
    assert history_missing_turn["ok"] is False

    history_empty = _success_data(
        _call(
            connection,
            product_portal.list_product_activity_history,
            product_id=ids.product_2,
            date_value="2026-08-02",
            turn_value=12,
        )
    )
    assert history_empty["history"] == []

    created_activity = _success_data(
        _call(
            connection,
            product_portal.upsert_product_activity,
            user_id=ids.user_active_1,
            product_id=ids.product_1,
            date_value="2026-08-03",
            turn=6,
            status="completed",
            description="Criada agora",
            intervention=None,
            problem_category_id=None,
        )
    )
    assert created_activity["action"] == "created"
    assert created_activity["activity"]["status"] == "completed"

    updated_activity = _success_data(
        _call(
            connection,
            product_portal.upsert_product_activity,
            user_id=ids.user_active_2,
            product_id=ids.product_1,
            date_value="2026-08-02",
            turn=12,
            status="with_problems",
            description="Atualizada",
            intervention="Ajuste",
            problem_category_id=ids.category_1,
        )
    )
    assert updated_activity["action"] == "updated"
    assert updated_activity["activity"]["problem_category_id"] == ids.category_1

    explicit_update = _success_data(
        _call(
            connection,
            product_portal.update_product_activity,
            user_id=ids.user_active_1,
            id=ids.activity_1,
            status="done",
            description="Revisada",
            intervention=None,
            problem_category_id=ids.category_2,
        )
    )
    assert explicit_update["activity"]["status"] == "done"

    missing_update = _call(
        connection,
        product_portal.update_product_activity,
        user_id=ids.user_active_1,
        id="missing-activity",
        status="done",
    )
    assert missing_update["ok"] is False

    pending_recipients = _success_data(_call(connection, product_portal.list_product_activity_pending_email_recipients))
    assert [item["id"] for item in pending_recipients["items"]] == [ids.user_active_1, ids.user_active_2]

    sent_email_result = _success_data(
        _call(
            connection,
            product_portal.send_product_activity_pending_email,
            product_id=ids.product_1,
            date_value="2026-08-03",
            turn=6,
            status="completed",
            incident_name="Incidente X",
            recipient_user_ids=[ids.user_active_2, ids.user_active_1, ids.user_active_1],
            message="Mensagem de pendencia",
        )
    )
    assert sent_email_result["sent"] == 2
    assert len(sent_emails) == 2
    assert "Produto Alpha" in sent_emails[0][1]
    assert "Incidente X" in sent_emails[0][1]

    recipient_mismatch = _call(
        connection,
        product_portal.send_product_activity_pending_email,
        product_id=ids.product_1,
        date_value="2026-08-03",
        turn=6,
        status="completed",
        incident_name=None,
        recipient_user_ids=[ids.user_active_1, ids.user_inactive],
        message="Mensagem de pendencia",
    )
    assert recipient_mismatch["ok"] is False

    missing_product_email = _call(
        connection,
        product_portal.send_product_activity_pending_email,
        product_id="missing-product",
        date_value="2026-08-03",
        turn=6,
        status="completed",
        incident_name=None,
        recipient_user_ids=[ids.user_active_1],
        message="Mensagem de pendencia",
    )
    assert missing_product_email["ok"] is False

    availability_list = _success_data(
        _call(
            connection,
            product_portal.list_product_availability_exceptions,
            product_id=ids.product_1,
            from_date="2026-08-04",
            to_date="2026-08-04",
        )
    )
    assert [item["id"] for item in availability_list["items"]] == [ids.availability_1]

    missing_availability_list = _call(
        connection,
        product_portal.list_product_availability_exceptions,
        product_id="missing-product",
    )
    assert missing_availability_list["ok"] is False

    created_exception = _success_data(
        _call(
            connection,
            product_portal.upsert_product_availability_exception,
            product_id=ids.product_1,
            date_value="2026-08-05",
            type_value="holiday",
            description="Feriado",
        )
    )
    assert created_exception["action"] == "created"
    assert created_exception["exception"]["type"] == "holiday"

    updated_exception = _success_data(
        _call(
            connection,
            product_portal.upsert_product_availability_exception,
            product_id=ids.product_1,
            date_value="2026-08-05",
            type_value="holiday",
            description="Feriado atualizado",
        )
    )
    assert updated_exception["action"] == "updated"

    invalid_exception_type = _call(
        connection,
        product_portal.upsert_product_availability_exception,
        product_id=ids.product_1,
        date_value="2026-08-05",
        type_value="invalid",
        description="Feriado",
    )
    assert invalid_exception_type["ok"] is False

    missing_exception_product = _call(
        connection,
        product_portal.upsert_product_availability_exception,
        product_id="missing-product",
        date_value="2026-08-05",
        type_value="holiday",
        description="Feriado",
    )
    assert missing_exception_product["ok"] is False

    delete_exception = _success_data(
        _call(
            connection,
            product_portal.delete_product_availability_exception,
            created_exception["exception"]["id"],
        )
    )
    assert delete_exception is None

    missing_delete_exception = _call(connection, product_portal.delete_product_availability_exception, "missing")
    assert missing_delete_exception["ok"] is False


def test_product_portal_contacts_dependencies_and_manual_paths(product_portal_connection) -> None:
    connection, ids, tables, _sent_emails = product_portal_connection

    contacts = _success_data(_call(connection, product_portal.list_product_contacts, ids.product_1))
    assert [item["id"] for item in contacts["contacts"]] == [ids.contact_1]

    _success_data(
        _call(
            connection,
            product_portal.replace_product_contacts,
            product_id=ids.product_1,
            contact_ids=[ids.contact_1, ids.contact_1, ids.contact_2],
        )
    )
    product_contact_rows = connection.execute(
        select(tables["product_contact"].c.contact_id).where(
            tables["product_contact"].c.product_id == ids.product_1
        )
    ).all()
    assert [row[0] for row in product_contact_rows] == [ids.contact_1, ids.contact_2]

    missing_association = _call(connection, product_portal.delete_product_contact_association, "missing")
    assert missing_association["ok"] is False

    association_row = connection.execute(
        select(tables["product_contact"].c.id).where(tables["product_contact"].c.contact_id == ids.contact_2)
    ).mappings().first()
    assert association_row is not None
    _success_data(_call(connection, product_portal.delete_product_contact_association, association_row["id"]))
    remaining_contact_rows = connection.execute(
        select(tables["product_contact"].c.contact_id).where(
            tables["product_contact"].c.product_id == ids.product_1
        )
    ).all()
    assert [row[0] for row in remaining_contact_rows] == [ids.contact_1]

    assert product_portal._calculate_tree_path(None, 0) == "/0"  # noqa: SLF001
    assert product_portal._calculate_tree_path("/0", 1) == "/0/1"  # noqa: SLF001
    assert product_portal._calculate_sort_key(None, 2) == "002"  # noqa: SLF001
    assert product_portal._calculate_sort_key("001", 2) == "001.002"  # noqa: SLF001
    assert product_portal._calculate_tree_depth(None) == 0  # noqa: SLF001
    assert product_portal._calculate_tree_depth(2) == 3  # noqa: SLF001
    dependency_tree = product_portal._build_dependency_tree(  # noqa: SLF001
        [
            {"id": "root", "parentId": None},
            {"id": "child", "parentId": "root"},
        ]
    )
    assert dependency_tree[0]["children"][0]["id"] == "child"

    root_1 = _success_data(
        _call(
            connection,
            product_portal.create_product_dependency,
            product_id=ids.product_1,
            name="Root 1",
            icon="icon-root",
            description="Dependencia raiz 1",
        )
    )["dependency"]
    root_2 = _success_data(
        _call(
            connection,
            product_portal.create_product_dependency,
            product_id=ids.product_1,
            name="Root 2",
            icon="icon-root",
            description="Dependencia raiz 2",
        )
    )["dependency"]
    child_1 = _success_data(
        _call(
            connection,
            product_portal.create_product_dependency,
            product_id=ids.product_1,
            name="Child 1",
            parent_id=root_1["id"],
        )
    )["dependency"]

    assert root_1["treePath"] == "/0"
    assert root_2["treePath"] == "/1"
    assert child_1["treePath"] == "/0/0"

    dependency_tree = _success_data(_call(connection, product_portal.list_product_dependencies, ids.product_1))
    assert len(dependency_tree) == 2
    assert len(dependency_tree[0]["children"]) == 1

    missing_dependency_update = _call(
        connection,
        product_portal.update_product_dependency,
        id="missing",
        name="Dependencia inexistente",
    )
    assert missing_dependency_update["ok"] is False

    updated_root_2 = _success_data(
        _call(
            connection,
            product_portal.update_product_dependency,
            id=root_2["id"],
            name="Root 2 atualizada",
            icon="icon-updated",
            description="Dependencia atualizada",
        )
    )["dependency"]
    assert updated_root_2["name"] == "Root 2 atualizada"

    updated_child = _success_data(
        _call(
            connection,
            product_portal.update_product_dependency,
            id=child_1["id"],
            name="Child 1 atualizada",
            parent_id=root_1["id"],
            new_position=1,
        )
    )["dependency"]
    assert updated_child["parentId"] == root_1["id"]
    assert updated_child["treePath"] == "/0/1"
    assert updated_child["treeDepth"] == 1

    delete_with_child = _call(connection, product_portal.delete_product_dependency, root_1["id"])
    assert delete_with_child["ok"] is False

    _success_data(_call(connection, product_portal.delete_product_dependency, child_1["id"]))
    _success_data(_call(connection, product_portal.delete_product_dependency, root_1["id"]))

    reorder_failure = _call(
        connection,
        product_portal.reorder_product_dependencies,
        product_id=ids.product_1,
        items=[{"id": ids.dependency_other_product}],
    )
    assert reorder_failure["ok"] is False

    _success_data(
        _call(
            connection,
            product_portal.reorder_product_dependencies,
            product_id=ids.product_1,
            items=[
                {
                    "id": root_2["id"],
                    "parentId": None,
                    "treePath": "/0",
                    "treeDepth": 0,
                    "sortKey": "000",
                }
            ],
        )
    )
    reordered_root = connection.execute(
        select(tables["product_dependency"].c.tree_path, tables["product_dependency"].c.sort_key).where(
            tables["product_dependency"].c.id == root_2["id"]
        )
    ).mappings().first()
    assert reordered_root == {"tree_path": "/0", "sort_key": "000"}

    missing_manual = _call(connection, product_portal.get_product_manual)
    assert missing_manual["ok"] is False

    manual_by_slug = _success_data(
        _call(connection, product_portal.get_product_manual, product_slug="produto-alpha")
    )
    assert manual_by_slug["manual"] is None

    created_manual = _success_data(
        _call(
            connection,
            product_portal.upsert_product_manual,
            product_id=ids.product_1,
            description="Manual inicial",
        )
    )["manual"]
    assert created_manual["description"] == "Manual inicial"

    updated_manual = _success_data(
        _call(
            connection,
            product_portal.upsert_product_manual,
            product_id=ids.product_1,
            description="Manual atualizado",
        )
    )["manual"]
    assert updated_manual["description"] == "Manual atualizado"

    manual_by_id = _success_data(_call(connection, product_portal.get_product_manual, product_id=ids.product_1))
    assert manual_by_id["manual"]["description"] == "Manual atualizado"

    missing_manual_product = _call(
        connection,
        product_portal.upsert_product_manual,
        product_id="missing-product",
        description="Manual",
    )
    assert missing_manual_product["ok"] is False

    data_flow = _success_data(
        _call(
            connection,
            product_portal.list_product_data_flow_pipelines,
            product_slug="produto-alpha",
            date_value="2026-08-03",
            turn="12",
        )
    )
    assert data_flow["pipelines"][0]["groups"][0]["tasks"][0]["progress"] == 100

    invalid_data_flow = _call(
        connection,
        product_portal.list_product_data_flow_pipelines,
        product_slug=" ",
        date_value="2026-08-03",
        turn="12",
    )
    assert invalid_data_flow["ok"] is False


def test_product_portal_problems_categories_and_images_paths(product_portal_connection) -> None:
    connection, ids, tables, _sent_emails = product_portal_connection

    missing_product = _call(connection, product_portal.list_product_problems, slug="missing-product")
    assert missing_product["ok"] is False

    invalid_problem = _call(
        connection,
        product_portal.create_product_problem,
        product_id=ids.product_1,
        user_id=ids.user_active_1,
        title="Problema invalido",
        description="Descricao invalida",
        problem_category_id="missing-category",
    )
    assert invalid_problem["ok"] is False

    _success_data(
        _call(
            connection,
            product_portal.create_product_problem,
            product_id=ids.product_1,
            user_id=ids.user_active_1,
            title="Problema Alpha",
            description="Descricao Alpha",
            problem_category_id=ids.category_1,
        )
    )
    _success_data(
        _call(
            connection,
            product_portal.create_product_problem,
            product_id=ids.product_1,
            user_id=ids.user_active_2,
            title="Problema Beta",
            description="Descricao Beta",
            problem_category_id=ids.category_2,
        )
    )

    problem_rows = connection.execute(
        select(tables["product_problem"].c.id, tables["product_problem"].c.title).where(
            tables["product_problem"].c.product_id == ids.product_1
        )
    ).mappings().all()
    assert {row["title"] for row in problem_rows} == {"Problema Alpha", "Problema Beta"}
    problem_alpha_id = next(row["id"] for row in problem_rows if row["title"] == "Problema Alpha")
    problem_beta_id = next(row["id"] for row in problem_rows if row["title"] == "Problema Beta")

    problems = _success_data(
        _call(connection, product_portal.list_product_problems, slug="produto-alpha", page=1, limit=10)
    )
    assert {item["title"] for item in problems["items"]} == {"Problema Alpha", "Problema Beta"}

    missing_problem_update = _call(
        connection,
        product_portal.update_product_problem,
        id="missing",
        title="Problema inexistente",
        description="Descricao",
        problem_category_id=ids.category_1,
    )
    assert missing_problem_update["ok"] is False

    updated_problem = _success_data(
        _call(
            connection,
            product_portal.update_product_problem,
            id=problem_alpha_id,
            title="Problema Alpha Atualizado",
            description="Descricao Alpha Atualizada",
            problem_category_id=ids.category_2,
        )
    )
    assert updated_problem is None
    updated_problem_row = connection.execute(
        select(
            tables["product_problem"].c.title,
            tables["product_problem"].c.description,
            tables["product_problem"].c.problem_category_id,
        ).where(tables["product_problem"].c.id == problem_alpha_id)
    ).mappings().first()
    assert updated_problem_row == {
        "title": "Problema Alpha Atualizado",
        "description": "Descricao Alpha Atualizada",
        "problem_category_id": ids.category_2,
    }

    problem_image = _success_data(
        _call(
            connection,
            product_portal.create_product_problem_image,
            product_problem_id=problem_alpha_id,
            image="/uploads/problems/problem-alpha.webp",
            description="Imagem alpha",
        )
    )["image"]
    images = _success_data(_call(connection, product_portal.list_product_problem_images, problem_alpha_id))
    assert [item["id"] for item in images["items"]] == [problem_image["id"]]

    missing_problem_image = _call(connection, product_portal.delete_product_problem_image, "missing")
    assert missing_problem_image["ok"] is False

    _success_data(_call(connection, product_portal.delete_product_problem_image, problem_image["id"]))
    assert (
        connection.execute(
            select(tables["product_problem_image"].c.id).where(
                tables["product_problem_image"].c.product_problem_id == problem_alpha_id
            )
        ).first()
        is None
    )

    category_search = _success_data(
        _call(connection, product_portal.list_product_problem_categories, search="Category")
    )
    assert len(category_search["items"]) == 2

    duplicate_category = _call(
        connection,
        product_portal.create_product_problem_category,
        name="Category One",
        color="#123456",
    )
    assert duplicate_category["ok"] is False

    created_category = _success_data(
        _call(
            connection,
            product_portal.create_product_problem_category,
            name="Category Three",
            color="#abcdef",
        )
    )["category"]
    assert created_category["name"] == "Category Three"

    duplicate_category_update = _call(
        connection,
        product_portal.update_product_problem_category,
        id=created_category["id"],
        name="Category One",
        color="#123123",
    )
    assert duplicate_category_update["ok"] is False

    updated_category = _success_data(
        _call(
            connection,
            product_portal.update_product_problem_category,
            id=created_category["id"],
            name="Category Three Updated",
            color="#111111",
        )
    )
    assert updated_category is None

    missing_category_delete = _call(connection, product_portal.delete_product_problem_category, "missing")
    assert missing_category_delete["ok"] is False
    _success_data(_call(connection, product_portal.delete_product_problem_category, created_category["id"]))


def test_product_portal_solutions_and_summary_paths(product_portal_connection) -> None:
    connection, ids, tables, _sent_emails = product_portal_connection

    _success_data(
        _call(
            connection,
            product_portal.create_product_problem,
            product_id=ids.product_1,
            user_id=ids.user_active_1,
            title="Problema Alpha",
            description="Descricao Alpha",
            problem_category_id=ids.category_1,
        )
    )
    _success_data(
        _call(
            connection,
            product_portal.create_product_problem,
            product_id=ids.product_1,
            user_id=ids.user_active_2,
            title="Problema Beta",
            description="Descricao Beta",
            problem_category_id=ids.category_2,
        )
    )
    _success_data(
        _call(
            connection,
            product_portal.create_product_problem,
            product_id=ids.product_1,
            user_id=ids.user_active_1,
            title="Problema Gamma",
            description="Descricao Gamma",
            problem_category_id=ids.category_1,
        )
    )

    problem_rows = connection.execute(
        select(tables["product_problem"].c.id, tables["product_problem"].c.title).where(
            tables["product_problem"].c.product_id == ids.product_1
        )
    ).mappings().all()
    problem_alpha_id = next(row["id"] for row in problem_rows if row["title"] == "Problema Alpha")
    problem_beta_id = next(row["id"] for row in problem_rows if row["title"] == "Problema Beta")
    problem_gamma_id = next(row["id"] for row in problem_rows if row["title"] == "Problema Gamma")

    no_solutions = _success_data(_call(connection, product_portal.list_product_solutions, problem_gamma_id))
    assert no_solutions["items"] == []

    _success_data(
        _call(
            connection,
            product_portal.create_product_solution,
            user_id=ids.user_active_1,
            problem_id=problem_alpha_id,
            description="Resposta Alpha",
            image_url="/uploads/solutions/alpha-root.webp",
        )
    )
    _success_data(
        _call(
            connection,
            product_portal.create_product_solution,
            user_id=ids.user_active_1,
            problem_id=problem_beta_id,
            description="Resposta Beta Root",
        )
    )
    _success_data(
        _call(
            connection,
            product_portal.create_product_solution,
            user_id=ids.user_active_2,
            problem_id=problem_beta_id,
            description="Resposta Beta Child",
            reply_id=next(
                row["id"]
                for row in connection.execute(
                    select(tables["product_solution"].c.id).where(
                        tables["product_solution"].c.product_problem_id == problem_beta_id,
                        tables["product_solution"].c.reply_id.is_(None),
                    )
                ).mappings().all()
                if True
            ),
        )
    )
    _success_data(
        _call(
            connection,
            product_portal.create_product_solution,
            user_id=ids.user_active_1,
            problem_id=problem_beta_id,
            description="Resposta Beta Grandchild",
            reply_id=next(
                row["id"]
                for row in connection.execute(
                    select(tables["product_solution"].c.id).where(
                        tables["product_solution"].c.product_problem_id == problem_beta_id,
                        tables["product_solution"].c.reply_id.is_not(None),
                    )
                ).mappings().all()
                if True
            ),
        )
    )

    _success_data(
        _call(
            connection,
            product_portal.create_product_solution,
            user_id=ids.user_active_2,
            problem_id=problem_gamma_id,
            description="Resposta Gamma Root",
        )
    )
    _success_data(
        _call(
            connection,
            product_portal.create_product_solution,
            user_id=ids.user_active_1,
            problem_id=problem_gamma_id,
            description="Resposta Gamma Child",
            reply_id=next(
                row["id"]
                for row in connection.execute(
                    select(tables["product_solution"].c.id).where(
                        tables["product_solution"].c.product_problem_id == problem_gamma_id,
                        tables["product_solution"].c.reply_id.is_(None),
                    )
                ).mappings().all()
                if True
            ),
        )
    )

    solution_rows = connection.execute(
        select(
            tables["product_solution"].c.id,
            tables["product_solution"].c.product_problem_id,
            tables["product_solution"].c.description,
            tables["product_solution"].c.reply_id,
        )
    ).mappings().all()
    alpha_solution_id = next(row["id"] for row in solution_rows if row["description"] == "Resposta Alpha")
    beta_root_id = next(row["id"] for row in solution_rows if row["description"] == "Resposta Beta Root")
    beta_child_id = next(row["id"] for row in solution_rows if row["description"] == "Resposta Beta Child")
    beta_grandchild_id = next(row["id"] for row in solution_rows if row["description"] == "Resposta Beta Grandchild")
    gamma_root_id = next(row["id"] for row in solution_rows if row["description"] == "Resposta Gamma Root")
    gamma_child_id = next(row["id"] for row in solution_rows if row["description"] == "Resposta Gamma Child")

    connection.execute(
        insert(tables["product_solution_checked"]),
        [
            {
                "id": "solution-checked-1",
                "user_id": ids.user_active_2,
                "product_solution_id": alpha_solution_id,
            },
            {
                "id": "solution-checked-2",
                "user_id": ids.user_active_1,
                "product_solution_id": beta_root_id,
            },
        ],
    )

    alpha_images_before = _success_data(
        _call(connection, product_portal.list_product_solution_images, alpha_solution_id)
    )
    assert len(alpha_images_before["items"]) == 1
    extra_image = _success_data(
        _call(
            connection,
            product_portal.create_product_solution_image,
            product_solution_id=alpha_solution_id,
            image="/uploads/solutions/alpha-extra.webp",
            description="Imagem extra",
        )
    )["image"]
    alpha_images_after_create = _success_data(
        _call(connection, product_portal.list_product_solution_images, alpha_solution_id)
    )
    assert len(alpha_images_after_create["items"]) == 2

    missing_solution_image = _call(connection, product_portal.delete_product_solution_image, "missing")
    assert missing_solution_image["ok"] is False
    _success_data(_call(connection, product_portal.delete_product_solution_image, extra_image["id"]))

    alpha_update_denied = _call(
        connection,
        product_portal.update_product_solution,
        user_id=ids.user_inactive,
        id=alpha_solution_id,
        description="Nao pode",
    )
    assert alpha_update_denied["ok"] is False

    missing_solution_update = _call(
        connection,
        product_portal.update_product_solution,
        user_id=ids.user_active_1,
        id="missing",
        description="Nao existe",
    )
    assert missing_solution_update["ok"] is False

    _success_data(
        _call(
            connection,
            product_portal.update_product_solution,
            user_id=ids.user_active_1,
            id=alpha_solution_id,
            description="Resposta Alpha atualizada",
            image_url="/uploads/solutions/alpha-updated.webp",
        )
    )
    alpha_images_after_update = _success_data(
        _call(connection, product_portal.list_product_solution_images, alpha_solution_id)
    )
    assert len(alpha_images_after_update["items"]) == 1

    _success_data(
        _call(
            connection,
            product_portal.update_product_solution,
            user_id=ids.user_active_1,
            id=alpha_solution_id,
            description="Resposta Alpha sem imagem",
            remove_image=True,
        )
    )
    alpha_images_after_remove = _success_data(
        _call(connection, product_portal.list_product_solution_images, alpha_solution_id)
    )
    assert alpha_images_after_remove["items"] == []

    beta_solution_map = _success_data(_call(connection, product_portal.list_product_solutions, problem_beta_id))
    beta_solutions = {item["id"]: item for item in beta_solution_map["items"]}
    assert beta_solutions[beta_root_id]["verified"] is True
    assert beta_solutions[beta_child_id]["replyId"] == beta_root_id
    assert beta_solutions[beta_grandchild_id]["replyId"] == beta_child_id

    assert _call(connection, product_portal._collect_solution_descendants, beta_root_id) == [
        beta_child_id,
        beta_grandchild_id,
    ]

    solution_counts = _success_data(
        _call(
            connection,
            product_portal.count_product_solutions,
            [problem_alpha_id, problem_beta_id, problem_gamma_id],
        )
    )
    assert solution_counts[problem_alpha_id] == 1
    assert solution_counts[problem_beta_id] == 3
    assert solution_counts[problem_gamma_id] == 2

    summary = _success_data(_call(connection, product_portal.get_product_solutions_summary, "produto-alpha"))
    assert summary["totalSolutions"] == 6
    assert summary["lastUpdated"] is not None

    empty_summary = _success_data(_call(connection, product_portal.get_product_solutions_summary, "produto-beta"))
    assert empty_summary == {"totalSolutions": 0, "lastUpdated": None}

    missing_solution_delete = _call(connection, product_portal.delete_product_solution, user_id=ids.user_active_1, id="missing")
    assert missing_solution_delete["ok"] is False

    delete_denied = _call(connection, product_portal.delete_product_solution, user_id=ids.user_inactive, id=beta_root_id)
    assert delete_denied["ok"] is False

    _success_data(_call(connection, product_portal.delete_product_solution, user_id=ids.user_active_1, id=beta_root_id))
    remaining_beta_solutions = connection.execute(
        select(tables["product_solution"].c.id).where(
            tables["product_solution"].c.product_problem_id == problem_beta_id
        )
    ).all()
    assert remaining_beta_solutions == []

    missing_problem_delete = _call(connection, product_portal.delete_product_problem, "missing")
    assert missing_problem_delete["ok"] is False

    _success_data(
        _call(
            connection,
            product_portal.create_product_solution,
            user_id=ids.user_active_1,
            problem_id=problem_gamma_id,
            description="Resposta Gamma Root 2",
        )
    )
    _success_data(
        _call(
            connection,
            product_portal.create_product_solution,
            user_id=ids.user_active_2,
            problem_id=problem_gamma_id,
            description="Resposta Gamma Child 2",
            reply_id=next(
                row["id"]
                for row in connection.execute(
                    select(tables["product_solution"].c.id).where(
                        tables["product_solution"].c.product_problem_id == problem_gamma_id,
                        tables["product_solution"].c.reply_id.is_(None),
                    )
                ).mappings().all()
                if True
            ),
        )
    )

    gamma_delete = _success_data(_call(connection, product_portal.delete_product_problem, problem_gamma_id))
    assert gamma_delete is None
    remaining_gamma_solutions = connection.execute(
        select(tables["product_solution"].c.id).where(
            tables["product_solution"].c.product_problem_id == problem_gamma_id
        )
    ).all()
    assert remaining_gamma_solutions == []
