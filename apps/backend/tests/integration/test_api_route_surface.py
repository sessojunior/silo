from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from silo.api.main import create_app


def test_fastapi_route_surface_matches_frontend_gateway_contract(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SILO_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", "postgresql://test-user:test-pass@localhost:5432/silo")

    app = create_app()
    route_paths = set(app.openapi()["paths"].keys())

    expected_paths = {
        "/api/auth/login/password",
        "/api/auth/get-session",
        "/api/auth/sign-out",
        "/api/check-admin",
        "/api/server-time",
        "/api/users",
        "/api/users/profile",
        "/api/users/preferences",
        "/api/groups",
        "/api/groups/permissions",
        "/api/groups/users",
        "/api/contacts",
        "/api/products",
        "/api/products/activities",
        "/api/products/activities/availability",
        "/api/products/availability-exceptions",
        "/api/products/problems",
        "/api/products/problems/categories",
        "/api/products/solutions",
        "/api/products/solutions/images",
        "/api/products/solutions/summary",
        "/api/products/manual",
        "/api/products/manual/images",
        "/api/products/images",
        "/api/products/{productId}/data-flow",
        "/api/projects",
        "/api/projects/{projectId}/activities",
        "/api/projects/{projectId}/activities/{activityId}/tasks",
        "/api/dashboard",
        "/api/dashboard/summary",
        "/api/dashboard/problems-causes",
        "/api/dashboard/problems-solutions",
        "/api/dashboard/projects",
        "/api/reports/availability",
        "/api/reports/availability/pdf",
        "/api/reports/problems",
        "/api/reports/problems/pdf",
        "/api/reports/projects",
        "/api/reports/projects/pdf",
        "/api/reports/executive",
        "/api/reports/executive/pdf",
        "/api/monitoring/products",
        "/api/monitoring/picture-pages",
        "/api/monitoring/picture-links",
        "/api/monitoring/radar-groups",
        "/api/monitoring/radars",
        "/api/ai-assistant/status",
        "/api/ai-assistant/messages",
        "/api/ai-assistant/messages/stream",
        "/api/chat/messages",
        "/api/chat/messages/count",
        "/api/chat/messages/read",
        "/api/chat/messages/{messageId}",
        "/api/chat/messages/{messageId}/read",
        "/api/chat/presence",
        "/api/chat/sidebar",
        "/api/chat/status",
        "/api/chat/unread-messages",
        "/api/upload/{kind}",
        "/api/upload/serve/{kind}/{filename}",
    }

    missing = sorted(expected_paths - route_paths)
    assert missing == [], f"Missing FastAPI routes: {missing}"

    with TestClient(app) as client:
        response = client.get("/api/server-time")

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert "data" in payload
