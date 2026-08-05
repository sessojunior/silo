from __future__ import annotations

import os
from collections.abc import AsyncIterator, Mapping
from contextlib import asynccontextmanager
from dataclasses import dataclass

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from silo.api.handlers import register_exception_handlers
from silo.api.middleware import (
    CsrfProtectionMiddleware,
    GlobalRateLimitMiddleware,
    JsonBodyLimitMiddleware,
    RequestContextMiddleware,
    TrustedProxyMiddleware,
)
from silo.api.rate_limit import GlobalRateLimiter
from silo.api.routers.ai_assistant import router as ai_assistant_router
from silo.api.routers.auth import router as auth_router
from silo.api.routers.chat import router as chat_router
from silo.api.routers.contacts import router as contacts_router
from silo.api.routers.dashboard import router as dashboard_router
from silo.api.routers.groups import router as groups_router
from silo.api.routers.health import router as health_router
from silo.api.routers.help import router as help_router
from silo.api.routers.incidents import router as incidents_router
from silo.api.routers.monitoring import router as monitoring_router
from silo.api.routers.product_flow import router as product_flow_router
from silo.api.routers.products import router as products_router
from silo.api.routers.products_extended import router as products_extended_router
from silo.api.routers.projects import router as projects_router
from silo.api.routers.reports import router as reports_router
from silo.api.routers.system import router as system_router
from silo.api.routers.tasks import router as tasks_router
from silo.api.routers.upload import router as upload_router
from silo.api.routers.users import router as users_router
from silo.clock import SYSTEM_CLOCK, ensure_utc
from silo.domain.model_run_status import validate_model_run_status_semantics_contract
from silo.config import Settings, SettingsLoadError, SiloEnvironment, load_settings
from silo.realtime.chat import ChatRealtimeHub

APP_TITLE = "SILO API"
APP_VERSION = "0.0.0"
DEFAULT_CORS_ORIGINS = ("http://localhost:3000", "http://localhost:3002")
DEFAULT_HTTP_BODY_LIMIT_BYTES = 102_400
DEFAULT_HTTP_RATE_LIMIT_WINDOW_MS = 60_000
DEFAULT_HTTP_RATE_LIMIT_MAX_REQUESTS = 200


@dataclass(frozen=True, slots=True)
class HttpRuntimeConfig:
    cors_origins: tuple[str, ...]
    csrf_trusted_origins: tuple[str, ...]
    trusted_proxy_cidrs: tuple[str, ...]
    http_body_limit_bytes: int
    http_rate_limit_window_ms: int
    http_rate_limit_max_requests: int


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.started_at = _iso_utc_now()
    app.state.chat_realtime_hub = ChatRealtimeHub()
    await app.state.chat_realtime_hub.start()
    yield
    await app.state.chat_realtime_hub.shutdown()


def create_app() -> FastAPI:
    production = _is_production_runtime(os.environ)
    validate_model_run_status_semantics_contract()
    http_config = _load_http_runtime_config()
    application = FastAPI(
        title=APP_TITLE,
        version=APP_VERSION,
        lifespan=lifespan,
        docs_url=None if production else "/docs",
        redoc_url=None if production else "/redoc",
        openapi_url=None if production else "/openapi.json",
    )
    register_exception_handlers(application)
    _install_http_compatibility_layer(application, http_config)
    application.include_router(health_router)
    application.include_router(auth_router)
    application.include_router(system_router)
    application.include_router(upload_router)
    application.include_router(product_flow_router)
    application.include_router(contacts_router)
    application.include_router(groups_router)
    application.include_router(users_router)
    application.include_router(help_router)
    application.include_router(products_router)
    application.include_router(incidents_router)
    application.include_router(projects_router)
    application.include_router(tasks_router)
    application.include_router(dashboard_router)
    application.include_router(reports_router)
    application.include_router(monitoring_router)
    application.include_router(products_extended_router)
    application.include_router(chat_router)
    application.include_router(ai_assistant_router)
    return application


def _iso_utc_now() -> str:
    return ensure_utc(SYSTEM_CLOCK.now()).isoformat().replace("+00:00", "Z")


def _install_http_compatibility_layer(app: FastAPI, config: HttpRuntimeConfig) -> None:
    app.add_middleware(
        GlobalRateLimitMiddleware,
        limiter=GlobalRateLimiter(
            max_requests=config.http_rate_limit_max_requests,
            window_seconds=max(1, config.http_rate_limit_window_ms // 1000),
        ),
    )
    app.add_middleware(JsonBodyLimitMiddleware, max_body_bytes=config.http_body_limit_bytes)
    app.add_middleware(CsrfProtectionMiddleware, trusted_origins=config.csrf_trusted_origins)
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(TrustedProxyMiddleware, trusted_proxy_cidrs=config.trusted_proxy_cidrs)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(config.cors_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


def _load_http_runtime_config() -> HttpRuntimeConfig:
    try:
        settings = load_settings()
    except SettingsLoadError:
        return HttpRuntimeConfig(
            cors_origins=DEFAULT_CORS_ORIGINS,
            csrf_trusted_origins=DEFAULT_CORS_ORIGINS,
            trusted_proxy_cidrs=(),
            http_body_limit_bytes=DEFAULT_HTTP_BODY_LIMIT_BYTES,
            http_rate_limit_window_ms=DEFAULT_HTTP_RATE_LIMIT_WINDOW_MS,
            http_rate_limit_max_requests=DEFAULT_HTTP_RATE_LIMIT_MAX_REQUESTS,
        )

    return HttpRuntimeConfig(
        cors_origins=settings.cors_origins,
        csrf_trusted_origins=_csrf_trusted_origins(settings),
        trusted_proxy_cidrs=settings.trusted_proxy_cidrs,
        http_body_limit_bytes=settings.http_body_limit_bytes,
        http_rate_limit_window_ms=settings.http_rate_limit_window_ms,
        http_rate_limit_max_requests=settings.http_rate_limit_max_requests,
    )


def _is_production_runtime(environ: Mapping[str, str]) -> bool:
    runtime_env = environ.get("SILO_ENV") or environ.get("NODE_ENV") or SiloEnvironment.DEVELOPMENT
    return str(runtime_env).lower() == SiloEnvironment.PRODUCTION.value


def _csrf_trusted_origins(settings: Settings) -> tuple[str, ...]:
    origins = set(settings.cors_origins)
    origins.add(settings.app_url_dev)
    if settings.app_url_prod:
        origins.add(settings.app_url_prod)
    return tuple(sorted(origin for origin in origins if origin))


app = create_app()
