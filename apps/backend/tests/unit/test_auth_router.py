from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace

import pytest
from fastapi import Response

import silo.api.routers.auth as auth_router_module
from silo.api.errors import ApiValidationError, InfrastructureUnavailableError, UnauthenticatedError
from silo.auth.sessions import AuthenticatedSession
from silo.auth.validation import AuthInputError
from silo.config import SiloEnvironment


class _DummyRequest:
    def __init__(
        self,
        payload: object,
        *,
        cookies: dict[str, str] | None = None,
        headers: dict[str, str] | None = None,
        query_params: dict[str, str] | None = None,
        url_for_value: str = "http://localhost:4000/api/auth/callback/google",
    ) -> None:
        self._payload = payload
        self.cookies = cookies or {}
        self.headers = headers or {}
        self.query_params = query_params or {}
        self.state = SimpleNamespace(client_ip="127.0.0.1", current_user=None, current_user_id=None)
        self.client = SimpleNamespace(host="127.0.0.1")
        self._url_for_value = url_for_value

    async def json(self) -> object:
        if isinstance(self._payload, Exception):
            raise self._payload
        return self._payload

    def url_for(self, _name: str) -> str:
        return self._url_for_value


class _FakeAuthService:
    def __init__(
        self,
        session: AuthenticatedSession | None,
        *,
        sign_up_session: AuthenticatedSession | None = None,
        setup_session: AuthenticatedSession | None = None,
    ) -> None:
        self.session = session
        self.sign_up_session = sign_up_session
        self.setup_session = setup_session
        self.calls: list[tuple[str, tuple[object, ...], dict[str, object]]] = []

    def login_with_password(self, **kwargs: object) -> AuthenticatedSession:
        self.calls.append(("login_with_password", (), kwargs))
        assert self.session is not None
        return self.session

    def send_login_email_otp(self, **kwargs: object) -> dict[str, object]:
        self.calls.append(("send_login_email_otp", (), kwargs))
        return {"step": 2}

    def verify_login_email_otp(self, **kwargs: object) -> AuthenticatedSession:
        self.calls.append(("verify_login_email_otp", (), kwargs))
        assert self.session is not None
        return self.session

    def create_sign_up_email(self, **kwargs: object) -> dict[str, object]:
        self.calls.append(("create_sign_up_email", (), kwargs))
        return {"step": 2}

    def send_sign_up_email_otp(self, **kwargs: object) -> dict[str, object]:
        self.calls.append(("send_sign_up_email_otp", (), kwargs))
        return {"step": 2}

    def verify_sign_up_email_otp(self, **kwargs: object) -> AuthenticatedSession | None:
        self.calls.append(("verify_sign_up_email_otp", (), kwargs))
        return self.sign_up_session

    def send_forget_password_otp(self, **kwargs: object) -> dict[str, object]:
        self.calls.append(("send_forget_password_otp", (), kwargs))
        return {"step": 2}

    def verify_forget_password_otp(self, **kwargs: object) -> None:
        self.calls.append(("verify_forget_password_otp", (), kwargs))

    def setup_password(self, **kwargs: object) -> AuthenticatedSession | None:
        self.calls.append(("setup_password", (), kwargs))
        return self.setup_session or self.session


def _build_session() -> AuthenticatedSession:
    return AuthenticatedSession(
        session_id="session-1",
        token="session-token",
        expires_at=datetime(2027, 7, 22, 12, 0),
        created_at=datetime(2026, 7, 22, 12, 0),
        updated_at=datetime(2026, 7, 22, 12, 0),
        ip_address="127.0.0.1",
        user_agent="pytest",
        user_id="user-1",
        user_name="User One",
        user_email="user@example.test",
        user_email_verified=True,
        user_image="/images/profile.png",
        user_created_at=datetime(2026, 7, 22, 12, 0),
        user_updated_at=datetime(2026, 7, 22, 12, 0),
    )


def _fake_settings() -> SimpleNamespace:
    return SimpleNamespace(
        silo_env=SiloEnvironment.DEVELOPMENT,
        app_url_dev="http://localhost:3000",
        app_url_prod="https://fortuna.cptec.inpe.br",
        public_base_path="/silo",
        next_public_base_path="/silo",
    )


def _cookie_header_text(response: Response) -> str:
    return "\n".join(
        value.decode("latin-1")
        for name, value in response.raw_headers
        if name.lower() == b"set-cookie"
    )


@pytest.mark.asyncio
async def test_auth_router_happy_paths_cover_session_and_otp_routes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = _build_session()
    service = _FakeAuthService(session=session, sign_up_session=None, setup_session=session)

    monkeypatch.setattr(auth_router_module, "load_settings", _fake_settings)
    monkeypatch.setattr(auth_router_module, "_auth_service", lambda _db, _settings: service)
    monkeypatch.setattr(auth_router_module, "_parse", lambda _schema, payload: payload)

    login_request = _DummyRequest(
        {"email": "user@example.test", "password": "#Secret123"},
        headers={"user-agent": "pytest"},
        cookies={"silo_session": "session-token"},
    )
    response = Response()
    payload = await auth_router_module.login_password(login_request, response, db=object())
    assert payload["success"] is True
    assert "silo_session=" in _cookie_header_text(response)

    response = Response()
    sign_in_payload = await auth_router_module.sign_in_email_compat(
        _DummyRequest(
            {"email": "user@example.test", "password": "#Secret123"},
            headers={"user-agent": "pytest"},
        ),
        response,
        db=object(),
    )
    assert sign_in_payload["redirect"] is False
    assert sign_in_payload["token"] == session.session_id

    payload = await auth_router_module.login_email_send_otp(
        _DummyRequest({"email": "user@example.test"}),
        db=object(),
    )
    assert payload["success"] is True

    response = Response()
    verify_payload = await auth_router_module.login_email_verify_otp(
        _DummyRequest({"email": "user@example.test", "code": "123456"}, headers={"user-agent": "pytest"}),
        response,
        db=object(),
    )
    assert verify_payload["data"]["signedIn"] is True
    assert "silo_session=" in _cookie_header_text(response)

    sign_up_payload = await auth_router_module.sign_up_email(
        _DummyRequest(
            {"name": "New User", "email": "new.user@example.test", "password": "#Secret123"}
        ),
        db=object(),
    )
    assert sign_up_payload["success"] is True

    sign_up_verify_payload = await auth_router_module.sign_up_email_verify_otp(
        _DummyRequest(
            {"email": "new.user@example.test", "code": "123456", "auto_sign_in": True},
            headers={"user-agent": "pytest"},
        ),
        Response(),
        db=object(),
    )
    assert sign_up_verify_payload["data"]["signedIn"] is False

    forget_payload = await auth_router_module.forget_password(
        _DummyRequest({"email": "user@example.test"}),
        db=object(),
    )
    assert forget_payload["success"] is True

    forget_verify_payload = await auth_router_module.forget_password_verify_otp(
        _DummyRequest({"email": "user@example.test", "code": "123456"}),
        db=object(),
    )
    assert forget_verify_payload["data"]["step"] == 3

    setup_response = Response()
    setup_payload = await auth_router_module.setup_password(
        _DummyRequest(
            {"email": "user@example.test", "code": "123456", "password": "#Secret123"},
            headers={"user-agent": "pytest"},
        ),
        setup_response,
        db=object(),
    )
    assert setup_payload["data"]["signedIn"] is True
    assert "silo_session=" in _cookie_header_text(setup_response)

    monkeypatch.setattr(auth_router_module, "get_session_by_token", lambda _db, _token: session)
    session_payload = await auth_router_module.get_session(
        _DummyRequest({}, cookies={"silo_session": session.token}),
        db=object(),
    )
    assert session_payload["user"]["id"] == session.user_id

    sign_out_response = Response()
    cleared_tokens: list[str | None] = []
    monkeypatch.setattr(auth_router_module, "clear_session_token", lambda _db, token: cleared_tokens.append(token))
    sign_out_payload = await auth_router_module.sign_out(
        _DummyRequest({}, cookies={"silo_session": session.token}),
        sign_out_response,
        db=object(),
    )
    assert sign_out_payload["success"] is True
    assert cleared_tokens == [session.token]
    assert "silo_session=" in _cookie_header_text(sign_out_response)


@pytest.mark.asyncio
async def test_auth_router_google_and_validation_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = _build_session()
    monkeypatch.setattr(auth_router_module, "load_settings", _fake_settings)

    with pytest.raises(ApiValidationError):
        await auth_router_module._json_payload(_DummyRequest(ValueError("invalid json")))

    monkeypatch.setattr(
        auth_router_module,
        "parse_auth_payload",
        lambda _schema, _payload: (_ for _ in ()).throw(AuthInputError("Dados inválidos.", field="email")),
    )
    with pytest.raises(ApiValidationError):
        auth_router_module._parse("login_password", {})

    with pytest.raises(UnauthenticatedError):
        await auth_router_module.get_session(_DummyRequest({}, cookies={}), db=object())

    monkeypatch.setattr(auth_router_module, "should_use_legacy_contract_google_response", lambda _settings: True)
    legacy_result = await auth_router_module.login_google(
        _DummyRequest({}, query_params={"from": "login"}),
        Response(),
        db=object(),
    )
    assert legacy_result.status_code == 404

    monkeypatch.setattr(auth_router_module, "should_use_legacy_contract_google_response", lambda _settings: False)
    monkeypatch.setattr(auth_router_module, "google_credentials_configured", lambda _settings: False)
    with pytest.raises(InfrastructureUnavailableError):
        await auth_router_module.login_google(_DummyRequest({}, query_params={"from": "login"}), Response(), db=object())

    def _build_google_login_start(db, *, settings, request, response, from_page):  # noqa: ANN001
        del db, settings, request, from_page
        response.headers.append("Set-Cookie", "google-login-start=1; Path=/; HttpOnly")
        return SimpleNamespace(authorization_url="https://accounts.google.com/o/oauth2/auth?state=state-1")

    monkeypatch.setattr(auth_router_module, "google_credentials_configured", lambda _settings: True)
    monkeypatch.setattr(auth_router_module, "build_google_login_start", _build_google_login_start)
    google_start = await auth_router_module.login_google(
        _DummyRequest({}, query_params={"from": "register"}),
        Response(),
        db=object(),
    )
    assert google_start.status_code == 302
    assert "google-login-start=1" in _cookie_header_text(google_start)

    missing_state = await auth_router_module.google_callback(
        _DummyRequest({}, query_params={}),
        db=object(),
    )
    assert missing_state.status_code == 302
    assert "please_restart_the_process" in missing_state.headers["location"]

    monkeypatch.setattr(
        auth_router_module,
        "consume_google_state",
        lambda _db, state: SimpleNamespace(nonce="nonce-1", from_page="login"),
    )
    missing_code = await auth_router_module.google_callback(
        _DummyRequest({}, query_params={"state": "state-1"}),
        db=object(),
    )
    assert missing_code.status_code == 302
    assert "error=google" in missing_code.headers["location"]

    monkeypatch.setattr(
        auth_router_module,
        "complete_google_callback",
        lambda *args, **kwargs: session,
    )
    monkeypatch.setattr(
        auth_router_module,
        "app_redirect_url",
        lambda _settings, path="": f"http://localhost:3000{path}",
    )
    success_response = await auth_router_module.google_callback(
        _DummyRequest({}, query_params={"state": "state-1", "code": "code-1"}),
        db=object(),
    )
    assert success_response.status_code == 302
    assert success_response.headers["location"] == "http://localhost:3000"
    assert "silo_session=" in _cookie_header_text(success_response)
