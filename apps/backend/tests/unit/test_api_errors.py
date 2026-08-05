from __future__ import annotations

import json

from fastapi import Body, FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel

from silo.api.errors import (
    ConflictError,
    ForbiddenError,
    InfrastructureUnavailableError,
    NotFoundError,
    RateLimitedError,
    UnauthenticatedError,
)
from silo.api import handlers as api_handlers
from silo.api.handlers import register_exception_handlers
from silo.services.common import is_service_error, service_error_response, service_failure, service_success


class ValidationPayload(BaseModel):
    name: str


VALIDATION_BODY = Body(...)


def test_typed_error_handlers_return_legacy_error_envelope() -> None:
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/api/unauthenticated")
    def unauthenticated() -> None:
        raise UnauthenticatedError()

    @app.get("/api/forbidden")
    def forbidden() -> None:
        raise ForbiddenError()

    @app.get("/api/not-found")
    def not_found() -> None:
        raise NotFoundError()

    @app.get("/api/conflict")
    def conflict() -> None:
        raise ConflictError()

    @app.get("/api/rate-limited")
    def rate_limited() -> None:
        raise RateLimitedError(retry_after_seconds=37)

    @app.get("/api/unavailable")
    def unavailable() -> None:
        raise InfrastructureUnavailableError()

    client = TestClient(app)

    assert client.get("/api/unauthenticated").json() == {
        "success": False,
        "error": "Usuário não autenticado.",
    }
    assert client.get("/api/forbidden").json() == {
        "success": False,
        "error": "Permissão negada.",
    }
    assert client.get("/api/not-found").json() == {
        "success": False,
        "error": "Recurso não encontrado.",
    }
    assert client.get("/api/conflict").json() == {
        "success": False,
        "error": "Conflito ao processar requisição.",
    }

    rate_limited_response = client.get("/api/rate-limited")
    assert rate_limited_response.status_code == 429
    assert rate_limited_response.headers["retry-after"] == "37"
    assert rate_limited_response.json() == {
        "success": False,
        "error": "Muitas requisições. Tente novamente em breve.",
        "retryAfterSeconds": 37,
    }

    unavailable_response = client.get("/api/unavailable")
    assert unavailable_response.status_code == 503
    assert unavailable_response.json() == {
        "success": False,
        "error": "Serviço temporariamente indisponível.",
    }


def test_request_validation_error_returns_400_without_pydantic_schema_leak() -> None:
    app = FastAPI()
    register_exception_handlers(app)

    @app.post("/api/validation")
    def validation(payload: ValidationPayload = VALIDATION_BODY) -> dict[str, str]:
        return {"name": payload.name}

    response = TestClient(app).post("/api/validation", json={})

    assert response.status_code == 400
    assert response.json() == {"success": False, "error": "Dados inválidos.", "field": "name"}
    assert "detail" not in response.json()


def test_http_exception_and_internal_error_handlers_are_normalized() -> None:
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/api/http-403")
    def http_403() -> None:
        raise HTTPException(status_code=403, detail="Permissão negada.")

    @app.get("/api/http-429")
    def http_429() -> None:
        raise HTTPException(status_code=429, detail="Muitas requisições. Tente novamente em breve.")

    @app.get("/api/internal")
    def internal() -> None:
        raise RuntimeError("database://secret")

    client = TestClient(app, raise_server_exceptions=False)

    assert client.get("/api/http-403").json() == {
        "success": False,
        "error": "Permissão negada.",
    }
    http_429_response = client.get("/api/http-429")
    assert http_429_response.headers["retry-after"] == "60"
    assert http_429_response.json() == {
        "success": False,
        "error": "Muitas requisições. Tente novamente em breve.",
        "retryAfterSeconds": 60,
    }
    assert client.get("/missing").json() == {
        "success": False,
        "error": "Recurso não encontrado.",
    }
    assert client.get("/api/internal").json() == {
        "success": False,
        "error": "Erro interno do servidor",
    }


def test_api_handler_and_common_helpers_cover_remaining_branches() -> None:
    assert api_handlers._coerce_api_error(RuntimeError("boom")).status_code == 500  # noqa: SLF001
    assert api_handlers._coerce_request_validation_error(RuntimeError("boom")).status_code == 400  # noqa: SLF001
    assert api_handlers._coerce_http_exception(RuntimeError("boom")).status_code == 500  # noqa: SLF001
    assert api_handlers._coerce_http_exception(HTTPException(status_code=400, detail="")).error == "Dados inválidos."  # noqa: SLF001
    assert api_handlers._coerce_http_exception(HTTPException(status_code=401, detail="")).error == "Usuário não autenticado."  # noqa: SLF001
    assert api_handlers._coerce_http_exception(HTTPException(status_code=409, detail="")).error == "Conflito ao processar requisição."  # noqa: SLF001
    assert api_handlers._coerce_http_exception(HTTPException(status_code=503, detail="")).error == "Serviço temporariamente indisponível."  # noqa: SLF001
    assert api_handlers._coerce_http_exception(HTTPException(status_code=418, detail="")).error == "Requisição inválida."  # noqa: SLF001
    assert api_handlers._field_from_validation_errors([]) is None  # noqa: SLF001
    assert api_handlers._field_from_validation_errors([{"loc": "bad"}]) is None  # noqa: SLF001

    assert service_success({"id": "item-1"}) == {"ok": True, "data": {"id": "item-1"}}
    assert service_success({"id": "item-1"}, message="ok") == {
        "ok": True,
        "data": {"id": "item-1"},
        "message": "ok",
    }

    failure = service_failure(
        "boom",
        429,
        field="name",
        data={"id": "item-1"},
        retry_after_seconds=30,
        reset_flow=True,
    )
    assert is_service_error(failure) is True
    assert service_error_response({"ok": True}, "fallback") is None

    response = service_error_response(failure, "fallback")
    assert response is not None
    assert response.status_code == 429
    assert response.headers["retry-after"] == "30"
    assert json.loads(response.body) == {
        "success": False,
        "error": "boom",
        "field": "name",
        "data": {"id": "item-1"},
        "retryAfterSeconds": 30,
        "resetFlow": True,
    }
