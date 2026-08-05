from __future__ import annotations

import logging

import pytest

from silo.auth import email as email_module
from silo.auth.email import (
    OtpPurpose,
    SmtpOtpEmailSender,
    _redact_email,
    _redact_otp,
    _setup_password_url,
    render_otp_email,
)
from silo.config import SiloEnvironment, load_settings


def _build_settings(**overrides: str) -> object:
    environ = {
        "DATABASE_URL": "postgresql://test-user:test-pass@localhost:5432/silo",
        "APP_URL_DEV": "http://localhost:3000",
        "UPLOADS_DIR": "C:/tmp/silo-uploads",
        **overrides,
    }
    return load_settings(environ)


def test_otp_email_templates_preserve_legacy_subject_text_and_html() -> None:
    cases = {
        OtpPurpose.SIGN_IN: "Utilize o seguinte código de verificação para fazer login: 123456",
        OtpPurpose.EMAIL_VERIFICATION: (
            "Utilize o seguinte código de verificação para verificar seu e-mail: 123456"
        ),
        OtpPurpose.FORGET_PASSWORD: (
            "Utilize o seguinte código de verificação para recuperar sua senha: 123456"
        ),
    }

    for purpose, expected_text in cases.items():
        rendered = render_otp_email(otp="123456", purpose=purpose)
        assert rendered.subject
        assert rendered.text == expected_text
        assert expected_text in rendered.html
        assert "123456" in rendered.html


def test_smtp_otp_sender_covers_dev_log_and_smtp_branches(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    dev_settings = _build_settings(AUTH_DEV_LOG_OTP="true")
    sender = SmtpOtpEmailSender(dev_settings)

    with caplog.at_level(logging.INFO, logger=email_module.logger.name):
        sender.send_otp(
            recipient="recipient@example.test",
            otp="123456",
            purpose=OtpPurpose.SIGN_IN,
        )

    assert "OTP generated for development environment" in caplog.text

    prod_settings = _build_settings(
        AUTH_DEV_LOG_OTP="false",
        SMTP_HOST="smtp.example.com",
        SMTP_USERNAME="sender@example.test",
        SMTP_PASSWORD="smtp-secret",
        SMTP_FROM="alerts@example.test",
        SMTP_PORT="587",
        SMTP_SECURE="false",
        APP_URL_PROD="https://fortuna.cptec.inpe.br",
        NEXT_PUBLIC_BASE_PATH="/silo",
        SILO_ENV=SiloEnvironment.PRODUCTION.value,
        SESSION_SECRET="session-secret",
        GOOGLE_CLIENT_ID="google-client-id",
        GOOGLE_CLIENT_SECRET="google-client-secret",
    )
    captured: list[tuple[object, object, object]] = []

    def _capture_send_smtp(**kwargs: object) -> None:
        captured.append((kwargs["settings"], kwargs["recipient"], kwargs["template"]))

    monkeypatch.setattr(email_module, "_send_smtp", _capture_send_smtp)

    sender = SmtpOtpEmailSender(prod_settings)
    sender.send_otp(
        recipient="recipient@example.test",
        otp="654321",
        purpose=OtpPurpose.FORGET_PASSWORD,
    )

    assert len(captured) == 1
    assert captured[0][1] == "recipient@example.test"
    assert captured[0][2].subject
    assert _setup_password_url(prod_settings) == "https://fortuna.cptec.inpe.br/silo/setup-password"
    assert _redact_email("recipient@example.test") == "re***@example.test"
    assert _redact_email("invalid") == "<invalid-email>"
    assert _redact_otp("1") == "****"
    assert _redact_otp("123456") == "12****"


def test_smtp_otp_sender_raises_when_smtp_is_missing_and_dev_logging_is_disabled() -> None:
    sender = SmtpOtpEmailSender(_build_settings())

    with pytest.raises(RuntimeError):
        sender.send_otp(
            recipient="recipient@example.test",
            otp="123456",
            purpose=OtpPurpose.SIGN_IN,
        )


def test_setup_password_url_uses_dev_base_when_not_in_production() -> None:
    settings = _build_settings(
        APP_URL_DEV="http://localhost:3000",
        NEXT_PUBLIC_BASE_PATH="/silo",
    )

    assert _setup_password_url(settings) == "http://localhost:3000/silo/setup-password"


def test_smtp_otp_sender_covers_starttls_and_ssl_branches(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class _FakeSMTPBase:
        def __init__(self, host: str, port: int, timeout: int) -> None:
            self.host = host
            self.port = port
            self.timeout = timeout
            self.starttls_called = False
            self.login_args: tuple[str, str] | None = None
            self.messages: list[object] = []

        def __enter__(self) -> _FakeSMTPBase:
            return self

        def __exit__(self, exc_type, exc, tb) -> bool:
            return False

        def starttls(self) -> None:
            self.starttls_called = True

        def login(self, username: str, password: str) -> None:
            self.login_args = (username, password)

        def send_message(self, message: object) -> None:
            self.messages.append(message)

    smtp_instances: list[_FakeSMTPBase] = []
    ssl_instances: list[_FakeSMTPBase] = []

    class _FakeSMTP(_FakeSMTPBase):
        def __init__(self, host: str, port: int, timeout: int) -> None:
            super().__init__(host, port, timeout)
            smtp_instances.append(self)

    class _FakeSMTPSSL(_FakeSMTPBase):
        def __init__(self, host: str, port: int, timeout: int) -> None:
            super().__init__(host, port, timeout)
            ssl_instances.append(self)

    monkeypatch.setattr(email_module.smtplib, "SMTP", _FakeSMTP)
    monkeypatch.setattr(email_module.smtplib, "SMTP_SSL", _FakeSMTPSSL)

    smtp_settings = _build_settings(
        AUTH_DEV_LOG_OTP="false",
        SMTP_HOST="smtp.example.com",
        SMTP_PORT="587",
        SMTP_SECURE="false",
        SMTP_USERNAME="sender@example.test",
        SMTP_PASSWORD="smtp-secret",
        SMTP_FROM="alerts@example.test",
        SESSION_SECRET="session-secret",
        GOOGLE_CLIENT_ID="google-client-id",
        GOOGLE_CLIENT_SECRET="google-client-secret",
    )
    template = render_otp_email(otp="123456", purpose=OtpPurpose.SIGN_IN)

    email_module._send_smtp(  # noqa: SLF001
        settings=smtp_settings,
        recipient="recipient@example.test",
        template=template,
    )
    assert len(smtp_instances) == 1
    assert smtp_instances[0].starttls_called is True
    assert smtp_instances[0].login_args == ("sender@example.test", "smtp-secret")
    assert smtp_instances[0].messages
    assert smtp_instances[0].messages[0]["To"] == "recipient@example.test"
    assert email_module._should_starttls(smtp_settings) is True  # noqa: SLF001
    assert (
        email_module._should_starttls(  # noqa: SLF001
            _build_settings(
                SMTP_HOST="localhost",
                SMTP_PORT="587",
                SMTP_SECURE="false",
            )
        )
        is False
    )
    assert (
        email_module._should_starttls(  # noqa: SLF001
            _build_settings(
                SMTP_HOST="smtp.example.com",
                SMTP_PORT="465",
                SMTP_SECURE="false",
            )
        )
        is False
    )

    secure_settings = _build_settings(
        AUTH_DEV_LOG_OTP="false",
        SMTP_HOST="smtp.example.com",
        SMTP_PORT="465",
        SMTP_SECURE="true",
        SMTP_USERNAME="sender@example.test",
        SMTP_PASSWORD="smtp-secret",
        SMTP_FROM="alerts@example.test",
        SESSION_SECRET="session-secret",
        GOOGLE_CLIENT_ID="google-client-id",
        GOOGLE_CLIENT_SECRET="google-client-secret",
    )
    email_module._send_smtp(  # noqa: SLF001
        settings=secure_settings,
        recipient="secure@example.test",
        template=template,
    )
    assert len(ssl_instances) == 1
    assert ssl_instances[0].starttls_called is False
    assert ssl_instances[0].login_args == ("sender@example.test", "smtp-secret")
    assert ssl_instances[0].messages
    assert ssl_instances[0].messages[0]["To"] == "secure@example.test"
