from __future__ import annotations

import logging
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage
from enum import StrEnum
from html import escape
from typing import Protocol

from silo.config import Settings, SiloEnvironment

logger = logging.getLogger(__name__)


class OtpPurpose(StrEnum):
    SIGN_IN = "sign-in"
    EMAIL_VERIFICATION = "email-verification"
    FORGET_PASSWORD = "forget-password"


@dataclass(frozen=True, slots=True)
class RenderedEmail:
    subject: str
    html: str
    text: str


class OtpEmailSender(Protocol):
    def send_otp(self, *, recipient: str, otp: str, purpose: OtpPurpose) -> None: ...


@dataclass(frozen=True, slots=True)
class SmtpOtpEmailSender:
    settings: Settings

    def send_otp(self, *, recipient: str, otp: str, purpose: OtpPurpose) -> None:
        template = render_otp_email(
            otp=otp,
            purpose=purpose,
            setup_password_url=_setup_password_url(self.settings),
        )
        if self.settings.smtp.host:
            _send_smtp(settings=self.settings, recipient=recipient, template=template)
            return

        if self.settings.auth_dev_log_otp:
            logger.info(
                "OTP generated for development environment",
                extra={
                    "context": {
                        "recipient": _redact_email(recipient),
                        "purpose": purpose.value,
                        "otp": _redact_otp(otp),
                    }
                },
            )
            return

        raise RuntimeError("SMTP não configurado para envio de OTP.")


def render_otp_email(
    *,
    otp: str,
    purpose: OtpPurpose,
    setup_password_url: str = "http://localhost:3000/silo/setup-password",
) -> RenderedEmail:
    subject = _subject_for_purpose(purpose)
    text = _text_for_purpose(otp=otp, purpose=purpose)
    html = _html_template(
        title=subject,
        text=text,
        otp=otp,
        setup_password_url=setup_password_url,
    )
    return RenderedEmail(subject=subject, html=html, text=text)


def _send_smtp(*, settings: Settings, recipient: str, template: RenderedEmail) -> None:
    message = EmailMessage()
    message["Subject"] = template.subject
    message["From"] = settings.smtp.from_address
    message["To"] = recipient
    message.set_content(template.text)
    message.add_alternative(template.html, subtype="html")

    smtp_class = smtplib.SMTP_SSL if settings.smtp.secure else smtplib.SMTP
    with smtp_class(settings.smtp.host, settings.smtp.port, timeout=20) as smtp:
        if _should_starttls(settings):
            smtp.starttls()
        if settings.smtp.username:
            smtp.login(settings.smtp.username, settings.smtp.password.get_secret_value())
        smtp.send_message(message)


def _should_starttls(settings: Settings) -> bool:
    if settings.smtp.secure:
        return False
    host = settings.smtp.host.lower()
    if host in {"localhost", "127.0.0.1", "::1"}:
        return False
    return settings.smtp.port == 587


def _subject_for_purpose(purpose: OtpPurpose) -> str:
    match purpose:
        case OtpPurpose.SIGN_IN:
            return "Seu código de login"
        case OtpPurpose.EMAIL_VERIFICATION:
            return "Código de verificação"
        case OtpPurpose.FORGET_PASSWORD:
            return "Código para redefinir sua senha"


def _text_for_purpose(*, otp: str, purpose: OtpPurpose) -> str:
    match purpose:
        case OtpPurpose.SIGN_IN:
            return f"Utilize o seguinte código de verificação para fazer login: {otp}"
        case OtpPurpose.EMAIL_VERIFICATION:
            return f"Utilize o seguinte código de verificação para verificar seu e-mail: {otp}"
        case OtpPurpose.FORGET_PASSWORD:
            return f"Utilize o seguinte código de verificação para recuperar sua senha: {otp}"


def _html_template(*, title: str, text: str, otp: str, setup_password_url: str) -> str:
    safe_title = escape(title)
    safe_text = escape(text)
    safe_otp = escape(otp)
    safe_setup_url = escape(setup_password_url)
    setup_password_link = (
        f'<p><a href="{safe_setup_url}">Definir minha senha</a></p>'
        f'<p><a href="{safe_setup_url}">{safe_setup_url}</a></p>'
        if "recuperar sua senha" in text
        else ""
    )
    return (
        "<!doctype html>"
        "<html><body>"
        f"<h1>{safe_title}</h1>"
        f"<p>{safe_text}</p>"
        f'<p><strong style="font-size:24px;letter-spacing:4px">{safe_otp}</strong></p>'
        f"{setup_password_link}"
        "<p>Se você não solicitou este código, ignore este e-mail.</p>"
        "</body></html>"
    )


def _setup_password_url(settings: Settings) -> str:
    base = (
        settings.app_url_prod
        if settings.silo_env is SiloEnvironment.PRODUCTION and settings.app_url_prod
        else settings.app_url_dev
    )
    return f"{base}{settings.public_base_path}/setup-password"


def _redact_email(email: str) -> str:
    local, separator, domain = email.partition("@")
    if not separator:
        return "<invalid-email>"
    return f"{local[:2]}***@{domain}"


def _redact_otp(otp: str) -> str:
    return f"{otp[:2]}****" if len(otp) >= 2 else "****"
