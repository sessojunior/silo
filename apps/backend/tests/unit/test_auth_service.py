from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace

import pytest
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Integer,
    MetaData,
    String,
    Table,
    UniqueConstraint,
    create_engine,
    delete,
    insert,
    select,
)

import silo.api.rate_limit as rate_limit_module
import silo.auth.service as auth_service
from silo.api.errors import ApiError, InfrastructureUnavailableError
from silo.auth.email import OtpPurpose
from silo.auth.service import AuthService, OtpFlow
from silo.clock import FrozenClock
from silo.config import load_settings


@dataclass(slots=True)
class RecordingEmailSender:
    sent: list[tuple[str, str, OtpPurpose]] = field(default_factory=list)

    def send_otp(self, *, recipient: str, otp: str, purpose: OtpPurpose) -> None:
        self.sent.append((recipient, otp, purpose))


@pytest.fixture
def auth_env(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> Iterator[tuple[AuthService, object, dict[str, Table], RecordingEmailSender]]:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
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
    rate_limit_table = Table(
        "rate_limit",
        metadata,
        Column("id", String, primary_key=True),
        Column("route", String, nullable=False),
        Column("email", String, nullable=False),
        Column("ip", String, nullable=False),
        Column("count", Integer, nullable=False),
        Column("last_request", DateTime, nullable=False),
        UniqueConstraint("email", "ip", "route", name="uq_rate_limit_email_ip_route"),
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
    metadata.create_all(engine)

    tables = {
        "user": user_table,
        "account": account_table,
        "verification": verification_table,
        "rate_limit": rate_limit_table,
        "group": group_table,
        "user_group": user_group_table,
        "session": session_table,
    }
    monkeypatch.setattr(auth_service, "legacy_tables", tables)
    monkeypatch.setattr(rate_limit_module, "legacy_tables", tables)

    id_counter = iter(range(1, 10_000))
    monkeypatch.setattr(
        auth_service,
        "hash_legacy_bcrypt",
        lambda password: f"hash:{password}",
    )
    monkeypatch.setattr(
        auth_service,
        "verify_legacy_bcrypt",
        lambda password, stored: stored == f"hash:{password}",
    )
    monkeypatch.setattr(auth_service.secrets, "randbelow", lambda _limit: 123456)
    monkeypatch.setattr(
        auth_service.secrets, "token_hex", lambda _size: "feedfacefeedfacefeedfacefeedface"
    )
    monkeypatch.setattr(auth_service, "uuid4", lambda: f"uuid-{next(id_counter)}")

    settings = load_settings(
        {
            "DATABASE_URL": "postgresql://test-user:test-pass@localhost:5432/silo",
            "SESSION_SECRET": "session-secret",
            "ALLOWED_EMAIL_DOMAINS": "example.test",
            "APP_URL_DEV": "http://localhost:3000",
            "OLLAMA_URL": "http://localhost:11434",
            "UPLOADS_DIR": str(tmp_path / "uploads"),
        }
    )
    sender = RecordingEmailSender()
    connection = engine.connect()
    connection.execute(
        insert(group_table),
        [
            {
                "id": "group-default",
                "name": "Default",
                "role": "user",
                "is_default": True,
                "created_at": datetime(2026, 7, 22, 12, 0),
                "updated_at": datetime(2026, 7, 22, 12, 0),
            }
        ],
    )
    connection.commit()
    service = AuthService(
        connection=connection,
        settings=settings,
        email_sender=sender,
        clock=FrozenClock(datetime(2026, 7, 22, 12, 0, tzinfo=UTC)),
    )

    try:
        yield service, connection, tables, sender
    finally:
        connection.close()
        engine.dispose()


def _seed_user(
    connection,
    tables: dict[str, Table],
    *,
    user_id: str,
    email: str,
    name: str = "User",
    password: str = "secret-123",
    is_active: bool = True,
    email_verified: bool = True,
) -> None:
    now = datetime(2026, 7, 22, 12, 0)
    connection.execute(
        insert(tables["user"]).values(
            id=user_id,
            name=name,
            email=email,
            email_verified=email_verified,
            image=None,
            created_at=now,
            updated_at=now,
            is_active=is_active,
            last_login=None,
        )
    )
    connection.execute(
        insert(tables["account"]).values(
            id=f"account-{user_id}",
            account_id=user_id,
            provider_id="credential",
            user_id=user_id,
            access_token=None,
            refresh_token=None,
            id_token=None,
            access_token_expires_at=None,
            refresh_token_expires_at=None,
            scope=None,
            password=f"hash:{password}",
            created_at=now,
            updated_at=now,
        )
    )
    connection.commit()


def _seed_rate_limit(
    connection,
    tables: dict[str, Table],
    *,
    email: str,
    ip: str,
    route: str,
    count_value: int,
) -> None:
    now = datetime(2026, 7, 22, 12, 0)
    connection.execute(
        insert(tables["rate_limit"]).values(
            id=f"rate-limit-{email}-{route}",
            route=route,
            email=email,
            ip=ip,
            count=count_value,
            last_request=now,
        )
    )
    connection.commit()


def test_auth_service_login_password_covers_success_inactive_invalid_and_rate_limit(
    monkeypatch: pytest.MonkeyPatch,
    auth_env,
) -> None:
    service, connection, tables, _sender = auth_env
    _seed_user(
        connection, tables, user_id="user-login", email="login@example.test", password="letmein"
    )
    _seed_user(
        connection,
        tables,
        user_id="user-inactive",
        email="inactive@example.test",
        password="secret-123",
        is_active=False,
    )

    with pytest.raises(ApiError) as exc_info:
        service.login_with_password(
            email="login@example.test",
            password="wrong",
            ip_address="127.0.0.1",
            user_agent="pytest",
        )
    assert exc_info.value.status_code == 401
    assert exc_info.value.field == "password"
    assert (
        connection.execute(
            select(tables["rate_limit"].c.count).where(
                tables["rate_limit"].c.email == "login@example.test"
            )
        ).first()
        is not None
    )

    session = service.login_with_password(
        email="login@example.test",
        password="letmein",
        ip_address="127.0.0.1",
        user_agent="pytest",
    )
    assert session.user_id == "user-login"
    assert session.user_email == "login@example.test"
    assert session.token
    assert (
        connection.execute(
            select(tables["rate_limit"].c.id).where(
                tables["rate_limit"].c.email == "login@example.test"
            )
        ).first()
        is None
    )

    with pytest.raises(ApiError) as exc_info:
        service.login_with_password(
            email="inactive@example.test",
            password="secret-123",
            ip_address="127.0.0.1",
            user_agent="pytest",
        )
    assert exc_info.value.status_code == 403

    _seed_rate_limit(
        connection,
        tables,
        email="login@example.test",
        ip="127.0.0.1",
        route=auth_service.LOGIN_PASSWORD_ROUTE,
        count_value=5,
    )
    monkeypatch.setattr(
        auth_service,
        "get_auth_rate_limit_status",
        lambda *args, **kwargs: SimpleNamespace(
            is_limited=True,
            retry_after_seconds=90,
            count=5,
            limit=5,
        ),
    )
    with pytest.raises(ApiError) as exc_info:
        service.login_with_password(
            email="login@example.test",
            password="letmein",
            ip_address="127.0.0.1",
            user_agent="pytest",
        )
    assert exc_info.value.status_code == 429


def test_auth_service_email_signup_and_forget_password_flow(auth_env) -> None:
    service, connection, tables, sender = auth_env
    _seed_user(
        connection, tables, user_id="user-login", email="login@example.test", password="letmein"
    )

    data = service.send_login_email_otp(email="login@example.test", ip_address="127.0.0.1")
    assert data == {"cooldownSeconds": auth_service.AUTH_OTP_RESEND_COOLDOWN_SECONDS}
    assert sender.sent[-1] == ("login@example.test", "123456", OtpPurpose.SIGN_IN)

    session = service.verify_login_email_otp(
        email="login@example.test",
        code="123456",
        ip_address="127.0.0.1",
        user_agent="pytest",
    )
    assert session.user_id == "user-login"

    _seed_user(connection, tables, user_id="user-lockout", email="lockout@example.test")
    service.send_login_email_otp(email="lockout@example.test", ip_address="127.0.0.1")
    for _attempt in range(4):
        with pytest.raises(ApiError) as exc_info:
            service.verify_login_email_otp(
                email="lockout@example.test",
                code="000000",
                ip_address="127.0.0.1",
                user_agent="pytest",
            )
        assert exc_info.value.status_code == 400
    with pytest.raises(ApiError) as exc_info:
        service.verify_login_email_otp(
            email="lockout@example.test",
            code="000000",
            ip_address="127.0.0.1",
            user_agent="pytest",
        )
    assert exc_info.value.status_code == 429

    with pytest.raises(ApiError) as exc_info:
        service.create_sign_up_email(
            name="Missing domain",
            email="bad@other.test",
            password="secret-123",
            ip_address="127.0.0.1",
        )
    assert exc_info.value.status_code == 400

    created = service.create_sign_up_email(
        name="New User",
        email="new@example.test",
        password="NewSecret123!",
        ip_address="127.0.0.1",
    )
    assert created == {"cooldownSeconds": auth_service.SIGN_UP_COOLDOWN_SECONDS}
    assert sender.sent[-1] == ("new@example.test", "123456", OtpPurpose.EMAIL_VERIFICATION)

    connection.execute(
        delete(tables["rate_limit"]).where(tables["rate_limit"].c.email == "new@example.test")
    )
    connection.commit()

    with pytest.raises(ApiError) as exc_info:
        service.create_sign_up_email(
            name="New User",
            email="new@example.test",
            password="NewSecret123!",
            ip_address="127.0.0.1",
        )
    assert exc_info.value.status_code == 400
    assert exc_info.value.field == "email"

    verified_session = service.verify_sign_up_email_otp(
        email="new@example.test",
        code="123456",
        password="NewSecret123!",
        auto_sign_in=True,
        ip_address="127.0.0.1",
        user_agent="pytest",
    )
    assert verified_session is not None
    assert verified_session.user_email == "new@example.test"

    user_row = connection.execute(
        select(tables["user"].c.is_active, tables["user"].c.email_verified).where(
            tables["user"].c.email == "new@example.test"
        )
    ).first()
    assert user_row == (True, True)

    created_user_id = connection.execute(
        select(tables["user"].c.id).where(tables["user"].c.email == "new@example.test")
    ).first()
    assert created_user_id is not None
    user_group_row = connection.execute(
        select(tables["user_group"].c.group_id).where(
            tables["user_group"].c.user_id == created_user_id[0]
        )
    ).first()
    assert user_group_row is not None

    resend = service.send_sign_up_email_otp(email="new@example.test", ip_address="127.0.0.1")
    assert resend == {"cooldownSeconds": auth_service.SIGN_UP_COOLDOWN_SECONDS}

    with pytest.raises(ApiError) as exc_info:
        service.send_sign_up_email_otp(email="missing@example.test", ip_address="127.0.0.1")
    assert exc_info.value.status_code == 404

    forgot = service.send_forget_password_otp(email="new@example.test", ip_address="127.0.0.1")
    assert forgot["step"] == 2
    with pytest.raises(ApiError) as exc_info:
        service.send_forget_password_otp(email="unknown@example.test", ip_address="127.0.0.1")
    assert exc_info.value.status_code == 404


def test_auth_service_forget_password_and_setup_password_flow(auth_env) -> None:
    service, connection, tables, sender = auth_env
    _seed_user(
        connection, tables, user_id="user-reset", email="reset@example.test", password="old-pass"
    )

    sent = service.send_forget_password_otp(email="reset@example.test", ip_address="127.0.0.1")
    assert sent["step"] == 2
    assert sender.sent[-1] == ("reset@example.test", "123456", OtpPurpose.FORGET_PASSWORD)

    with pytest.raises(ApiError) as exc_info:
        service.verify_forget_password_otp(
            email="reset@example.test",
            code="000000",
            ip_address="127.0.0.1",
        )
    assert exc_info.value.status_code == 400

    service.verify_forget_password_otp(
        email="reset@example.test",
        code="123456",
        ip_address="127.0.0.1",
    )

    session = service.setup_password(
        email="reset@example.test",
        code="123456",
        password="BrandNew123!",
        auto_sign_in=False,
        ip_address="127.0.0.1",
        user_agent="pytest",
    )
    assert session is None

    password_row = connection.execute(
        select(tables["account"].c.password).where(
            tables["account"].c.user_id == "user-reset",
            tables["account"].c.provider_id == "credential",
        )
    ).first()
    assert password_row is not None
    assert password_row[0] == "hash:BrandNew123!"

    login_session = service.login_with_password(
        email="reset@example.test",
        password="BrandNew123!",
        ip_address="127.0.0.1",
        user_agent="pytest",
    )
    assert login_session.user_id == "user-reset"


def test_auth_service_private_helpers_cover_otp_and_default_group_errors(auth_env) -> None:
    service, connection, tables, _sender = auth_env

    assert service._otp_identifier(email="one@example.test", flow=OtpFlow.LOGIN_EMAIL) == (
        "silo:otp:login-email:one@example.test"
    )
    assert service._attempts_identifier(email="one@example.test", flow=OtpFlow.LOGIN_EMAIL) == (
        "login-email:attempts:one@example.test"
    )
    otp_value = service._otp_value("123456")
    assert otp_value.startswith("silo-otp-v1:")
    assert service._verify_otp_value("123456", "123456") is True
    assert service._verify_otp_value("999999", "123456") is False

    connection.execute(delete(tables["group"]).where(tables["group"].c.is_default.is_(True)))
    connection.commit()

    with pytest.raises(ApiError) as exc_info:
        service._ensure_default_group(
            user_id="user-missing-default", now=datetime(2026, 7, 22, 12, 0)
        )
    assert exc_info.value.status_code == 500


def test_auth_service_setup_password_and_login_rate_limit_edges(auth_env) -> None:
    service, connection, tables, _sender = auth_env
    _seed_user(
        connection,
        tables,
        user_id="user-reset-auto",
        email="reset-auto@example.test",
        password="old-pass",
    )

    with pytest.raises(ApiError) as exc_info:
        service.send_login_email_otp(email="missing@example.test", ip_address="127.0.0.1")
    assert exc_info.value.status_code == 404

    service.send_forget_password_otp(email="reset-auto@example.test", ip_address="127.0.0.1")

    with pytest.raises(ApiError) as exc_info:
        service.setup_password(
            email="reset-auto@example.test",
            code="000000",
            password="BrandNew123!",
            auto_sign_in=True,
            ip_address="127.0.0.1",
            user_agent="pytest",
        )
    assert exc_info.value.status_code == 400

    session = service.setup_password(
        email="reset-auto@example.test",
        code="123456",
        password="BrandNew123!",
        auto_sign_in=True,
        ip_address="127.0.0.1",
        user_agent="pytest",
    )
    assert session is not None
    assert session.user_id == "user-reset-auto"
    session_row = connection.execute(
        select(tables["session"].c.user_id).where(
            tables["session"].c.user_id == "user-reset-auto"
        )
    ).first()
    assert session_row is not None


def test_auth_service_private_helpers_cover_missing_account_and_update_branches(auth_env) -> None:
    service, connection, tables, _sender = auth_env
    now = datetime(2026, 7, 22, 12, 0)
    helper_user_id = "user-helper"
    helper_email = "helper@example.test"

    connection.execute(
        insert(tables["user"]).values(
            id=helper_user_id,
            name="Helper",
            email=helper_email,
            email_verified=True,
            image=None,
            created_at=now,
            updated_at=now,
            is_active=True,
            last_login=None,
        )
    )
    connection.commit()

    assert service._credential_password_matches(helper_user_id, "irrelevant") is False

    service._upsert_credential_password(
        user_id=helper_user_id,
        password="First123!",
        now=now,
    )
    service._upsert_credential_password(
        user_id=helper_user_id,
        password="Second123!",
        now=now,
    )

    password_row = connection.execute(
        select(tables["account"].c.password).where(
            tables["account"].c.user_id == helper_user_id,
            tables["account"].c.provider_id == "credential",
        )
    ).first()
    assert password_row is not None
    assert password_row[0] == "hash:Second123!"

    service._ensure_default_group(user_id=helper_user_id, now=now)
    service._ensure_default_group(user_id=helper_user_id, now=now)

    otp_hash = service._otp_value("123456")
    assert service._verify_otp_value("123456", otp_hash) is True
    assert service._verify_otp_value("000000", otp_hash) is False

    class _FailingSender:
        def send_otp(self, *, recipient: str, otp: str, purpose: OtpPurpose) -> None:
            del recipient, otp, purpose
            raise RuntimeError("smtp down")

    failing_service = AuthService(
        connection=connection,
        settings=service.settings,
        email_sender=_FailingSender(),
        clock=service.clock,
    )

    with pytest.raises(InfrastructureUnavailableError):
        failing_service._store_and_send_otp(
            email=helper_email,
            flow=OtpFlow.LOGIN_EMAIL,
            purpose=OtpPurpose.SIGN_IN,
        )


def test_auth_service_rate_limit_helper_branches_raise_expected_errors(auth_env, monkeypatch) -> None:
    service, _connection, _tables, _sender = auth_env

    monkeypatch.setattr(
        auth_service,
        "get_auth_rate_limit_status",
        lambda *args, **kwargs: SimpleNamespace(is_limited=True, retry_after_seconds=42),
    )

    with pytest.raises(ApiError) as exc_info:
        service._enforce_cooldown(
            email="rate@example.test",
            ip_address="127.0.0.1",
            route=auth_service.LOGIN_EMAIL_SEND_OTP_COOLDOWN_ROUTE,
            cooldown_seconds=90,
        )
    assert exc_info.value.status_code == 429
    assert exc_info.value.field == "email"

    with pytest.raises(ApiError) as exc_info:
        service._enforce_burst(
            email="rate@example.test",
            ip_address="127.0.0.1",
            route=auth_service.SIGN_UP_EMAIL_BURST_ROUTE,
            limit=8,
            window_seconds=600,
        )
    assert exc_info.value.status_code == 429

    with pytest.raises(ApiError) as exc_info:
        service._enforce_lockout(
            email="rate@example.test",
            ip_address="127.0.0.1",
            route=auth_service.LOGIN_EMAIL_VERIFY_LOCKOUT_ROUTE,
        )
    assert exc_info.value.status_code == 429
    assert exc_info.value.field == "code"

    with pytest.raises(ApiError) as exc_info:
        service._rate_limit_unknown_email(
            email="rate@example.test",
            ip_address="127.0.0.1",
            route=auth_service.LOGIN_EMAIL_WRONG_EMAIL_ROUTE,
        )
    assert exc_info.value.status_code == 429
    assert exc_info.value.field == "email"


def test_auth_service_rejects_inactive_users_on_login_email_paths(auth_env) -> None:
    service, connection, tables, _sender = auth_env
    _seed_user(
        connection,
        tables,
        user_id="user-inactive-email",
        email="inactive-email@example.test",
        password="Inactive123!",
        is_active=False,
    )

    with pytest.raises(ApiError) as exc_info:
        service.send_login_email_otp(
            email="inactive-email@example.test",
            ip_address="127.0.0.1",
        )
    assert exc_info.value.status_code == 403

    with pytest.raises(ApiError) as exc_info:
        service.verify_login_email_otp(
            email="inactive-email@example.test",
            code="123456",
            ip_address="127.0.0.1",
            user_agent="pytest",
        )
    assert exc_info.value.status_code == 403


def test_auth_service_signup_and_setup_password_edge_branches(auth_env, monkeypatch) -> None:
    service, connection, tables, _sender = auth_env
    _seed_user(
        connection,
        tables,
        user_id="user-reset-edge",
        email="reset-edge@example.test",
        password="old-pass",
    )

    with pytest.raises(ApiError) as exc_info:
        service.verify_sign_up_email_otp(
            email="missing-signup@example.test",
            code="123456",
            password=None,
            auto_sign_in=False,
            ip_address="127.0.0.1",
            user_agent="pytest",
        )
    assert exc_info.value.status_code == 404

    service.create_sign_up_email(
        name="Signup Edge",
        email="signup-edge@example.test",
        password="NewSecret123!",
        ip_address="127.0.0.1",
    )

    with pytest.raises(ApiError) as exc_info:
        service.verify_sign_up_email_otp(
            email="signup-edge@example.test",
            code="000000",
            password=None,
            auto_sign_in=False,
            ip_address="127.0.0.1",
            user_agent="pytest",
        )
    assert exc_info.value.status_code == 400

    verified = service.verify_sign_up_email_otp(
        email="signup-edge@example.test",
        code="123456",
        password=None,
        auto_sign_in=False,
        ip_address="127.0.0.1",
        user_agent="pytest",
    )
    assert verified is None

    with pytest.raises(ApiError) as exc_info:
        service.setup_password(
            email="missing-setup@example.test",
            code="123456",
            password="BrandNew123!",
            auto_sign_in=False,
            ip_address="127.0.0.1",
            user_agent="pytest",
        )
    assert exc_info.value.status_code == 404

    monkeypatch.setattr(
        AuthService,
        "_otp_attempt_count",
        lambda self, *, email, flow: auth_service.OTP_MAX_ATTEMPTS,
    )
    with pytest.raises(ApiError) as exc_info:
        service.setup_password(
            email="reset-edge@example.test",
            code="123456",
            password="BrandNew123!",
            auto_sign_in=False,
            ip_address="127.0.0.1",
            user_agent="pytest",
        )
    assert exc_info.value.status_code == 429
    assert exc_info.value.field == "code"

    monkeypatch.setattr(AuthService, "_otp_attempt_count", lambda self, *, email, flow: 0)
    monkeypatch.setattr(AuthService, "_consume_valid_otp", lambda self, **kwargs: False)
    monkeypatch.setattr(
        AuthService,
        "_increment_otp_attempts",
        lambda self, *, email, flow: auth_service.OTP_MAX_ATTEMPTS,
    )
    with pytest.raises(ApiError) as exc_info:
        service.setup_password(
            email="reset-edge@example.test",
            code="000000",
            password="BrandNew123!",
            auto_sign_in=False,
            ip_address="127.0.0.1",
            user_agent="pytest",
        )
    assert exc_info.value.status_code == 429
    assert exc_info.value.field == "code"
