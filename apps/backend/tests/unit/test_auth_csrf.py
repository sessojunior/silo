from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from silo.api.middleware import CsrfProtectionMiddleware


def test_csrf_blocks_untrusted_origin_when_session_cookie_is_present() -> None:
    app = FastAPI()
    app.add_middleware(
        CsrfProtectionMiddleware,
        trusted_origins=("http://localhost:3000",),
    )

    @app.post("/api/mutate")
    def mutate() -> dict[str, bool]:
        return {"success": True}

    response = TestClient(app).post(
        "/api/mutate",
        headers={"Origin": "https://evil.example"},
        cookies={"silo_session": "token"},
    )

    assert response.status_code == 403
    assert response.json() == {"success": False, "error": "Origem não autorizada."}


def test_csrf_allows_trusted_origin_and_non_session_requests() -> None:
    app = FastAPI()
    app.add_middleware(
        CsrfProtectionMiddleware,
        trusted_origins=("http://localhost:3000",),
    )

    @app.post("/api/mutate")
    def mutate() -> dict[str, bool]:
        return {"success": True}

    client = TestClient(app)
    trusted = client.post(
        "/api/mutate",
        headers={"Origin": "http://localhost:3000"},
        cookies={"better-auth.session_token": "token"},
    )
    no_cookie = client.post("/api/mutate", headers={"Origin": "https://evil.example"})

    assert trusted.status_code == 200
    assert no_cookie.status_code == 200
