from __future__ import annotations

import json
from types import SimpleNamespace

import pytest
from fastapi.responses import JSONResponse
from sqlalchemy import create_engine

from silo.api.routers import products_extended as products_extended_router
from silo.services.common import service_failure, service_success


def _payload(response):
    if isinstance(response, JSONResponse):
        return json.loads(response.body)
    return response


def _patch_success(mp, name: str, data: object) -> None:
    mp.setattr(
        products_extended_router,
        name,
        lambda *args, _data=data, **kwargs: service_success(_data),
    )


@pytest.mark.asyncio
async def test_products_extended_activity_contacts_dependencies_and_manual_paths(monkeypatch) -> None:
    activity_calls: list[dict[str, object]] = []
    availability_exception_calls = 0
    pending_email_calls = 0
    deleted_uploads: list[tuple[str, str]] = []
    contact_calls: list[tuple[tuple[object, ...], dict[str, object]]] = []
    dependency_calls: list[tuple[tuple[object, ...], dict[str, object]]] = []

    async def _pipelines_stub(*, slug: str, date: str | None, turn: str | None):
        return [{"slug": slug, "date": date, "turn": turn, "pipeline": "pipe-1"}]

    def _activity_stub(*args, **kwargs):
        activity_calls.append(dict(kwargs))
        action = "created" if len(activity_calls) == 1 else "updated"
        return service_success(
            {
                "activity": {
                    "id": f"activity-{len(activity_calls)}",
                    "productId": kwargs.get("product_id"),
                    "status": kwargs.get("status"),
                },
                "action": action,
            }
        )

    def _availability_exception_stub(*args, **kwargs):
        nonlocal availability_exception_calls
        availability_exception_calls += 1
        action = "created" if availability_exception_calls == 1 else "updated"
        return service_success(
            {
                "exception": {
                    "id": f"exception-{availability_exception_calls}",
                    "type": kwargs.get("type_value"),
                },
                "action": action,
            }
        )

    def _pending_email_stub(*args, **kwargs):
        nonlocal pending_email_calls
        pending_email_calls += 1
        sent = 1 if pending_email_calls == 1 else 2
        return service_success({"sent": sent})

    def _delete_upload_stub(kind: str, filename: str) -> bool:
        deleted_uploads.append((kind, filename))
        return filename != "missing.webp"

    def _record_contact(*args, **kwargs):
        contact_calls.append((args, kwargs))
        return service_success(None)

    def _record_dependency(*args, **kwargs):
        dependency_calls.append((args, kwargs))
        return service_success({"dependency": {"id": kwargs.get("product_id"), "name": kwargs.get("name")}})

    monkeypatch.setattr(products_extended_router, "_call_product_service", lambda db, func, *args, **kwargs: func(*args, **kwargs))
    monkeypatch.setattr(products_extended_router, "get_product_data_flow_pipelines_from_kafka_rest", _pipelines_stub)
    monkeypatch.setattr(products_extended_router, "is_upload_kind", lambda kind: kind in {"manual", "problems", "solutions"})
    monkeypatch.setattr(products_extended_router, "is_safe_filename", lambda filename: filename != "bad.webp")
    monkeypatch.setattr(products_extended_router, "delete_upload_file", _delete_upload_stub)
    monkeypatch.setattr(products_extended_router, "list_upload_files", lambda kind: [{"kind": kind, "filename": "manual-1.webp"}])

    monkeypatch.setattr(
        products_extended_router,
        "get_product_activity_availability",
        lambda *args, **kwargs: service_success({"available": True, "turn": kwargs.get("turn"), "activityId": kwargs.get("activity_id")}),
    )
    monkeypatch.setattr(products_extended_router, "upsert_product_activity", _activity_stub)
    monkeypatch.setattr(
        products_extended_router,
        "update_product_activity",
        lambda *args, **kwargs: service_success({"activity": {"id": kwargs["id"], "status": kwargs.get("status")}}),
    )
    monkeypatch.setattr(
        products_extended_router,
        "list_product_activity_pending_email_recipients",
        lambda *args, **kwargs: service_success({"items": [{"userId": "user-1"}], "total": 1}),
    )
    monkeypatch.setattr(products_extended_router, "send_product_activity_pending_email", _pending_email_stub)
    _patch_success(monkeypatch, "list_product_availability_exceptions", {"items": [{"id": "exception-1"}]})
    monkeypatch.setattr(products_extended_router, "upsert_product_availability_exception", _availability_exception_stub)
    _patch_success(monkeypatch, "delete_product_availability_exception", None)

    monkeypatch.setattr(
        products_extended_router,
        "list_product_contacts",
        lambda *args, **kwargs: service_success({"contacts": [{"id": "contact-1"}]}),
    )
    monkeypatch.setattr(products_extended_router, "replace_product_contacts", _record_contact)
    _patch_success(monkeypatch, "delete_product_contact_association", None)

    _patch_success(monkeypatch, "list_product_dependencies", [{"id": "dep-1", "name": "Dependencia 1"}])
    monkeypatch.setattr(products_extended_router, "create_product_dependency", _record_dependency)
    monkeypatch.setattr(
        products_extended_router,
        "update_product_dependency",
        lambda *args, **kwargs: service_success({"dependency": {"id": kwargs["id"], "name": kwargs.get("name")}}),
    )
    _patch_success(monkeypatch, "delete_product_dependency", None)
    _patch_success(monkeypatch, "reorder_product_dependencies", None)

    _patch_success(
        monkeypatch,
        "get_product_manual",
        {"manual": {"productId": "produto-alpha", "description": "Manual do produto"}},
    )
    _patch_success(
        monkeypatch,
        "upsert_product_manual",
        {"manual": {"productId": "produto-alpha", "description": "Manual atualizado"}},
    )

    pages = await products_extended_router.get_activity_availability(
        productId=None,
        date="2026-03-06",
        turn="6",
        activityId=None,
        _current_user=object(),
        db=object(),
    )
    assert _payload(pages)["success"] is False

    invalid_turn = _payload(
        await products_extended_router.get_activity_availability(
            productId="produto-alpha",
            date="2026-03-06",
            turn="99",
            activityId=None,
            _current_user=object(),
            db=object(),
        )
    )
    assert invalid_turn["error"].startswith("Turno")

    activity_created = _payload(
        await products_extended_router.post_activity(
            {
                "productId": "produto-alpha",
                "date": "2026-03-06",
                "turn": "6",
                "status": "done",
                "description": "Atividade criada no turno",
                "intervention": "Intervencao",
                "problemCategoryId": "cat-1",
            },
            SimpleNamespace(id="user-1"),
            object(),
        )
    )
    assert activity_created["message"] == "Atividade criada com sucesso"
    assert activity_calls[0]["turn"] == 6

    activity_updated = _payload(
        await products_extended_router.post_activity(
            {
                "productId": "produto-alpha",
                "date": "2026-03-06",
                "turn": 6,
                "status": "done",
                "description": "Atividade atualizada",
            },
            SimpleNamespace(id="user-1"),
            object(),
        )
    )
    assert activity_updated["message"] == "Atividade atualizada com sucesso"

    invalid_pending_email = _payload(
        await products_extended_router.post_pending_email(
            {
                "productId": "produto-alpha",
                "date": "2026-03-06",
                "turn": 6,
                "status": "done",
                "recipientUserIds": ["user-1", " "],
                "message": "Mensagem",
            },
            object(),
            object(),
        )
    )
    assert "destinat" in invalid_pending_email["error"]

    pending_email_singular = _payload(
        await products_extended_router.post_pending_email(
            {
                "productId": "produto-alpha",
                "date": "2026-03-06",
                "turn": 6,
                "status": "done",
                "recipientUserIds": ["user-1"],
                "message": "Mensagem",
                "incidentName": "Incidente 1",
            },
            object(),
            object(),
        )
    )
    assert "enviada" in pending_email_singular["message"]
    assert pending_email_singular["data"]["sent"] == 1

    pending_email_plural = _payload(
        await products_extended_router.post_pending_email(
            {
                "productId": "produto-alpha",
                "date": "2026-03-06",
                "turn": 6,
                "status": "done",
                "recipientUserIds": ["user-1", "user-2"],
                "message": "Mensagem",
            },
            object(),
            object(),
        )
    )
    assert "enviadas" in pending_email_plural["message"]
    assert pending_email_plural["data"]["sent"] == 2

    availability_exceptions = _payload(
        await products_extended_router.get_availability_exceptions(
            productId="produto-alpha",
            from_date="2026-03-01",
            to_date="2026-03-31",
            _current_user=object(),
            db=object(),
        )
    )
    assert availability_exceptions["data"]["total"] == 1

    invalid_exception_type = _payload(
        await products_extended_router.post_availability_exception(
            {
                "productId": "produto-alpha",
                "date": "2026-03-06",
                "type": "invalid",
                "description": "Excecao invalida",
            },
            object(),
            object(),
        )
    )
    assert "Tipo de exce" in invalid_exception_type["error"]

    exception_created = _payload(
        await products_extended_router.post_availability_exception(
            {
                "productId": "produto-alpha",
                "date": "2026-03-06",
                "type": next(iter(products_extended_router.PRODUCT_AVAILABILITY_EXCEPTION_TYPES)),
                "description": "Excecao criada",
            },
            object(),
            object(),
        )
    )
    assert "criada" in exception_created["message"]

    exception_updated = _payload(
        await products_extended_router.post_availability_exception(
            {
                "productId": "produto-alpha",
                "date": "2026-03-07",
                "type": next(iter(products_extended_router.PRODUCT_AVAILABILITY_EXCEPTION_TYPES)),
                "description": "Excecao atualizada",
            },
            object(),
            object(),
        )
    )
    assert "atualizada" in exception_updated["message"]

    deleted_exception = _payload(
        await products_extended_router.delete_availability_exception(
            id="exception-1",
            _current_user=object(),
            db=object(),
        )
    )
    assert "removida" in deleted_exception["message"]

    invalid_contact_assoc = _payload(
        await products_extended_router.post_contacts(
            {"productId": "produto-alpha", "contactIds": ["contact-1", 1]},
            object(),
            object(),
        )
    )
    assert "ProductId" in invalid_contact_assoc["error"]

    contact_result_ok = _payload(
        await products_extended_router.post_contacts(
            {"productId": "produto-alpha", "contactIds": ["contact-1", "contact-2"]},
            object(),
            object(),
        )
    )
    assert contact_result_ok["message"] == "2 contatos associados com sucesso"
    assert contact_calls[-1][1]["contact_ids"] == ["contact-1", "contact-2"]

    contact_delete = _payload(
        await products_extended_router.delete_contact(
            {"associationId": "assoc-1"},
            object(),
            object(),
        )
    )
    assert "removida" in contact_delete["message"]

    dependencies = _payload(
        await products_extended_router.get_dependencies(
            productId="produto-alpha",
            _current_user=object(),
            db=object(),
        )
    )
    assert dependencies["data"]["dependencies"][0]["id"] == "dep-1"

    dependency_created = _payload(
        await products_extended_router.post_dependency(
            {
                "productId": "produto-alpha",
                "name": "Dependencia criada",
                "icon": "icon-[lucide--database]",
                "description": "Descricao",
                "parentId": "parent-1",
            },
            object(),
            object(),
        )
    )
    assert "criada" in dependency_created["message"]

    dependency_updated = _payload(
        await products_extended_router.put_dependency(
            {
                "id": "dep-1",
                "name": "Dependencia atualizada",
                "icon": "icon-[lucide--database]",
                "description": "Descricao atualizada",
                "parentId": "parent-2",
                "newPosition": "3",
            },
            object(),
            object(),
        )
    )
    assert "atualizada" in dependency_updated["message"]
    assert dependency_updated["data"]["name"] == "Dependencia atualizada"

    reorder_result = _payload(
        await products_extended_router.reorder_dependencies(
            {"productId": "produto-alpha", "items": [{"id": "dep-1", "parentId": None}]},
            object(),
            object(),
        )
    )
    assert "reordenadas" in reorder_result["message"]

    manual = _payload(
        await products_extended_router.get_manual(
            productSlug="produto-alpha",
            productId=None,
            _current_user=object(),
            db=object(),
        )
    )
    assert manual["data"]["description"] == "Manual do produto"

    manual_saved = _payload(
        await products_extended_router.put_manual(
            {"productId": "produto-alpha", "description": "Manual atualizado"},
            object(),
            object(),
        )
    )
    assert manual_saved["message"] == "Manual salvo com sucesso"

    manual_images = _payload(
        await products_extended_router.get_manual_images(object())
    )
    assert manual_images["data"]["items"][0]["filename"] == "manual-1.webp"

    invalid_manual_image_delete = _payload(
        await products_extended_router.delete_manual_image(
            {"filename": "bad.webp"},
            object(),
        )
    )
    assert "Arquivo" in invalid_manual_image_delete["error"]

    deleted_manual_image = _payload(
        await products_extended_router.delete_manual_image(
            {"filename": "manual-1.webp"},
            object(),
        )
    )
    assert "exclu" in deleted_manual_image["message"]

    assert deleted_uploads == [("manual", "manual-1.webp")]

    upload_helper = products_extended_router._delete_upload_from_url  # noqa: SLF001
    upload_helper("/uploads/manual/manual-2.webp?download=1")
    upload_helper("/uploads/manual/bad.webp")
    upload_helper("https://example.test/manual-3.webp")
    assert deleted_uploads == [("manual", "manual-1.webp"), ("manual", "manual-2.webp")]


@pytest.mark.asyncio
async def test_products_extended_problem_solution_and_data_flow_paths(monkeypatch) -> None:
    deleted_uploads: list[tuple[str, str]] = []

    async def _pipelines_stub(*, slug: str, date: str | None, turn: str | None):
        return [{"slug": slug, "date": date, "turn": turn, "pipeline": "pipe-1"}]

    async def _pipelines_error_stub(*, slug: str, date: str | None, turn: str | None):
        raise RuntimeError("boom")

    monkeypatch.setattr(products_extended_router, "_call_product_service", lambda db, func, *args, **kwargs: func(*args, **kwargs))
    monkeypatch.setattr(products_extended_router, "get_product_data_flow_pipelines_from_kafka_rest", _pipelines_stub)
    monkeypatch.setattr(products_extended_router, "delete_upload_file", lambda kind, filename: deleted_uploads.append((kind, filename)) or True)
    monkeypatch.setattr(products_extended_router, "is_upload_kind", lambda kind: kind in {"problems", "solutions"})
    monkeypatch.setattr(products_extended_router, "is_safe_filename", lambda filename: filename != "bad.webp")

    _patch_success(monkeypatch, "list_product_problems", {"items": [{"id": "problem-1"}]})
    _patch_success(monkeypatch, "create_product_problem", None)
    _patch_success(monkeypatch, "update_product_problem", None)
    _patch_success(monkeypatch, "delete_product_problem", None)
    _patch_success(monkeypatch, "list_product_problem_categories", {"items": [{"id": "cat-1"}]})
    _patch_success(monkeypatch, "create_product_problem_category", {"category": {"id": "cat-new"}})
    _patch_success(monkeypatch, "update_product_problem_category", None)
    _patch_success(monkeypatch, "delete_product_problem_category", None)
    _patch_success(monkeypatch, "list_product_problem_images", {"items": [{"id": "problem-image-1"}]})
    _patch_success(monkeypatch, "create_product_problem_image", {"image": {"image": "/uploads/problems/problem-1.webp"}})
    _patch_success(monkeypatch, "delete_product_problem_image", {"image": {"image": "/uploads/problems/problem-1.webp"}})
    _patch_success(monkeypatch, "list_product_solutions", {"items": [{"id": "solution-1"}]})
    _patch_success(monkeypatch, "create_product_solution", None)
    _patch_success(monkeypatch, "update_product_solution", None)
    _patch_success(monkeypatch, "delete_product_solution", None)
    _patch_success(monkeypatch, "count_product_solutions", {"counts": {"problem-1": 2}})
    _patch_success(monkeypatch, "get_product_solutions_summary", {"summary": {"count": 2}})
    _patch_success(monkeypatch, "list_product_solution_images", {"items": [{"id": "solution-image-1"}]})
    _patch_success(monkeypatch, "create_product_solution_image", {"image": {"image": "/uploads/solutions/solution-1.webp"}})
    _patch_success(monkeypatch, "delete_product_solution_image", {"image": {"image": "/uploads/solutions/solution-1.webp"}})
    _patch_success(monkeypatch, "list_product_activity_history", {"history": [{"id": "history-1"}]})

    invalid_problem = _payload(
        await products_extended_router.get_problems(
            slug=None,
            page="1",
            limit="20",
            _current_user=object(),
            db=object(),
        )
    )
    assert "slug" in invalid_problem["error"]

    problems = _payload(
        await products_extended_router.get_problems(
            slug="produto-alpha",
            page="2",
            limit="10",
            _current_user=object(),
            db=object(),
        )
    )
    assert problems["data"]["items"][0]["id"] == "problem-1"

    invalid_problem_create = _payload(
        await products_extended_router.post_problem(
            {
                "productId": "produto-alpha",
                "problemCategoryId": "cat-1",
                "title": "Curto",
                "description": "Descricao curta",
            },
            SimpleNamespace(id="user-1"),
            object(),
        )
    )
    assert "descri" in invalid_problem_create["error"] and "20" in invalid_problem_create["error"]

    problem_created = _payload(
        await products_extended_router.post_problem(
            {
                "productId": "produto-alpha",
                "problemCategoryId": "cat-1",
                "title": "Problema criado",
                "description": "Descricao do problema criada com mais de vinte caracteres.",
            },
            SimpleNamespace(id="user-1"),
            object(),
        )
    )
    assert problem_created["message"] == "Problema cadastrado com sucesso"

    problem_updated = _payload(
        await products_extended_router.put_problem(
            {
                "id": "problem-1",
                "problemCategoryId": "cat-1",
                "title": "Problema atualizado",
                "description": "Descricao do problema atualizada com mais de vinte caracteres.",
            },
            object(),
            object(),
        )
    )
    assert problem_updated["message"] == "Problema atualizado com sucesso"

    problem_deleted = _payload(
        await products_extended_router.delete_problem(
            {"id": "problem-1"},
            object(),
            object(),
        )
    )
    assert "exclu" in problem_deleted["message"]

    problem_categories = _payload(
        await products_extended_router.get_problem_categories(
            search="cat",
            _current_user=object(),
            db=object(),
        )
    )
    assert problem_categories["data"][0]["id"] == "cat-1"

    invalid_problem_category = _payload(
        await products_extended_router.post_problem_category(
            {"name": "A"},
            object(),
            object(),
        )
    )
    assert "Nome" in invalid_problem_category["error"]

    problem_category_created = _payload(
        await products_extended_router.post_problem_category(
            {"name": "Categoria", "color": "#111111"},
            object(),
            object(),
        )
    )
    assert problem_category_created["message"] == "Categoria criada com sucesso"

    problem_category_updated = _payload(
        await products_extended_router.put_problem_category(
            {"id": "cat-1", "name": "Categoria atualizada", "color": "#222222"},
            object(),
            object(),
        )
    )
    assert problem_category_updated["message"] == "Categoria atualizada com sucesso"

    problem_category_deleted = _payload(
        await products_extended_router.delete_problem_category("cat-1", object(), object())
    )
    assert "exclu" in problem_category_deleted["message"]

    invalid_problem_image = _payload(
        await products_extended_router.get_problem_images(
            problemId=None,
            _current_user=object(),
            db=object(),
        )
    )
    assert "problemId" in invalid_problem_image["error"]

    problem_images = _payload(
        await products_extended_router.get_problem_images(
            problemId="problem-1",
            _current_user=object(),
            db=object(),
        )
    )
    assert problem_images["data"]["items"][0]["id"] == "problem-image-1"

    problem_image_created = _payload(
        await products_extended_router.post_problem_image(
            {
                "productProblemId": "problem-1",
                "imageUrl": "/uploads/problems/problem-1.webp",
                "description": "Descricao da imagem",
            },
            object(),
            object(),
        )
    )
    assert problem_image_created["message"] == "Imagem enviada com sucesso"

    problem_image_deleted = _payload(
        await products_extended_router.delete_problem_image(
            {"id": "problem-image-1"},
            object(),
            object(),
        )
    )
    assert "exclu" in problem_image_deleted["message"]

    invalid_solution = _payload(
        await products_extended_router.get_solutions(
            problemId=None,
            _current_user=object(),
            db=object(),
        )
    )
    assert "problemId" in invalid_solution["error"]

    solutions = _payload(
        await products_extended_router.get_solutions(
            problemId="problem-1",
            _current_user=object(),
            db=object(),
        )
    )
    assert solutions["data"]["items"][0]["id"] == "solution-1"

    invalid_solution_create = _payload(
        await products_extended_router.post_solution(
            {"problemId": "problem-1", "description": "A"},
            SimpleNamespace(id="user-1"),
            object(),
        )
    )
    assert "obrigat" in invalid_solution_create["error"]

    solution_created = _payload(
        await products_extended_router.post_solution(
            {"problemId": "problem-1", "description": "Solucao criada"},
            SimpleNamespace(id="user-1"),
            object(),
        )
    )
    assert "criada" in solution_created["message"]

    solution_updated = _payload(
        await products_extended_router.put_solution(
            {"id": "solution-1", "description": "Solucao atualizada", "removeImage": True},
            SimpleNamespace(id="user-1"),
            object(),
        )
    )
    assert "atualizada" in solution_updated["message"]

    solution_deleted = _payload(
        await products_extended_router.delete_solution(
            {"id": "solution-1"},
            SimpleNamespace(id="user-1"),
            object(),
        )
    )
    assert "exclu" in solution_deleted["message"]

    invalid_count = _payload(
        await products_extended_router.count_solutions(
            {"problemIds": []},
            object(),
            object(),
        )
    )
    assert "problemIds" in invalid_count["error"]

    count_result = _payload(
        await products_extended_router.count_solutions(
            {"problemIds": ["problem-1", " "]},
            object(),
            object(),
        )
    )
    assert count_result["data"]["counts"]["problem-1"] == 2

    summary = _payload(
        await products_extended_router.solutions_summary(
            productSlug="produto-alpha",
            _current_user=object(),
            db=object(),
        )
    )
    assert summary["data"]["summary"]["count"] == 2

    invalid_solution_images = _payload(
        await products_extended_router.get_solution_images(
            solutionId=None,
            _current_user=object(),
            db=object(),
        )
    )
    assert "solutionId" in invalid_solution_images["error"]

    solution_images = _payload(
        await products_extended_router.get_solution_images(
            solutionId="solution-1",
            _current_user=object(),
            db=object(),
        )
    )
    assert solution_images["data"]["items"][0]["id"] == "solution-image-1"

    solution_image_created = _payload(
        await products_extended_router.post_solution_image(
            {
                "productSolutionId": "solution-1",
                "imageUrl": "/uploads/solutions/solution-1.webp",
                "description": "Descricao da imagem",
            },
            object(),
            object(),
        )
    )
    assert solution_image_created["message"] == "Imagem enviada com sucesso"

    solution_image_deleted = _payload(
        await products_extended_router.delete_solution_image(
            {"id": "solution-image-1"},
            object(),
            object(),
        )
    )
    assert "exclu" in solution_image_deleted["message"]

    history = _payload(
        await products_extended_router.get_history(
            "produto-alpha",
            date="2026-03-06",
            turn="6",
            _current_user=object(),
            db=object(),
        )
    )
    assert history["data"]["history"][0]["id"] == "history-1"

    data_flow = _payload(
        await products_extended_router.get_data_flow(
            "produto-alpha",
            date="2026-03-06",
            turn="6",
            _current_user=object(),
            db=object(),
        )
    )
    assert data_flow["data"]["pipelines"][0]["pipeline"] == "pipe-1"

    monkeypatch.setattr(products_extended_router, "get_product_data_flow_pipelines_from_kafka_rest", _pipelines_error_stub)
    data_flow_error = _payload(
        await products_extended_router.get_data_flow(
            "produto-alpha",
            date="2026-03-06",
            turn="6",
            _current_user=object(),
            db=object(),
        )
    )
    assert data_flow_error["error"] == "Erro ao buscar data flow."

    assert deleted_uploads == [
        ("problems", "problem-1.webp"),
        ("solutions", "solution-1.webp"),
    ]


def test_products_extended_helpers_cover_optional_parsing_and_upload_cleanup(monkeypatch) -> None:
    deleted_uploads: list[tuple[str, str]] = []

    monkeypatch.setattr(products_extended_router, "is_upload_kind", lambda kind: kind == "manual")
    monkeypatch.setattr(products_extended_router, "is_safe_filename", lambda filename: filename != "bad.webp")
    monkeypatch.setattr(products_extended_router, "delete_upload_file", lambda kind, filename: deleted_uploads.append((kind, filename)) or True)

    assert products_extended_router._required_text("  texto  ") == "texto"  # noqa: SLF001
    assert products_extended_router._required_text("   ") is None  # noqa: SLF001
    assert products_extended_router._optional_text("  texto  ") == "texto"  # noqa: SLF001
    assert products_extended_router._optional_text(123) is None  # noqa: SLF001
    assert products_extended_router._optional_int("7") == 7  # noqa: SLF001
    assert products_extended_router._optional_int("bad") is None  # noqa: SLF001
    assert products_extended_router._optional_bool("true") is True  # noqa: SLF001
    assert products_extended_router._optional_bool("off") is False  # noqa: SLF001
    assert products_extended_router._optional_bool(None, default=True) is True  # noqa: SLF001

    delete_upload = products_extended_router._delete_upload_from_url  # noqa: SLF001
    delete_upload("/uploads/manual/manual-9.webp")
    delete_upload("/uploads/manual/bad.webp")
    delete_upload("https://example.test/manual-10.webp")
    assert deleted_uploads == [("manual", "manual-9.webp")]


@pytest.mark.asyncio
async def test_products_extended_simple_routes_and_validation_branches(monkeypatch) -> None:
    monkeypatch.setattr(products_extended_router, "_call_product_service", lambda db, func, *args, **kwargs: func(*args, **kwargs))
    _patch_success(monkeypatch, "get_product_activity_availability", {"available": True})
    _patch_success(monkeypatch, "update_product_activity", {"activity": {"id": "activity-1", "status": "done"}})
    _patch_success(monkeypatch, "list_product_activity_pending_email_recipients", {"items": [{"userId": "user-1"}], "total": 1})
    _patch_success(monkeypatch, "list_product_contacts", {"contacts": [{"id": "contact-1"}]})
    _patch_success(monkeypatch, "delete_product_contact_association", None)
    _patch_success(monkeypatch, "delete_product_dependency", None)

    invalid_activity = _payload(
        await products_extended_router.get_activity_availability(
            productId="produto-alpha",
            date=None,
            turn="6",
            activityId=None,
            _current_user=object(),
            db=object(),
        )
    )
    assert "Data" in invalid_activity["error"]

    activity = _payload(
        await products_extended_router.put_activity(
            {"id": "activity-1", "status": "done", "description": "Atividade", "intervention": "Ação"},
            SimpleNamespace(id="user-1"),
            object(),
        )
    )
    assert activity["data"]["id"] == "activity-1"

    recipients = _payload(await products_extended_router.get_pending_email_recipients(object(), object()))
    assert recipients["data"]["total"] == 1

    contacts = _payload(
        await products_extended_router.get_contacts(
            productId="produto-alpha",
            _current_user=object(),
            db=object(),
        )
    )
    assert contacts["data"]["total"] == 1

    invalid_dependency_delete = _payload(
        await products_extended_router.delete_dependency(
            {"id": "   "},
            object(),
            object(),
        )
    )
    assert "ID" in invalid_dependency_delete["error"]

    dependency_deleted = _payload(
        await products_extended_router.delete_dependency(
            {"id": "dep-1"},
            object(),
            object(),
        )
    )
    assert "exclu" in dependency_deleted["message"]


@pytest.mark.asyncio
async def test_products_extended_routes_cover_service_error_branches(monkeypatch) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    connection = engine.connect()
    try:
        assert products_extended_router._call_product_service(connection, lambda: {"ok": True}) == {"ok": True}  # noqa: SLF001
    finally:
        connection.close()
        engine.dispose()

    monkeypatch.setattr(
        products_extended_router,
        "_call_product_service",
        lambda _db, _func, *args, **kwargs: service_failure("boom", 500),
    )

    async def _pipelines_error_stub(*, slug: str, date: str | None, turn: str | None):
        raise RuntimeError("boom")

    monkeypatch.setattr(
        products_extended_router,
        "get_product_data_flow_pipelines_from_kafka_rest",
        _pipelines_error_stub,
    )

    assert _payload(
        await products_extended_router.get_activity_availability(
            productId="produto-alpha",
            date="2026-03-06",
            turn="6",
            activityId=None,
            _current_user=object(),
            db=object(),
        )
    )["success"] is False

    assert _payload(
        await products_extended_router.post_activity(
            {
                "productId": "produto-alpha",
                "date": "2026-03-06",
                "turn": "6",
                "status": "done",
                "description": "Atividade criada no turno",
                "intervention": "Intervencao",
            },
            SimpleNamespace(id="user-1"),
            object(),
        )
    )["success"] is False

    assert _payload(
        await products_extended_router.put_activity(
            {
                "id": "activity-1",
                "status": "done",
                "description": "Atividade",
                "intervention": "Ação",
            },
            SimpleNamespace(id="user-1"),
            object(),
        )
    )["success"] is False

    assert _payload(await products_extended_router.get_pending_email_recipients(object(), object()))["success"] is False

    assert _payload(
        await products_extended_router.post_pending_email(
            {
                "productId": "produto-alpha",
                "date": "2026-03-06",
                "turn": 6,
                "status": "done",
                "recipientUserIds": ["user-1"],
                "message": "Mensagem",
            },
            object(),
            object(),
        )
    )["success"] is False

    assert _payload(
        await products_extended_router.get_availability_exceptions(
            productId="produto-alpha",
            from_date="2026-03-01",
            to_date="2026-03-31",
            _current_user=object(),
            db=object(),
        )
    )["success"] is False

    assert _payload(
        await products_extended_router.post_availability_exception(
            {
                "productId": "produto-alpha",
                "date": "2026-03-06",
                "type": next(iter(products_extended_router.PRODUCT_AVAILABILITY_EXCEPTION_TYPES)),
                "description": "Excecao criada",
            },
            object(),
            object(),
        )
    )["success"] is False

    assert _payload(
        await products_extended_router.delete_availability_exception(
            id="exception-1",
            _current_user=object(),
            db=object(),
        )
    )["success"] is False

    assert _payload(
        await products_extended_router.get_contacts(
            productId="produto-alpha",
            _current_user=object(),
            db=object(),
        )
    )["success"] is False

    assert _payload(
        await products_extended_router.post_contacts(
            {"productId": "produto-alpha", "contactIds": ["contact-1", "contact-2"]},
            object(),
            object(),
        )
    )["success"] is False

    assert _payload(
        await products_extended_router.delete_contact(
            {"associationId": "assoc-1"},
            object(),
            object(),
        )
    )["success"] is False

    assert _payload(
        await products_extended_router.get_dependencies(
            productId="produto-alpha",
            _current_user=object(),
            db=object(),
        )
    )["success"] is False

    assert _payload(
        await products_extended_router.post_dependency(
            {
                "productId": "produto-alpha",
                "name": "Dependencia criada",
                "icon": "icon-[lucide--database]",
                "description": "Descricao",
                "parentId": "parent-1",
            },
            object(),
            object(),
        )
    )["success"] is False

    assert _payload(
        await products_extended_router.put_dependency(
            {
                "id": "dep-1",
                "name": "Dependencia atualizada",
                "icon": "icon-[lucide--database]",
                "description": "Descricao atualizada",
                "parentId": "parent-2",
                "newPosition": "3",
            },
            object(),
            object(),
        )
    )["success"] is False

    assert _payload(
        await products_extended_router.delete_dependency(
            {"id": "dep-1"},
            object(),
            object(),
        )
    )["success"] is False

    assert _payload(
        await products_extended_router.reorder_dependencies(
            {"productId": "produto-alpha", "items": [{"id": "dep-1", "parentId": None}]},
            object(),
            object(),
        )
    )["success"] is False

    assert _payload(
        await products_extended_router.get_manual(
            productSlug="produto-alpha",
            productId=None,
            _current_user=object(),
            db=object(),
        )
    )["success"] is False

    assert _payload(
        await products_extended_router.put_manual(
            {"productId": "produto-alpha", "description": "Manual atualizado"},
            object(),
            object(),
        )
    )["success"] is False

    assert _payload(
        await products_extended_router.get_problems(
            slug="produto-alpha",
            page="2",
            limit="10",
            _current_user=object(),
            db=object(),
        )
    )["success"] is False

    assert _payload(
        await products_extended_router.post_problem(
            {
                "productId": "produto-alpha",
                "problemCategoryId": "cat-1",
                "title": "Problema criado",
                "description": "Descricao do problema criada com mais de vinte caracteres.",
            },
            SimpleNamespace(id="user-1"),
            object(),
        )
    )["success"] is False

    assert _payload(
        await products_extended_router.put_problem(
            {
                "id": "problem-1",
                "problemCategoryId": "cat-1",
                "title": "Problema atualizado",
                "description": "Descricao do problema atualizada com mais de vinte caracteres.",
            },
            object(),
            object(),
        )
    )["success"] is False

    assert _payload(
        await products_extended_router.delete_problem(
            {"id": "problem-1"},
            object(),
            object(),
        )
    )["success"] is False

    assert _payload(
        await products_extended_router.get_problem_categories(
            search="cat",
            _current_user=object(),
            db=object(),
        )
    )["success"] is False

    assert _payload(
        await products_extended_router.post_problem_category(
            {"name": "Categoria", "color": "#111111"},
            object(),
            object(),
        )
    )["success"] is False

    assert _payload(
        await products_extended_router.put_problem_category(
            {"id": "cat-1", "name": "Categoria atualizada", "color": "#222222"},
            object(),
            object(),
        )
    )["success"] is False

    assert _payload(
        await products_extended_router.delete_problem_category("cat-1", object(), object())
    )["success"] is False

    assert _payload(
        await products_extended_router.get_problem_images(
            problemId="problem-1",
            _current_user=object(),
            db=object(),
        )
    )["success"] is False

    assert _payload(
        await products_extended_router.get_solutions(
            problemId="problem-1",
            _current_user=object(),
            db=object(),
        )
    )["success"] is False

    assert _payload(
        await products_extended_router.post_solution(
            {"problemId": "problem-1", "description": "Solucao criada"},
            SimpleNamespace(id="user-1"),
            object(),
        )
    )["success"] is False

    assert _payload(
        await products_extended_router.put_solution(
            {"id": "solution-1", "description": "Solucao atualizada", "removeImage": True},
            SimpleNamespace(id="user-1"),
            object(),
        )
    )["success"] is False

    assert _payload(
        await products_extended_router.delete_solution(
            {"id": "solution-1"},
            SimpleNamespace(id="user-1"),
            object(),
        )
    )["success"] is False

    assert _payload(
        await products_extended_router.count_solutions(
            {"problemIds": ["problem-1"]},
            object(),
            object(),
        )
    )["success"] is False

    assert _payload(
        await products_extended_router.solutions_summary(
            productSlug="produto-alpha",
            _current_user=object(),
            db=object(),
        )
    )["success"] is False

    assert _payload(
        await products_extended_router.get_solution_images(
            solutionId="solution-1",
            _current_user=object(),
            db=object(),
        )
    )["success"] is False

    assert _payload(
        await products_extended_router.get_history(
            productId="produto-alpha",
            _current_user=object(),
            db=object(),
        )
    )["success"] is False

    data_flow_error = _payload(
        await products_extended_router.get_data_flow(
            productId="produto-alpha",
            date=None,
            turn=None,
            _current_user=object(),
            db=object(),
        )
    )
    assert data_flow_error["success"] is False

