from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from fastapi.responses import JSONResponse

T = TypeVar("T")


def service_success(data: T, *, message: str | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"ok": True, "data": data}
    if message is not None:
        payload["message"] = message
    return payload


def service_failure(
    error: str,
    status: int = 400,
    *,
    field: str | None = None,
    data: object | None = None,
    retry_after_seconds: int | None = None,
    reset_flow: bool | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {"ok": False, "error": error, "status": status}
    if field is not None:
        payload["field"] = field
    if data is not None:
        payload["data"] = data
    if retry_after_seconds is not None:
        payload["retryAfterSeconds"] = retry_after_seconds
    if reset_flow is not None:
        payload["resetFlow"] = reset_flow
    return payload


def is_service_error(result: object) -> bool:
    return isinstance(result, Mapping) and result.get("ok") is False and "error" in result


def service_error_response(result: object, fallback_message: str) -> JSONResponse | None:
    if not is_service_error(result):
        return None

    error_result = result
    status = int(error_result.get("status") or 400)
    retry_after_seconds = (
        int(error_result["retryAfterSeconds"])
        if isinstance(error_result.get("retryAfterSeconds"), int)
        else None
    )

    payload: dict[str, Any] = {
        "success": False,
        "error": str(error_result.get("error") or fallback_message),
    }
    if isinstance(error_result.get("field"), str):
        payload["field"] = error_result["field"]
    if "data" in error_result:
        payload["data"] = error_result["data"]
    if retry_after_seconds is not None:
        payload["retryAfterSeconds"] = retry_after_seconds
    if isinstance(error_result.get("resetFlow"), bool):
        payload["resetFlow"] = error_result["resetFlow"]

    headers: dict[str, str] = {}
    if status == 429 and retry_after_seconds is not None:
        headers["Retry-After"] = str(retry_after_seconds)

    return JSONResponse(status_code=status, content=payload, headers=headers)
