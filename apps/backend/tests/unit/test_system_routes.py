from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient

from silo.api.dependencies import CurrentUser, UserGroupInfo, get_current_user, get_db
from silo.api.main import create_app
from silo.api.routers import system as system_module
from silo.api.routers.system import warmup_ollama_model
from silo.clock import FrozenClock
from silo.config import load_settings


class _WarmupSuccessClient:
    async def warmup(self, *, base_url: str, model: str, timeout_seconds: float) -> None:
        assert base_url == "http://localhost:11434"
        assert model == "qwen2.5:1.5b-instruct-q4_K_M"
        assert timeout_seconds == 60.0


class _WarmupFailureClient:
    async def warmup(self, *, base_url: str, model: str, timeout_seconds: float) -> None:
        raise RuntimeError("ollama unavailable")


def test_server_time_matches_legacy_contract(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        system_module,
        "SYSTEM_CLOCK",
        FrozenClock(datetime(2026, 7, 21, 15, 0, 0, tzinfo=UTC)),
    )
    app = create_app()

    with TestClient(app) as client:
        response = client.get("/api/server-time")

    assert response.status_code == 200
    assert response.json() == {
        "success": True,
        "data": {"time": "2026-07-21T15:00:00.000Z"},
        "message": "Hora do servidor",
    }


def test_check_admin_returns_true_for_implicit_admin_role(monkeypatch: pytest.MonkeyPatch) -> None:
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id="fixture-user-admin")
    app.dependency_overrides[get_db] = _db_override
    monkeypatch.setattr(
        system_module,
        "get_user_groups",
        lambda _db, _user_id: (UserGroupInfo(id="g1", name="Admins", role="admin"),),
    )

    with TestClient(app) as client:
        response = client.get("/api/check-admin")

    assert response.status_code == 200
    assert response.json() == {"success": True, "data": {"isAdmin": True}}


def test_check_admin_returns_false_for_authenticated_non_admin(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id="fixture-user-partial")
    app.dependency_overrides[get_db] = _db_override
    monkeypatch.setattr(
        system_module,
        "get_user_groups",
        lambda _db, _user_id: (UserGroupInfo(id="g1", name="Partial", role="user"),),
    )

    with TestClient(app) as client:
        response = client.get("/api/check-admin")

    assert response.status_code == 200
    assert response.json() == {"success": True, "data": {"isAdmin": False}}


def test_check_admin_unauthenticated_matches_legacy_contract() -> None:
    app = create_app()
    app.dependency_overrides[get_db] = _db_override

    with TestClient(app) as client:
        response = client.get("/api/check-admin")

    assert response.status_code == 401
    assert response.json() == {"success": False, "error": "Usuário não autenticado."}


async def test_warmup_success_matches_legacy_contract() -> None:
    settings = load_settings(
        {
            "SILO_ENV": "test",
            "DATABASE_URL": "postgresql://test-user:test-pass@localhost:5432/silo",
            "OLLAMA_URL": "http://localhost:11434",
            "OLLAMA_MODEL": "qwen2.5:1.5b-instruct-q4_K_M",
        }
    )
    clock = FrozenClock(datetime(2026, 7, 21, 15, 0, 0, tzinfo=UTC))

    payload, status_code = await warmup_ollama_model(
        settings=settings,
        clock=clock,
        client=_WarmupSuccessClient(),
    )

    assert status_code == 200
    assert payload["success"] is True
    data = payload["data"]
    assert isinstance(data, dict)
    assert isinstance(data["latencyMs"], int)
    assert data == {
        "model": "qwen2.5:1.5b-instruct-q4_K_M",
        "latencyMs": data["latencyMs"],
        "warmedAt": "2026-07-21T15:00:00.000Z",
    }


async def test_warmup_failure_matches_legacy_contract() -> None:
    settings = load_settings(
        {
            "SILO_ENV": "test",
            "DATABASE_URL": "postgresql://test-user:test-pass@localhost:5432/silo",
            "OLLAMA_URL": "http://localhost:11434",
        }
    )

    payload, status_code = await warmup_ollama_model(
        settings=settings,
        client=_WarmupFailureClient(),
    )

    assert status_code == 500
    assert payload == {"success": False, "error": "Falha ao carregar modelo de IA."}


def _db_override() -> Any:
    return object()
