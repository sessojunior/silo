from __future__ import annotations

import logging
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage

from silo.config import Settings, load_settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class PlainEmail:
    subject: str
    text: str


def send_plain_email(*, to: str, subject: str, text: str, settings: Settings | None = None) -> None:
    current_settings = settings or load_settings()
    if not current_settings.smtp.host:
        logger.info(
            "Email not sent because SMTP is not configured",
            extra={"context": {"to": to, "subject": subject}},
        )
        return

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = current_settings.smtp.from_address
    message["To"] = to
    message.set_content(text)

    smtp_class = smtplib.SMTP_SSL if current_settings.smtp.secure else smtplib.SMTP
    try:
        with smtp_class(current_settings.smtp.host, current_settings.smtp.port, timeout=20) as smtp:
            if _should_starttls(current_settings):
                smtp.starttls()
            if current_settings.smtp.username:
                smtp.login(
                    current_settings.smtp.username,
                    current_settings.smtp.password.get_secret_value(),
                )
            smtp.send_message(message)
    except Exception as exc:  # pragma: no cover - best effort notification
        logger.warning(
            "Failed to send email",
            extra={"context": {"to": to, "subject": subject, "error": str(exc)}},
        )


def _should_starttls(settings: Settings) -> bool:
    if settings.smtp.secure:
        return False
    host = settings.smtp.host.lower()
    if host in {"localhost", "127.0.0.1", "::1"}:
        return False
    return settings.smtp.port == 587
