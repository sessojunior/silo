from __future__ import annotations

from datetime import UTC, datetime

import pytest
from fastapi import Request, Response
from sqlalchemy import Boolean, Column, DateTime, MetaData, String, Table, create_engine, insert, select
from starlette.datastructures import Headers

import silo.auth.sessions as sessions_module
from silo.auth.sessions import (
    BETTER_AUTH_COOKIE_NAMES,
    SESSION_COOKIE_NAME,
    create_session,
    clear_auth_cookies,
    clear_session_token,
    clean_expired_sessions,
    extract_session_token,
    legacy_local_now,
    request_ip,
    request_user_agent,
    set_session_cookie,
    get_session_by_token,
    _commit_if_possible,
    _datetime,
)
from silo.clock import FrozenClock
from silo.config import SiloEnvironment, load_settings


def test_legacy_local_now_uses_operational_timezone() -> None:
    clock = FrozenClock(datetime(2026, 7, 22, 15, 0, 0, tzinfo=UTC))

    assert legacy_local_now(clock) == datetime(2026, 7, 22, 12, 0, 0)


def test_session_token_prefers_python_cookie_then_better_auth_cookie() -> None:
    request = _request_with_cookie("better-auth.session_token=legacy; silo_session=python")
    assert extract_session_token(request) == "python"

    for cookie_name in BETTER_AUTH_COOKIE_NAMES:
        request = _request_with_cookie(f"{cookie_name}=legacy")
        assert extract_session_token(request) == "legacy"


def test_session_cookie_attrs_are_dual_runtime_safe() -> None:
    settings = load_settings(
        {
            "SILO_ENV": SiloEnvironment.DEVELOPMENT.value,
            "DATABASE_URL": "postgresql://test-user:test-pass@localhost:5432/silo",
        }
    )
    response = _response()

    set_session_cookie(response, "token", settings)

    assert response.headers.get("set-cookie") == (
        f"{SESSION_COOKIE_NAME}=token; Max-Age={365 * 24 * 60 * 60}; Path=/; HttpOnly; SameSite=Lax"
    )


def test_clear_auth_cookies_expires_python_and_better_auth_cookies() -> None:
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
        }
    )
    response = _response()

    clear_auth_cookies(response, settings)
    set_cookie = "\n".join(
        value.decode("latin-1")
        for name, value in response.raw_headers
        if name.lower() == b"set-cookie"
    )

    assert set_cookie is not None
    assert f"{SESSION_COOKIE_NAME}=" in set_cookie
    assert "better-auth.session_token=" in set_cookie
    assert "Max-Age=0" in set_cookie
    assert "Secure" in set_cookie


def test_session_lookup_refreshes_sliding_window_and_commits(monkeypatch: pytest.MonkeyPatch) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    tables = _build_session_tables(engine)
    monkeypatch.setattr(sessions_module, "legacy_tables", tables)
    clock = FrozenClock(datetime(2026, 7, 22, 12, 0, 0, tzinfo=UTC))
    expected_now = legacy_local_now(clock)

    with engine.begin() as connection:
        connection.execute(
            insert(tables["user"]),
            [
                {
                    "id": "user-1",
                    "name": "User One",
                    "email": "user@example.test",
                    "email_verified": True,
                    "image": None,
                    "created_at": datetime(2026, 7, 21, 12, 0, 0),
                    "updated_at": datetime(2026, 7, 21, 12, 0, 0),
                    "is_active": True,
                }
            ],
        )
        connection.execute(
            insert(tables["session"]),
            [
                {
                    "id": "session-1",
                    "expires_at": datetime(2026, 7, 23, 12, 0, 0),
                    "token": "session-token",
                    "created_at": datetime(2026, 7, 20, 12, 0, 0),
                    "updated_at": datetime(2026, 7, 20, 12, 0, 0),
                    "ip_address": "127.0.0.1",
                    "user_agent": "pytest",
                    "user_id": "user-1",
                },
                {
                    "id": "session-expired",
                    "expires_at": datetime(2026, 7, 21, 12, 0, 0),
                    "token": "expired-token",
                    "created_at": datetime(2026, 7, 20, 12, 0, 0),
                    "updated_at": datetime(2026, 7, 20, 12, 0, 0),
                    "ip_address": None,
                    "user_agent": None,
                    "user_id": "user-1",
                }
            ],
        )

    with engine.connect() as connection:
        session = get_session_by_token(connection, "session-token", clock=clock)
        assert session is not None
        assert session.session_id == "session-1"
        assert session.updated_at == expected_now
        assert session.expires_at == expected_now.replace(year=expected_now.year + 1)

        row = connection.execute(
            select(
                tables["session"].c.updated_at,
                tables["session"].c.expires_at,
            ).where(tables["session"].c.token == "session-token")
        ).mappings().one()
        assert row["updated_at"] == expected_now
        assert row["expires_at"] == expected_now.replace(year=expected_now.year + 1)


def test_session_lookup_cleans_expired_rows_and_clear_helpers(monkeypatch: pytest.MonkeyPatch) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    tables = _build_session_tables(engine)
    monkeypatch.setattr(sessions_module, "legacy_tables", tables)
    clock = FrozenClock(datetime(2026, 7, 22, 12, 0, 0, tzinfo=UTC))

    with engine.begin() as connection:
        connection.execute(
            insert(tables["user"]),
            [
                {
                    "id": "user-1",
                    "name": "User One",
                    "email": "user@example.test",
                    "email_verified": True,
                    "image": None,
                    "created_at": datetime(2026, 7, 21, 12, 0, 0),
                    "updated_at": datetime(2026, 7, 21, 12, 0, 0),
                    "is_active": True,
                }
            ],
        )
        connection.execute(
            insert(tables["session"]),
            [
                {
                    "id": "session-1",
                    "expires_at": datetime(2026, 7, 21, 12, 0, 0),
                    "token": "expired-token",
                    "created_at": datetime(2026, 7, 20, 12, 0, 0),
                    "updated_at": datetime(2026, 7, 20, 12, 0, 0),
                    "ip_address": "127.0.0.1",
                    "user_agent": "pytest",
                    "user_id": "user-1",
                }
            ],
        )

    with engine.connect() as connection:
        assert get_session_by_token(connection, "expired-token", clock=clock) is None
        assert (
            connection.execute(select(tables["session"].c.id)).all()
            == []
        )

        connection.execute(
            insert(tables["session"]),
            [
                {
                    "id": "session-2",
                    "expires_at": datetime(2026, 7, 23, 12, 0, 0),
                    "token": "keep-token",
                    "created_at": datetime(2026, 7, 22, 12, 0, 0),
                    "updated_at": datetime(2026, 7, 22, 12, 0, 0),
                    "ip_address": None,
                    "user_agent": None,
                    "user_id": "user-1",
                }
            ],
        )
        clear_session_token(connection, None)
        clear_session_token(connection, "keep-token")
        assert connection.execute(select(tables["session"].c.id)).all() == []

        connection.execute(
            insert(tables["session"]),
            [
                {
                    "id": "session-3",
                    "expires_at": datetime(2026, 7, 23, 12, 0, 0),
                    "token": "manual-expire",
                    "created_at": datetime(2026, 7, 22, 12, 0, 0),
                    "updated_at": datetime(2026, 7, 22, 12, 0, 0),
                    "ip_address": None,
                    "user_agent": None,
                    "user_id": "user-1",
                }
            ],
        )
        clean_expired_sessions(connection, now=datetime(2026, 7, 23, 12, 0, 0))
        assert connection.execute(select(tables["session"].c.id)).all() == []


def test_session_request_and_datetime_helpers_cover_edge_cases() -> None:
    request = _request_with_cookie_and_user_agent("silo_session=python", "pytest")
    request.state.client_ip = "10.0.0.5"

    assert request_ip(request) == "10.0.0.5"
    assert request_user_agent(request) == "pytest"
    assert request_user_agent(_request_without_user_agent()) is None

    aware = datetime(2026, 7, 22, 15, 0, 0, tzinfo=UTC)
    assert _datetime(aware) == datetime(2026, 7, 22, 15, 0, 0)
    assert _datetime(datetime(2026, 7, 22, 15, 0, 0)) == datetime(2026, 7, 22, 15, 0, 0)
    with pytest.raises(TypeError):
        _datetime("not-a-datetime")

    class _ClosedConnection:
        closed = True

        def commit(self) -> None:  # pragma: no cover - should not run
            raise AssertionError("commit should not be called")

    _commit_if_possible(_ClosedConnection())


def test_session_helpers_cover_default_now_unknown_ip_and_insert_readback_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    tables = _build_session_tables(engine)
    monkeypatch.setattr(sessions_module, "legacy_tables", tables)
    monkeypatch.setattr(
        sessions_module,
        "legacy_local_now",
        lambda clock=None: datetime(2026, 7, 22, 12, 0, 0),
    )

    with engine.begin() as connection:
        connection.execute(
            insert(tables["user"]),
            [
                {
                    "id": "user-1",
                    "name": "User One",
                    "email": "user@example.test",
                    "email_verified": True,
                    "image": None,
                    "created_at": datetime(2026, 7, 21, 12, 0, 0),
                    "updated_at": datetime(2026, 7, 21, 12, 0, 0),
                    "is_active": True,
                }
            ],
        )
        connection.execute(
            insert(tables["session"]),
            [
                {
                    "id": "session-1",
                    "expires_at": datetime(2026, 7, 23, 12, 0, 0),
                    "token": "session-token",
                    "created_at": datetime(2026, 7, 22, 12, 0, 0),
                    "updated_at": datetime(2026, 7, 22, 12, 0, 0),
                    "ip_address": None,
                    "user_agent": None,
                    "user_id": "user-1",
                }
            ],
        )

    with engine.connect() as connection:
        session = get_session_by_token(connection, "session-token", refresh_sliding=False)
        assert session is not None
        assert session.token == "session-token"

        clean_expired_sessions(connection)
        remaining_tokens = connection.execute(
            select(tables["session"].c.token).order_by(tables["session"].c.token)
        ).all()
        assert remaining_tokens == [("session-token",)]

        request = Request(
            {
                "type": "http",
                "method": "GET",
                "path": "/",
                "headers": Headers({}).raw,
                "client": None,
            }
        )
        assert request_ip(request) == "unknown"

        monkeypatch.setattr(
            sessions_module,
            "_fetch_active_session_row",
            lambda *args, **kwargs: None,
        )
        with pytest.raises(RuntimeError):
            create_session(
                connection,
                user_id="user-1",
                ip_address=None,
                user_agent=None,
            )


def _request_with_cookie(cookie: str) -> Request:
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": Headers({"cookie": cookie}).raw,
        "client": ("127.0.0.1", 12345),
    }
    return Request(scope)


def _request_without_user_agent() -> Request:
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": Headers({"cookie": "silo_session=python"}).raw,
        "client": ("127.0.0.1", 12345),
    }
    return Request(scope)


def _request_with_cookie_and_user_agent(cookie: str, user_agent: str) -> Request:
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": Headers({"cookie": cookie, "user-agent": user_agent}).raw,
        "client": ("127.0.0.1", 12345),
    }
    return Request(scope)


def _build_session_tables(engine):
    metadata = MetaData()
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
    metadata.create_all(engine)
    return {"user": user_table, "session": session_table}


def _response() -> Response:
    return Response()
