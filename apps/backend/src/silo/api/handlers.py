from __future__ import annotations

import logging
from collections.abc import Sequence
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from silo.api.errors import (
    ApiError,
    ApiValidationError,
    ConflictError,
    ForbiddenError,
    InfrastructureUnavailableError,
    InternalApiError,
    NotFoundError,
    RateLimitedError,
    UnauthenticatedError,
)
from silo.api.responses import json_error_response

logger = logging.getLogger(__name__)


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApiError, api_error_handler)
    app.add_exception_handler(RequestValidationError, request_validation_error_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(Exception, internal_error_handler)


async def api_error_handler(_: Request, exc: Exception) -> JSONResponse:
    api_error = _coerce_api_error(exc)
    headers: dict[str, str] = {}
    if api_error.retry_after_seconds is not None:
        headers["Retry-After"] = str(api_error.retry_after_seconds)

    return json_error_response(
        api_error.status_code,
        api_error.error,
        data=api_error.data,
        field=api_error.field,
        headers=headers,
        retry_after_seconds=api_error.retry_after_seconds,
        reset_flow=api_error.reset_flow,
    )


async def request_validation_error_handler(_: Request, exc: Exception) -> JSONResponse:
    validation_error = _coerce_request_validation_error(exc)
    return json_error_response(
        validation_error.status_code,
        validation_error.error,
        field=validation_error.field,
    )


async def http_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    http_error = _coerce_http_exception(exc)
    headers: dict[str, str] = {}
    if http_error.retry_after_seconds is not None:
        headers["Retry-After"] = str(http_error.retry_after_seconds)
    return json_error_response(
        http_error.status_code,
        http_error.error,
        data=http_error.data,
        headers=headers,
        retry_after_seconds=http_error.retry_after_seconds,
    )


async def internal_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception(
        "Unhandled API error",
        extra={
            "context": {
                "method": request.method,
                "path": request.url.path,
                "request_id": getattr(request.state, "request_id", None),
            }
        },
    )
    internal_error = InternalApiError()
    return json_error_response(internal_error.status_code, internal_error.error)


def _coerce_api_error(exc: Exception) -> ApiError:
    if isinstance(exc, ApiError):
        return exc
    return InternalApiError()


def _coerce_request_validation_error(exc: Exception) -> ApiValidationError:
    if not isinstance(exc, RequestValidationError):
        return ApiValidationError()

    field = _field_from_validation_errors(exc.errors())
    return ApiValidationError(field=field)


def _coerce_http_exception(exc: Exception) -> ApiError:
    if not isinstance(exc, HTTPException | StarletteHTTPException):
        return InternalApiError()

    detail = exc.detail if isinstance(exc.detail, str) else None
    match exc.status_code:
        case 400:
            return ApiValidationError(detail or "Dados inválidos.")
        case 401:
            return UnauthenticatedError(detail or "Usuário não autenticado.")
        case 403:
            return ForbiddenError(detail or "Permissão negada.")
        case 404:
            return NotFoundError()
        case 409:
            return ConflictError(detail or "Conflito ao processar requisição.")
        case 429:
            return RateLimitedError(detail or "Muitas requisições. Tente novamente em breve.")
        case 503:
            return InfrastructureUnavailableError(detail or "Serviço temporariamente indisponível.")
        case _:
            if exc.status_code >= 500:
                return InternalApiError()
            return ApiValidationError(detail or "Requisição inválida.")


def _field_from_validation_errors(errors: Sequence[dict[str, Any]]) -> str | None:
    if not errors:
        return None

    location = errors[0].get("loc", ())
    if not isinstance(location, Sequence) or isinstance(location, str | bytes):
        return None

    public_parts = [
        str(part) for part in location if str(part) not in {"body", "query", "path", "header"}
    ]
    field = ".".join(public_parts)
    return field or None
