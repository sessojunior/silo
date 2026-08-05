from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from fastapi.responses import JSONResponse

JsonObject = dict[str, Any]


def build_success_payload(
    data: object | None = None,
    *,
    message: str | None = None,
    meta: Mapping[str, object] | None = None,
) -> JsonObject:
    payload: JsonObject = {"success": True}
    if data is not None:
        payload["data"] = data
    if message is not None:
        payload["message"] = message
    if meta is not None:
        payload["meta"] = dict(meta)
    return payload


def build_error_payload(
    error: str,
    *,
    data: object | None = None,
    field: str | None = None,
    retry_after_seconds: int | None = None,
    reset_flow: bool | None = None,
) -> JsonObject:
    payload: JsonObject = {"success": False, "error": error}
    if data is not None:
        payload["data"] = data
    if field is not None:
        payload["field"] = field
    if retry_after_seconds is not None:
        payload["retryAfterSeconds"] = retry_after_seconds
    if reset_flow is not None:
        payload["resetFlow"] = reset_flow
    return payload


def json_error_response(
    status_code: int,
    error: str,
    *,
    data: object | None = None,
    field: str | None = None,
    headers: Mapping[str, str] | None = None,
    retry_after_seconds: int | None = None,
    reset_flow: bool | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=build_error_payload(
            error,
            data=data,
            field=field,
            retry_after_seconds=retry_after_seconds,
            reset_flow=reset_flow,
        ),
        headers=dict(headers or {}),
    )
