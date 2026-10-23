from __future__ import annotations

import json
from types import SimpleNamespace

import pytest
from fastapi.responses import JSONResponse

from silo.api.routers import procedures as procedures_router
from silo.services.common import service_failure, service_success


def _payload(response: object) -> dict[str, object]:
    if isinstance(response, JSONResponse):
        return json.loads(response.body)
    assert isinstance(response, dict)
    return response


class _FakeUpload:
    filename = "orientacao.pdf"
    content_type = "application/pdf"

    async def read(self) -> bytes:
        return b"%PDF-1.7 fixture"


class _FakeRequest:
    def __init__(self, form: dict[str, object]) -> None:
        self._form = form

    async def form(self, **kwargs: object) -> dict[str, object]:
        assert kwargs["max_files"] == 1
        assert kwargs["max_fields"] == 4
        return self._form


@pytest.mark.asyncio
async def test_procedure_crud_routes_delegate_and_return_api_messages(monkeypatch) -> None:
    calls: list[tuple[str, dict[str, object]]] = []

    monkeypatch.setattr(
        procedures_router,
        "list_general_procedures",
        lambda *args, **kwargs: service_success(
            {"items": [{"id": "procedure-1"}], "total": 1}
        ),
    )
    monkeypatch.setattr(
        procedures_router,
        "create_general_procedure",
        lambda *args, **kwargs: calls.append(("create", kwargs))
        or service_success({"id": "procedure-1"}),
    )
    monkeypatch.setattr(
        procedures_router,
        "update_general_procedure",
        lambda *args, **kwargs: calls.append(("update", kwargs))
        or service_success({"id": "procedure-1"}),
    )
    monkeypatch.setattr(
        procedures_router,
        "delete_general_procedure",
        lambda *args, **kwargs: calls.append(("delete", kwargs)) or service_success(None),
    )

    listed = _payload(
        await procedures_router.get_procedures(
            search="backup",
            active=True,
            page=1,
            limit=20,
            _current_user=SimpleNamespace(id="user-1"),
            db=object(),
        )
    )
    created = _payload(
        await procedures_router.post_procedure(
            {"title": "Backup", "content": "Passo a passo", "category": "Infra"},
            SimpleNamespace(id="user-1"),
            object(),
        )
    )
    updated = _payload(
        await procedures_router.put_procedure(
            "procedure-1",
            {"title": "Backup atualizado", "content": "Novo passo", "active": False},
            SimpleNamespace(id="user-1"),
            object(),
        )
    )
    deleted = _payload(
        await procedures_router.delete_procedure(
            "procedure-1", SimpleNamespace(id="user-1"), object()
        )
    )

    assert listed["data"] == {"items": [{"id": "procedure-1"}], "total": 1}
    assert created["message"] == "Procedimento criado com sucesso."
    assert updated["message"] == "Procedimento atualizado com sucesso."
    assert deleted["message"] == "Procedimento excluído com sucesso."
    assert calls[0][1]["user_id"] == "user-1"
    assert calls[1][1]["id"] == "procedure-1"
    assert calls[2][1]["id"] == "procedure-1"


@pytest.mark.asyncio
async def test_attachment_upload_requires_file_and_delegates_original_bytes(monkeypatch) -> None:
    missing = _payload(
        await procedures_router.upload_procedure_attachment(
            "procedure-1",
            _FakeRequest({}),
            SimpleNamespace(id="user-1"),
            object(),
        )
    )
    assert missing["success"] is False
    assert "arquivo" in str(missing["error"]).lower()

    calls: list[dict[str, object]] = []
    monkeypatch.setattr(
        procedures_router,
        "create_general_procedure_attachment",
        lambda *args, **kwargs: calls.append(kwargs)
        or service_success(
            {"attachment": {"id": "attachment-1", "originalName": "orientacao.pdf"}}
        ),
    )

    response = _payload(
        await procedures_router.upload_procedure_attachment(
            "procedure-1",
            _FakeRequest({"file": _FakeUpload(), "description": "PDF de referência"}),
            SimpleNamespace(id="user-1"),
            object(),
        )
    )

    assert response["message"] == "Anexo adicionado com sucesso."
    assert calls[0]["procedure_id"] == "procedure-1"
    assert calls[0]["content"] == b"%PDF-1.7 fixture"
    assert calls[0]["image_description"] == "PDF de referência"


@pytest.mark.asyncio
async def test_route_converts_service_failures_to_http_errors(monkeypatch) -> None:
    monkeypatch.setattr(
        procedures_router,
        "get_general_procedure",
        lambda *args, **kwargs: service_failure("Procedimento não encontrado.", 404),
    )

    response = _payload(
        await procedures_router.get_procedure(
            "missing", SimpleNamespace(id="user-1"), object()
        )
    )

    assert response["success"] is False
    assert response["error"] == "Procedimento não encontrado."
