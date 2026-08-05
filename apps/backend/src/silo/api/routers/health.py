from __future__ import annotations

from collections.abc import Awaitable, Callable
from datetime import datetime
from typing import Literal

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict

from silo.clock import SYSTEM_CLOCK, Clock, ensure_utc
from silo.config import Settings, SettingsLoadError, load_settings
from silo.db.health import check_database_ready

router = APIRouter(tags=["health"])
type SettingsLoader = Callable[[], Settings]
type DatabaseChecker = Callable[[str], Awaitable[None]]
type ComponentStatus = Literal["ok", "error", "not_configured", "skipped"]


class LegacyHealthResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    status: Literal["ok"]
    app: Literal["silo-api"]
    timestamp: str


class HealthCheckResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    status: Literal["ok"]
    service: Literal["silo-api-python"]
    timestamp: str
    checks: dict[str, Literal["ok"]]


class ComponentHealth(BaseModel):
    model_config = ConfigDict(frozen=True)

    status: ComponentStatus
    blocking: bool
    detail: str | None = None


class ReadinessResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    status: Literal["ok", "not_ready"]
    service: Literal["silo-api-python"]
    timestamp: str
    checks: dict[str, ComponentHealth]


@router.get("/health", response_model=LegacyHealthResponse)
def get_health() -> LegacyHealthResponse:
    return build_legacy_health_response()


@router.get("/health/live", response_model=HealthCheckResponse)
def get_live() -> HealthCheckResponse:
    return build_health_check_response(checks={"app": "ok"})


@router.get("/health/ready", response_model=ReadinessResponse)
async def get_ready() -> JSONResponse:
    response, status_code = await build_readiness_response()
    return JSONResponse(status_code=status_code, content=response.model_dump(mode="json"))


def build_legacy_health_response(clock: Clock = SYSTEM_CLOCK) -> LegacyHealthResponse:
    return LegacyHealthResponse(status="ok", app="silo-api", timestamp=_iso_utc(clock.now()))


def build_health_check_response(
    *,
    checks: dict[str, Literal["ok"]],
    clock: Clock = SYSTEM_CLOCK,
) -> HealthCheckResponse:
    return HealthCheckResponse(
        status="ok",
        service="silo-api-python",
        timestamp=_iso_utc(clock.now()),
        checks=checks,
    )


async def build_readiness_response(
    *,
    clock: Clock = SYSTEM_CLOCK,
    settings_loader: SettingsLoader | None = None,
    database_checker: DatabaseChecker | None = None,
) -> tuple[ReadinessResponse, int]:
    checks: dict[str, ComponentHealth] = {}
    effective_settings_loader = load_settings if settings_loader is None else settings_loader
    effective_database_checker = (
        check_database_ready if database_checker is None else database_checker
    )

    try:
        settings = effective_settings_loader()
    except SettingsLoadError:
        checks["config"] = ComponentHealth(
            status="error",
            blocking=True,
            detail="invalid configuration",
        )
        checks["database"] = ComponentHealth(
            status="skipped",
            blocking=True,
            detail="configuration unavailable",
        )
        checks["ollama"] = ComponentHealth(status="skipped", blocking=False)
        checks["kafka"] = ComponentHealth(status="skipped", blocking=False)
        return _readiness_response(status="not_ready", checks=checks, clock=clock), 503

    checks["config"] = ComponentHealth(status="ok", blocking=True)
    checks["database"] = await _database_component(settings, effective_database_checker)
    checks["ollama"] = ComponentHealth(status="ok", blocking=False, detail="configured")
    checks["kafka"] = _kafka_component(settings)

    readiness_status: Literal["ok", "not_ready"] = (
        "ok" if _blocking_checks_are_ok(checks) else "not_ready"
    )
    status_code = 200 if readiness_status == "ok" else 503
    return _readiness_response(status=readiness_status, checks=checks, clock=clock), status_code


async def _database_component(
    settings: Settings,
    database_checker: DatabaseChecker,
) -> ComponentHealth:
    database_url = settings.database_url.get_secret_value()
    if not database_url:
        return ComponentHealth(status="not_configured", blocking=True)

    try:
        await database_checker(database_url)
    except Exception:
        return ComponentHealth(status="error", blocking=True, detail="database check failed")

    return ComponentHealth(status="ok", blocking=True)


def _kafka_component(settings: Settings) -> ComponentHealth:
    if settings.kafka.rest_proxy_url:
        return ComponentHealth(status="ok", blocking=False, detail="configured")
    return ComponentHealth(status="not_configured", blocking=False)


def _blocking_checks_are_ok(checks: dict[str, ComponentHealth]) -> bool:
    return all(check.status == "ok" for check in checks.values() if check.blocking)


def _readiness_response(
    *,
    status: Literal["ok", "not_ready"],
    checks: dict[str, ComponentHealth],
    clock: Clock,
) -> ReadinessResponse:
    return ReadinessResponse(
        status=status,
        service="silo-api-python",
        timestamp=_iso_utc(clock.now()),
        checks=checks,
    )


def _iso_utc(value: datetime) -> str:
    return ensure_utc(value).isoformat().replace("+00:00", "Z")
