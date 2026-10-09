from __future__ import annotations

from fastapi.testclient import TestClient

import silo.api.dependencies as dependencies_module
from silo.ai.observability_contract import RUNTIME_METRICS, record_runtime_metric
from silo.api.dependencies import CurrentUser, UserGroupInfo, get_current_user, get_db
from silo.api.main import create_app


def _configure_user(app, user: CurrentUser) -> None:
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: object()


def test_ai_metrics_endpoint_is_admin_only_and_redacts_sensitive_labels(monkeypatch) -> None:
    app = create_app()
    _configure_user(app, CurrentUser(id="admin-1", email="admin@example.test"))
    monkeypatch.setattr(
        dependencies_module,
        "get_user_groups",
        lambda _db, _user_id: (UserGroupInfo(id="g-admin", name="Admin", role="admin"),),
    )
    RUNTIME_METRICS.reset()
    record_runtime_metric(
        "ai_graph_runs_total",
        {
            "scope": "reports",
            "question": "conteudo secreto",
            "thread_id": "thread-secret",
        },
    )

    with TestClient(app) as client:
        response = client.get("/api/internal/ai/metrics")
        prometheus = client.get("/api/internal/ai/metrics/prometheus")

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["counters"]
    serialized = response.text + prometheus.text
    assert "question" not in serialized
    assert "thread_id" not in serialized
    assert "dataset_id" not in serialized
    assert prometheus.status_code == 200
    assert "ai_graph_runs_total" in prometheus.text


def test_ai_metrics_endpoint_rejects_authenticated_non_admin(monkeypatch) -> None:
    app = create_app()
    _configure_user(app, CurrentUser(id="user-1", email="user@example.test"))
    monkeypatch.setattr(
        dependencies_module,
        "get_user_groups",
        lambda _db, _user_id: (UserGroupInfo(id="g-user", name="User", role="user"),),
    )

    with TestClient(app) as client:
        response = client.get("/api/internal/ai/metrics")

    assert response.status_code == 403


def test_ai_metrics_endpoint_rejects_unauthenticated_request() -> None:
    app = create_app()
    app.dependency_overrides[get_db] = lambda: object()

    with TestClient(app) as client:
        response = client.get("/api/internal/ai/metrics")

    assert response.status_code == 401
