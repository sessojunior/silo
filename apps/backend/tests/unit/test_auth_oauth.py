from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace

import authlib.jose as jose
import pytest
from fastapi import FastAPI, Request, Response
from fastapi.testclient import TestClient
from sqlalchemy import Boolean, Column, DateTime, MetaData, String, Table, create_engine, select

from silo.auth import oauth as oauth_module
from silo.auth.oauth import (
    GoogleIdentity,
    GoogleState,
    _optional_token_str,
    _safe_from_page,
    _state_identifier,
    _ensure_allowed_google_domain,
    app_redirect_url,
)
from silo.config import SiloEnvironment, load_settings


def test_google_oauth_redirect_url_stays_on_same_origin_with_base_path() -> None:
    settings = load_settings(
        {
            "SILO_ENV": SiloEnvironment.PRODUCTION.value,
            "DATABASE_URL_PROD": "postgresql://prod-user:prod-pass@db:5432/silo",
            "APP_URL_PROD": "https://fortuna.cptec.inpe.br",
            "SESSION_SECRET": "session-secret",
            "SMTP_HOST": "smtp.gmail.com",
            "SMTP_USERNAME": "sender@example.test",
            "SMTP_PASSWORD": "smtp-secret",
            "GOOGLE_CLIENT_ID": "google-client-id",
            "GOOGLE_CLIENT_SECRET": "google-client-secret",
            "NEXT_PUBLIC_BASE_PATH": "/silo/",
        }
    )

    redirect_url = app_redirect_url(settings, "https://evil.example/redirect-me")

    assert redirect_url == "https://fortuna.cptec.inpe.br/silo/https://evil.example/redirect-me"


def test_google_oauth_from_page_is_restricted_to_allowlisted_internal_routes() -> None:
    assert _safe_from_page("login") == "login"
    assert _safe_from_page("register") == "register"
    assert _safe_from_page("https://evil.example") == "login"
    assert _safe_from_page("/admin/dashboard") == "login"


def test_google_credentials_helpers_reflect_configuration() -> None:
    configured = load_settings(
        {
            "DATABASE_URL": "postgresql://prod-user:prod-pass@db:5432/silo",
            "APP_URL_DEV": "http://localhost:3000",
            "GOOGLE_CLIENT_ID": "google-client-id",
            "GOOGLE_CLIENT_SECRET": "google-client-secret",
            "UPLOADS_DIR": "C:/tmp/silo-uploads",
        }
    )
    missing = load_settings(
        {
            "DATABASE_URL": "postgresql://prod-user:prod-pass@db:5432/silo",
            "APP_URL_DEV": "http://localhost:3000",
            "UPLOADS_DIR": "C:/tmp/silo-uploads",
        }
    )

    assert oauth_module.google_credentials_configured(configured) is True
    assert oauth_module.google_credentials_configured(missing) is False
    assert oauth_module.should_use_legacy_contract_google_response(configured) is False
    assert (
        oauth_module.should_use_legacy_contract_google_response(
            load_settings(
                {
                    "DATABASE_URL": "postgresql://prod-user:prod-pass@db:5432/silo",
                    "APP_URL_DEV": "http://localhost:3000",
                    "GOOGLE_CLIENT_ID": "contract-google-client",
                    "GOOGLE_CLIENT_SECRET": "google-client-secret",
                    "UPLOADS_DIR": "C:/tmp/silo-uploads",
                }
            )
        )
        is True
    )


def test_google_login_start_and_state_consumption_round_trip(
    tmp_path,
    monkeypatch,
) -> None:
    engine = create_engine(
        f"sqlite+pysqlite:///{tmp_path / 'oauth.sqlite3'}",
        future=True,
        connect_args={"check_same_thread": False},
    )
    metadata = MetaData()
    verification_table = Table(
        "verification",
        metadata,
        Column("id", String, primary_key=True),
        Column("identifier", String, nullable=False),
        Column("value", String, nullable=False),
        Column("expires_at", DateTime, nullable=False),
        Column("created_at", DateTime, nullable=False),
        Column("updated_at", DateTime, nullable=False),
    )
    metadata.create_all(engine)
    monkeypatch.setattr(oauth_module, "legacy_tables", {"verification": verification_table})

    settings = load_settings(
        {
            "DATABASE_URL": "postgresql://prod-user:prod-pass@db:5432/silo",
            "APP_URL_DEV": "http://localhost:3000",
            "GOOGLE_CLIENT_ID": "google-client-id",
            "GOOGLE_CLIENT_SECRET": "google-client-secret",
            "UPLOADS_DIR": "C:/tmp/silo-uploads",
        }
    )

    app = FastAPI()

    @app.get("/auth/google/callback", name="google_callback")
    def google_callback() -> dict[str, str]:
        return {"ok": "yes"}

    with engine.connect() as connection:

        @app.get("/start")
        def start(request: Request, response: Response) -> dict[str, str]:
            result = oauth_module.build_google_login_start(
                connection,
                settings=settings,
                request=request,
                response=response,
                from_page="register",
            )
            return {
                "authorization_url": result.authorization_url,
                "state": result.state,
                "nonce": result.nonce,
            }

        with TestClient(app) as client:
            response = client.get("/start")

        payload = response.json()
        assert response.status_code == 200
        assert response.headers["set-cookie"].startswith(f"{oauth_module.OAUTH_STATE_COOKIE_NAME}=")
        assert payload["authorization_url"].startswith(oauth_module.GOOGLE_AUTHORIZATION_ENDPOINT)
        assert "client_id=google-client-id" in payload["authorization_url"]
        assert "nonce=" in payload["authorization_url"]

        row = (
            connection.execute(select(verification_table.c.identifier, verification_table.c.value))
            .mappings()
            .one()
        )
        assert row["identifier"] == f"silo:oauth:google:state:{payload['state']}"
        assert row["value"] == f"{payload['nonce']}:register"

        state = oauth_module.consume_google_state(connection, state=payload["state"])

        assert state is not None
        assert state.nonce == payload["nonce"]
        assert state.from_page == "register"
        remaining_rows = connection.execute(select(verification_table.c.id)).all()
        assert remaining_rows == []


def test_google_login_start_uses_login_fallback_for_untrusted_from_page(
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = create_engine(
        f"sqlite+pysqlite:///{tmp_path / 'oauth-fallback.sqlite3'}",
        future=True,
        connect_args={"check_same_thread": False},
    )
    metadata = MetaData()
    verification_table = Table(
        "verification",
        metadata,
        Column("id", String, primary_key=True),
        Column("identifier", String, nullable=False),
        Column("value", String, nullable=False),
        Column("expires_at", DateTime, nullable=False),
        Column("created_at", DateTime, nullable=False),
        Column("updated_at", DateTime, nullable=False),
    )
    metadata.create_all(engine)
    monkeypatch.setattr(oauth_module, "legacy_tables", {"verification": verification_table})

    settings = load_settings(
        {
            "DATABASE_URL": "postgresql://prod-user:prod-pass@db:5432/silo",
            "APP_URL_DEV": "http://localhost:3000",
            "GOOGLE_CLIENT_ID": "google-client-id",
            "GOOGLE_CLIENT_SECRET": "google-client-secret",
            "UPLOADS_DIR": "C:/tmp/silo-uploads",
        }
    )
    response = Response()
    request = SimpleNamespace(
        url_for=lambda _name: "http://localhost:3000/api/auth/callback/google"
    )

    with engine.connect() as connection:
        result = oauth_module.build_google_login_start(
            connection,
            settings=settings,
            request=request,
            response=response,
            from_page="/admin/dashboard",
        )
        row = connection.execute(select(verification_table.c.value)).scalar_one()

    assert result.authorization_url.startswith(oauth_module.GOOGLE_AUTHORIZATION_ENDPOINT)
    assert row.endswith(":login")


def test_google_oauth_helpers_cover_state_and_domain_edges() -> None:
    dev_settings = load_settings(
        {
            "DATABASE_URL": "postgresql://prod-user:prod-pass@db:5432/silo",
            "APP_URL_DEV": "http://localhost:3000",
            "GOOGLE_CLIENT_ID": "google-client-id",
            "GOOGLE_CLIENT_SECRET": "google-client-secret",
            "UPLOADS_DIR": "C:/tmp/silo-uploads",
        }
    )
    restricted_settings = load_settings(
        {
            "DATABASE_URL": "postgresql://prod-user:prod-pass@db:5432/silo",
            "APP_URL_DEV": "http://localhost:3000",
            "GOOGLE_CLIENT_ID": "google-client-id",
            "GOOGLE_CLIENT_SECRET": "google-client-secret",
            "UPLOADS_DIR": "C:/tmp/silo-uploads",
            "ALLOWED_EMAIL_DOMAINS": "example.test",
        }
    )

    assert app_redirect_url(dev_settings, "/dashboard") == "http://localhost:3000/silo/dashboard"
    assert _state_identifier("state-1") == "silo:oauth:google:state:state-1"
    assert _optional_token_str(None) is None
    assert _optional_token_str("") is None
    assert _optional_token_str("token") == "token"
    assert _safe_from_page("launch") == "login"
    _ensure_allowed_google_domain(dev_settings, "user@any.test")

    with pytest.raises(ValueError):
        _ensure_allowed_google_domain(restricted_settings, "user@evil.test")

    with pytest.raises(ValueError):
        oauth_module.validate_google_identity(
            settings=restricted_settings,
            token={},
            expected_nonce="nonce-1",
        )


def _build_google_tables(metadata: MetaData) -> dict[str, Table]:
    user_table = Table(
        "user",
        metadata,
        Column("id", String, primary_key=True),
        Column("name", String, nullable=False),
        Column("email", String, nullable=False),
        Column("email_verified", Boolean, nullable=False),
        Column("image", String, nullable=True),
        Column("created_at", DateTime, nullable=False),
        Column("updated_at", DateTime, nullable=False),
        Column("is_active", Boolean, nullable=False),
        Column("last_login", DateTime, nullable=True),
    )
    account_table = Table(
        "account",
        metadata,
        Column("id", String, primary_key=True),
        Column("account_id", String, nullable=False),
        Column("provider_id", String, nullable=False),
        Column("user_id", String, nullable=False),
        Column("access_token", String, nullable=True),
        Column("refresh_token", String, nullable=True),
        Column("id_token", String, nullable=True),
        Column("access_token_expires_at", DateTime, nullable=True),
        Column("refresh_token_expires_at", DateTime, nullable=True),
        Column("scope", String, nullable=True),
        Column("password", String, nullable=True),
        Column("created_at", DateTime, nullable=False),
        Column("updated_at", DateTime, nullable=False),
    )
    group_table = Table(
        "group",
        metadata,
        Column("id", String, primary_key=True),
        Column("name", String, nullable=False),
        Column("role", String, nullable=False),
        Column("is_default", Boolean, nullable=False),
        Column("created_at", DateTime, nullable=False),
        Column("updated_at", DateTime, nullable=False),
    )
    user_group_table = Table(
        "user_group",
        metadata,
        Column("id", String, primary_key=True),
        Column("user_id", String, nullable=False),
        Column("group_id", String, nullable=False),
        Column("joined_at", DateTime, nullable=False),
        Column("created_at", DateTime, nullable=False),
    )
    session_table = Table(
        "session",
        metadata,
        Column("id", String, primary_key=True),
        Column("expires_at", DateTime, nullable=False),
        Column("token", String, nullable=False),
        Column("created_at", DateTime, nullable=False),
        Column("updated_at", DateTime, nullable=False),
        Column("ip_address", String, nullable=True),
        Column("user_agent", String, nullable=True),
        Column("user_id", String, nullable=False),
    )
    return {
        "user": user_table,
        "account": account_table,
        "group": group_table,
        "user_group": user_group_table,
        "session": session_table,
    }


def test_google_oauth_complete_callback_covers_new_and_existing_user_paths(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
) -> None:
    engine = create_engine(f"sqlite+pysqlite:///{tmp_path / 'oauth-callback.sqlite3'}", future=True)
    metadata = MetaData()
    tables = _build_google_tables(metadata)
    metadata.create_all(engine)
    monkeypatch.setattr(oauth_module, "legacy_tables", tables)

    settings = load_settings(
        {
            "DATABASE_URL": "postgresql://prod-user:prod-pass@db:5432/silo",
            "APP_URL_DEV": "http://localhost:3000",
            "GOOGLE_CLIENT_ID": "google-client-id",
            "GOOGLE_CLIENT_SECRET": "google-client-secret",
            "UPLOADS_DIR": "C:/tmp/silo-uploads",
            "ALLOWED_EMAIL_DOMAINS": "example.test",
        }
    )

    identity = GoogleIdentity(
        sub="google-sub-1",
        email="user@example.test",
        email_verified=True,
        name="User One",
        picture=None,
    )
    state = GoogleState(nonce="nonce-1", from_page="register")

    token_calls: list[str] = []
    monkeypatch.setattr(
        oauth_module,
        "exchange_google_code_for_token",
        lambda **kwargs: token_calls.append(kwargs["code"]) or {
            "access_token": "access-1" if kwargs["code"] == "code-1" else "access-2",
            "refresh_token": "refresh-1" if kwargs["code"] == "code-1" else "refresh-2",
            "id_token": "id-1" if kwargs["code"] == "code-1" else "id-2",
            "scope": "openid email profile",
        },
    )
    monkeypatch.setattr(oauth_module, "validate_google_identity", lambda **kwargs: identity)

    with engine.begin() as connection:
        connection.execute(
            tables["group"].insert().values(
                id="group-default",
                name="Default",
                role="user",
                is_default=True,
                created_at=datetime(2026, 7, 22, 12, 0),
                updated_at=datetime(2026, 7, 22, 12, 0),
            )
        )

    with engine.connect() as connection:
        first_session = oauth_module.complete_google_callback(
            connection,
            settings=settings,
            code="code-1",
            state=state,
            callback_url="http://localhost:3000/api/auth/callback/google",
            ip_address="127.0.0.1",
            user_agent="pytest",
        )
        second_session = oauth_module.complete_google_callback(
            connection,
            settings=settings,
            code="code-2",
            state=state,
            callback_url="http://localhost:3000/api/auth/callback/google",
            ip_address="127.0.0.1",
            user_agent="pytest",
        )

        user_row = connection.execute(select(tables["user"])).mappings().one()
        account_row = connection.execute(select(tables["account"])).mappings().one()
        session_rows = connection.execute(select(tables["session"])).mappings().all()
        user_group_row = connection.execute(select(tables["user_group"])).mappings().one()

    assert token_calls == ["code-1", "code-2"]
    assert first_session.user_email == "user@example.test"
    assert second_session.user_id == first_session.user_id
    assert user_row["email"] == "user@example.test"
    assert account_row["account_id"] == "google-sub-1"
    assert account_row["access_token"] == "access-2"
    assert user_group_row["group_id"] == "group-default"
    assert len(session_rows) == 2


def test_google_oauth_validate_identity_and_token_exchange_branches(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = load_settings(
        {
            "DATABASE_URL": "postgresql://prod-user:prod-pass@db:5432/silo",
            "APP_URL_DEV": "http://localhost:3000",
            "GOOGLE_CLIENT_ID": "google-client-id",
            "GOOGLE_CLIENT_SECRET": "google-client-secret",
            "UPLOADS_DIR": "C:/tmp/silo-uploads",
            "ALLOWED_EMAIL_DOMAINS": "example.test",
        }
    )

    class _FakeClaims(dict):
        def validate(self, leeway: int) -> None:
            self["validatedLeeway"] = leeway

    jwks_payload = {"keys": [{"kty": "oct", "k": "AA"}]}
    captured: dict[str, object] = {}

    monkeypatch.setattr(
        oauth_module.httpx,
        "get",
        lambda url, timeout: SimpleNamespace(json=lambda: jwks_payload),
    )
    monkeypatch.setattr(jose.JsonWebKey, "import_key_set", lambda jwks: jwks)

    def _fake_decode(id_token, key_set, claims_cls, claims_options):
        captured["id_token"] = id_token
        captured["key_set"] = key_set
        captured["claims_cls"] = claims_cls
        captured["claims_options"] = claims_options
        claims = _FakeClaims(
            {
                "nonce": "nonce-1",
                "sub": "google-sub-1",
                "email": "USER@Example.Test",
                "email_verified": True,
                "name": "User One",
                "picture": "https://example.test/avatar.png",
            }
        )
        claims.validate(60)
        return claims

    monkeypatch.setattr(jose.jwt, "decode", _fake_decode)

    identity = oauth_module.validate_google_identity(
        settings=settings,
        token={"id_token": "id-token-1"},
        expected_nonce="nonce-1",
    )
    assert identity == GoogleIdentity(
        sub="google-sub-1",
        email="user@example.test",
        email_verified=True,
        name="User One",
        picture="https://example.test/avatar.png",
    )
    assert captured["id_token"] == "id-token-1"
    assert captured["claims_cls"] is oauth_module.CodeIDToken
    assert captured["claims_options"]["aud"]["values"] == ["google-client-id"]

    with pytest.raises(ValueError, match="nonce mismatch"):
        oauth_module.validate_google_identity(
            settings=settings,
            token={"id_token": "id-token-1"},
            expected_nonce="different-nonce",
        )

    class _FakeOAuth2Client:
        def __init__(self, client_id, client_secret, redirect_uri, scope) -> None:
            captured["oauth_client"] = {
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "scope": scope,
            }

        def fetch_token(self, endpoint, grant_type, code):
            captured["token_endpoint"] = endpoint
            captured["grant_type"] = grant_type
            captured["code"] = code
            return {
                "access_token": "access-token",
                "refresh_token": "refresh-token",
                "id_token": "id-token",
                "scope": "openid email profile",
            }

    monkeypatch.setattr(oauth_module, "OAuth2Client", _FakeOAuth2Client)
    token = oauth_module.exchange_google_code_for_token(
        settings=settings,
        code="code-1",
        callback_url="http://localhost:3000/api/auth/callback/google",
    )

    assert token["access_token"] == "access-token"
    assert captured["oauth_client"]["client_id"] == "google-client-id"
    assert captured["grant_type"] == "authorization_code"
    assert captured["code"] == "code-1"
