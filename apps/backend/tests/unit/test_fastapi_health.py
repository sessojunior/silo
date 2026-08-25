from __future__ import annotations

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from silo.api.main import create_app
from silo.api.routers import health as health_module
from silo.api.routers.health import (
    build_health_check_response,
    build_legacy_health_response,
    build_readiness_response,
)
from silo.clock import FrozenClock
from silo.config import SettingsLoadError, load_settings


def test_legacy_health_response_shape_matches_node_contract() -> None:
    clock = FrozenClock(datetime(2026, 7, 22, 15, 45, 30, tzinfo=UTC))

    response = build_legacy_health_response(clock)

    assert response.model_dump() == {
        "status": "ok",
        "app": "silo-api",
        "timestamp": "2026-07-22T15:45:30Z",
    }


def test_live_health_response_shape_is_operational() -> None:
    clock = FrozenClock(datetime(2026, 7, 22, 15, 45, 30, tzinfo=UTC))

    response = build_health_check_response(checks={"app": "ok"}, clock=clock)

    assert response.model_dump() == {
        "status": "ok",
        "service": "silo-api-python",
        "timestamp": "2026-07-22T15:45:30Z",
        "checks": {"app": "ok"},
    }


def test_fastapi_app_exposes_health_routes_and_lifespan(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = load_settings(
        {
            "SILO_ENV": "test",
            "DATABASE_URL": "postgresql://test-user:test-pass@localhost:5432/silo",
            "KAFKA_REST_PROXY_URL": "http://localhost:8082",
        }
    )

    async def fake_database_checker(_: str) -> None:
        return None

    monkeypatch.setattr(health_module, "load_settings", lambda: settings)
    monkeypatch.setattr(health_module, "check_database_ready", fake_database_checker)

    app = create_app()

    with TestClient(app) as client:
        legacy = client.get("/health")
        live = client.get("/health/live")
        ready = client.get("/health/ready")

        assert isinstance(client.app.state.started_at, str)

    assert legacy.status_code == 200
    assert legacy.json()["status"] == "ok"
    assert legacy.json()["app"] == "silo-api"
    assert str(legacy.json()["timestamp"]).endswith("Z")

    assert live.status_code == 200
    assert live.json()["status"] == "ok"
    assert live.json()["service"] == "silo-api-python"
    assert live.json()["checks"] == {"app": "ok"}

    assert ready.status_code == 200
    assert ready.json()["status"] == "ok"
    assert ready.json()["service"] == "silo-api-python"
    assert ready.json()["checks"]["config"]["status"] == "ok"
    assert ready.json()["checks"]["database"]["status"] == "ok"
    assert ready.json()["checks"]["vllm"]["status"] == "ok"
    assert ready.json()["checks"]["kafka"]["status"] == "ok"


async def test_ready_validates_config_database_and_nonblocking_dependencies() -> None:
    clock = FrozenClock(datetime(2026, 7, 22, 15, 45, 30, tzinfo=UTC))
    settings = load_settings(
        {
            "SILO_ENV": "test",
            "DATABASE_URL": "postgresql://test-user:test-pass@localhost:5432/silo",
            "KAFKA_REST_PROXY_URL": "http://localhost:8082",
        }
    )

    async def fake_database_checker(database_url: str) -> None:
        assert database_url == "postgresql://test-user:test-pass@localhost:5432/silo"

    response, status_code = await build_readiness_response(
        clock=clock,
        settings_loader=lambda: settings,
        database_checker=fake_database_checker,
    )

    assert status_code == 200
    assert response.model_dump() == {
        "status": "ok",
        "service": "silo-api-python",
        "timestamp": "2026-07-22T15:45:30Z",
        "checks": {
            "config": {"status": "ok", "blocking": True, "detail": None},
            "database": {"status": "ok", "blocking": True, "detail": None},
            "vllm": {"status": "ok", "blocking": False, "detail": "configured"},
            "kafka": {"status": "ok", "blocking": False, "detail": "configured"},
        },
    }


async def test_ready_returns_503_when_config_is_invalid_without_secret_values() -> None:
    clock = FrozenClock(datetime(2026, 7, 22, 15, 45, 30, tzinfo=UTC))

    async def fake_database_checker(_: str) -> None:
        raise AssertionError("database checker must not run")

    def invalid_settings_loader() -> None:
        raise SettingsLoadError("invalid secret value should not leak")

    response, status_code = await build_readiness_response(
        clock=clock,
        settings_loader=invalid_settings_loader,
        database_checker=fake_database_checker,
    )

    payload = response.model_dump()
    assert status_code == 503
    assert payload["status"] == "not_ready"
    assert payload["checks"]["config"] == {
        "status": "error",
        "blocking": True,
        "detail": "invalid configuration",
    }
    assert "secret" not in str(payload)


async def test_ready_returns_503_when_database_check_fails_without_dsn_values() -> None:
    clock = FrozenClock(datetime(2026, 7, 22, 15, 45, 30, tzinfo=UTC))
    settings = load_settings(
        {
            "SILO_ENV": "test",
            "DATABASE_URL": "postgresql://test-user:test-pass@localhost:5432/silo",
        }
    )

    async def failing_database_checker(_: str) -> None:
        raise RuntimeError("postgresql://test-user:test-pass@localhost:5432/silo")

    response, status_code = await build_readiness_response(
        clock=clock,
        settings_loader=lambda: settings,
        database_checker=failing_database_checker,
    )

    payload = response.model_dump()
    assert status_code == 503
    assert payload["status"] == "not_ready"
    assert payload["checks"]["database"] == {
        "status": "error",
        "blocking": True,
        "detail": "database check failed",
    }
    assert "test-pass" not in str(payload)
