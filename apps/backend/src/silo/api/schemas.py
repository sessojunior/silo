from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict


def to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part[:1].upper() + part[1:] for part in tail)


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        extra="forbid",
        populate_by_name=True,
        serialize_by_alias=True,
    )


class FlexibleCamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        extra="allow",
        populate_by_name=True,
        serialize_by_alias=True,
    )


class ApiSuccessPayload(CamelModel):
    success: bool = True
    data: Any | None = None
    message: str | None = None


class ApiErrorPayload(CamelModel):
    success: bool = False
    error: str
    field: str | None = None
    data: Any | None = None
    retry_after_seconds: int | None = None
    reset_flow: bool | None = None
