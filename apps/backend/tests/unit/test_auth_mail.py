from __future__ import annotations

import logging
from email.message import EmailMessage
from typing import ClassVar

from silo.auth import mail as mail_module
from silo.config import load_settings


def _build_settings(**overrides: str) -> object:
    environ = {
        "DATABASE_URL": "postgresql://test-user:test-pass@localhost:5432/silo",
        "APP_URL_DEV": "http://localhost:3000",
        "UPLOADS_DIR": "C:/tmp/silo-uploads",
        **overrides,
    }
    return load_settings(environ)


class _FakeSMTPBase:
    instances: ClassVar[list[_FakeSMTPBase]] = []

    def __init__(self, host: str, port: int, timeout: int = 20) -> None:
        self.host = host
        self.port = port
        self.timeout = timeout
        self.started_tls = False
        self.logged_in: tuple[str, str] | None = None
        self.sent_message: EmailMessage | None = None
        type(self).instances.append(self)

    def __enter__(self) -> _FakeSMTPBase:
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False

    def starttls(self) -> None:
        self.started_tls = True

    def login(self, username: str, password: str) -> None:
        self.logged_in = (username, password)

    def send_message(self, message: EmailMessage) -> None:
        self.sent_message = message


class _FakeSMTP(_FakeSMTPBase):
    instances: ClassVar[list[_FakeSMTP]] = []


class _FakeSMTPSSL(_FakeSMTPBase):
    instances: ClassVar[list[_FakeSMTPSSL]] = []


def test_send_plain_email_noops_when_smtp_is_not_configured(caplog) -> None:
    settings = _build_settings()

    with caplog.at_level(logging.INFO, logger=mail_module.logger.name):
        mail_module.send_plain_email(
            to="recipient@example.test",
            subject="Assunto",
            text="Corpo",
            settings=settings,
        )

    assert "Email not sent because SMTP is not configured" in caplog.text


def test_send_plain_email_uses_starttls_and_login_when_smtp_is_plain(monkeypatch) -> None:
    _FakeSMTP.instances.clear()
    _FakeSMTPSSL.instances.clear()
    monkeypatch.setattr(mail_module.smtplib, "SMTP", _FakeSMTP)
    monkeypatch.setattr(mail_module.smtplib, "SMTP_SSL", _FakeSMTPSSL)

    settings = _build_settings(
        SMTP_HOST="smtp.example.com",
        SMTP_USERNAME="sender@example.test",
        SMTP_PASSWORD="smtp-secret",
        SMTP_PORT="587",
        SMTP_SECURE="false",
    )

    mail_module.send_plain_email(
        to="recipient@example.test",
        subject="Assunto",
        text="Corpo",
        settings=settings,
    )

    assert len(_FakeSMTP.instances) == 1
    assert len(_FakeSMTPSSL.instances) == 0
    instance = _FakeSMTP.instances[0]
    assert instance.host == "smtp.example.com"
    assert instance.port == 587
    assert instance.started_tls is True
    assert instance.logged_in == ("sender@example.test", "smtp-secret")
    assert instance.sent_message is not None
    assert instance.sent_message["Subject"] == "Assunto"
    assert instance.sent_message["From"] == "sender@example.test"
    assert instance.sent_message["To"] == "recipient@example.test"
    assert instance.sent_message.get_content().strip() == "Corpo"


def test_send_plain_email_uses_ssl_without_starttls_when_secure(monkeypatch) -> None:
    _FakeSMTP.instances.clear()
    _FakeSMTPSSL.instances.clear()
    monkeypatch.setattr(mail_module.smtplib, "SMTP", _FakeSMTP)
    monkeypatch.setattr(mail_module.smtplib, "SMTP_SSL", _FakeSMTPSSL)

    settings = _build_settings(
        SMTP_HOST="smtp.example.com",
        SMTP_USERNAME="sender@example.test",
        SMTP_PASSWORD="smtp-secret",
        SMTP_FROM="alerts@example.test",
        SMTP_PORT="465",
        SMTP_SECURE="true",
    )

    mail_module.send_plain_email(
        to="recipient@example.test",
        subject="Assunto",
        text="Corpo",
        settings=settings,
    )

    assert len(_FakeSMTP.instances) == 0
    assert len(_FakeSMTPSSL.instances) == 1
    instance = _FakeSMTPSSL.instances[0]
    assert instance.host == "smtp.example.com"
    assert instance.port == 465
    assert instance.started_tls is False
    assert instance.logged_in == ("sender@example.test", "smtp-secret")
    assert instance.sent_message is not None
    assert instance.sent_message["From"] == "alerts@example.test"
