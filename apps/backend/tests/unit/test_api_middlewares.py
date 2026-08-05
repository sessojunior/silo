from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

from silo.api.middleware import (
    GlobalRateLimitMiddleware,
    JsonBodyLimitMiddleware,
    RequestContextMiddleware,
    TrustedProxyMiddleware,
)
from silo.api.rate_limit import GlobalRateLimiter


def test_request_context_middleware_preserves_request_id_and_adds_duration() -> None:
    app = FastAPI()
    app.add_middleware(RequestContextMiddleware)

    @app.get("/api/ping")
    def ping(request: Request) -> dict[str, str]:
        return {"requestId": request.state.request_id}

    response = TestClient(app).get("/api/ping", headers={"X-Request-Id": "trace-123"})

    assert response.status_code == 200
    assert response.headers["x-request-id"] == "trace-123"
    assert float(response.headers["x-response-time-ms"]) >= 0
    assert response.json() == {"requestId": "trace-123"}


def test_json_body_limit_middleware_rejects_oversized_json_payload() -> None:
    app = FastAPI()
    app.add_middleware(JsonBodyLimitMiddleware, max_body_bytes=10)

    @app.post("/api/echo")
    async def echo(request: Request) -> dict[str, object]:
        return {"body": await request.json()}

    response = TestClient(app).post(
        "/api/echo",
        content='{"name":"payload-too-large"}',
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 413
    assert response.json() == {"success": False, "error": "Requisição muito grande."}


def test_json_body_limit_middleware_rejects_deeply_nested_json_payload() -> None:
    app = FastAPI()
    app.add_middleware(JsonBodyLimitMiddleware, max_body_bytes=10_000, max_json_depth=4)

    @app.post("/api/echo")
    async def echo(request: Request) -> dict[str, object]:
        return {"body": await request.json()}

    response = TestClient(app).post(
        "/api/echo",
        json={"level1": {"level2": {"level3": {"level4": {"level5": True}}}}},
    )

    assert response.status_code == 413
    assert response.json() == {"success": False, "error": "JSON muito profundo."}


def test_trusted_proxy_middleware_uses_forwarded_ip_only_from_trusted_proxy() -> None:
    app = FastAPI()
    app.add_middleware(TrustedProxyMiddleware, trusted_proxy_cidrs=("127.0.0.1/32",))

    @app.get("/api/ip")
    def ip(request: Request) -> dict[str, str]:
        return {"clientIp": request.state.client_ip}

    trusted_client = TestClient(app, client=("127.0.0.1", 12345))
    untrusted_client = TestClient(app, client=("10.10.10.10", 12345))

    assert trusted_client.get("/api/ip", headers={"X-Forwarded-For": "203.0.113.9"}).json() == {
        "clientIp": "203.0.113.9"
    }
    assert untrusted_client.get("/api/ip", headers={"X-Forwarded-For": "203.0.113.9"}).json() == {
        "clientIp": "10.10.10.10"
    }


def test_cors_middleware_matches_node_credentials_contract() -> None:
    app = FastAPI()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/ping")
    def ping() -> dict[str, bool]:
        return {"success": True}

    response = TestClient(app).options(
        "/api/ping",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert response.headers["access-control-allow-credentials"] == "true"


def test_global_rate_limit_middleware_limits_api_prefix_and_skips_auth_prefix() -> None:
    app = FastAPI()
    app.add_middleware(
        GlobalRateLimitMiddleware,
        limiter=GlobalRateLimiter(max_requests=2, window_seconds=60),
    )

    @app.get("/api/ping")
    def ping() -> dict[str, bool]:
        return {"success": True}

    @app.get("/api/auth/ping")
    def auth_ping() -> dict[str, bool]:
        return {"success": True}

    client = TestClient(app)

    assert client.get("/api/ping").status_code == 200
    second_response = client.get("/api/ping")
    assert second_response.status_code == 200
    assert second_response.headers["ratelimit-limit"] == "2"
    assert second_response.headers["ratelimit-remaining"] == "0"

    limited_response = client.get("/api/ping")
    assert limited_response.status_code == 429
    assert limited_response.headers["retry-after"] == "60"
    assert limited_response.json() == {
        "success": False,
        "error": "Muitas requisições. Tente novamente em breve.",
    }

    assert client.get("/api/auth/ping").status_code == 200


def test_global_rate_limit_can_key_by_authenticated_user_identity() -> None:
    app = FastAPI()
    app.add_middleware(
        GlobalRateLimitMiddleware,
        limiter=GlobalRateLimiter(max_requests=1, window_seconds=60),
        identity_resolver=lambda request: request.headers.get("X-Test-User"),
    )

    @app.get("/api/ping")
    def ping() -> dict[str, bool]:
        return {"success": True}

    client = TestClient(app)

    assert client.get("/api/ping", headers={"X-Test-User": "user-a"}).status_code == 200
    assert client.get("/api/ping", headers={"X-Test-User": "user-a"}).status_code == 429
    assert client.get("/api/ping", headers={"X-Test-User": "user-b"}).status_code == 200
