from __future__ import annotations

import secrets
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import Request, Response
from sqlalchemy import and_, delete, insert, select, update
from sqlalchemy.engine import Connection, RowMapping

from silo.clock import SYSTEM_CLOCK, Clock, new_id
from silo.config import Settings, SiloEnvironment
from silo.db.models import legacy_tables
from silo.db.serialization import LEGACY_OPERATIONAL_TIMEZONE, serialize_legacy_timestamp

SESSION_COOKIE_NAME = "silo_session"
BETTER_AUTH_COOKIE_NAMES = (
    "better-auth.session_token",
    "__Secure-better-auth.session_token",
)
BETTER_AUTH_CLEAR_COOKIE_NAMES = (
    "better-auth.session_token",
    "__Secure-better-auth.session_token",
    "better-auth.session_data",
    "__Secure-better-auth.session_data",
    "better-auth.oauth_state",
    "__Secure-better-auth.oauth_state",
    "better-auth.dont_remember",
    "__Secure-better-auth.dont_remember",
)
SESSION_MAX_AGE_SECONDS = 365 * 24 * 60 * 60
SESSION_SLIDING_UPDATE_SECONDS = 24 * 60 * 60


@dataclass(frozen=True, slots=True)
class AuthenticatedSession:
    session_id: str
    token: str
    expires_at: datetime
    created_at: datetime
    updated_at: datetime
    ip_address: str | None
    user_agent: str | None
    user_id: str
    user_name: str
    user_email: str
    user_email_verified: bool
    user_image: str | None
    user_created_at: datetime
    user_updated_at: datetime

    def to_get_session_payload(self) -> dict[str, object]:
        return {
            "session": {
                "expiresAt": serialize_legacy_timestamp(self.expires_at),
                "token": self.token,
                "createdAt": serialize_legacy_timestamp(self.created_at),
                "updatedAt": serialize_legacy_timestamp(self.updated_at),
                "ipAddress": self.ip_address,
                "userAgent": self.user_agent,
                "userId": self.user_id,
                "id": self.session_id,
            },
            "user": {
                "name": self.user_name,
                "email": self.user_email,
                "emailVerified": self.user_email_verified,
                "image": self.user_image,
                "createdAt": serialize_legacy_timestamp(self.user_created_at),
                "updatedAt": serialize_legacy_timestamp(self.user_updated_at),
                "id": self.user_id,
            },
        }


def legacy_local_now(clock: Clock = SYSTEM_CLOCK) -> datetime:
    return clock.now().astimezone(ZoneInfo(LEGACY_OPERATIONAL_TIMEZONE)).replace(tzinfo=None)


def extract_session_token(request: Request) -> str | None:
    return extract_session_token_from_cookies(request.cookies)


def extract_session_token_from_cookies(cookies: Mapping[str, str]) -> str | None:
    silo_token = cookies.get(SESSION_COOKIE_NAME)
    if _usable_token(silo_token):
        return silo_token

    for cookie_name in BETTER_AUTH_COOKIE_NAMES:
        token = cookies.get(cookie_name)
        if _usable_token(token):
            return token
    return None


def get_session_by_token(
    connection: Connection,
    token: str,
    *,
    clock: Clock = SYSTEM_CLOCK,
    refresh_sliding: bool = True,
) -> AuthenticatedSession | None:
    now = legacy_local_now(clock)
    clean_expired_sessions(connection, now=now)
    row = _fetch_active_session_row(connection, token, now=now)
    if row is None:
        _commit_if_possible(connection)
        return None

    session = _session_from_row(row)
    if refresh_sliding and session.updated_at <= now - timedelta(
        seconds=SESSION_SLIDING_UPDATE_SECONDS
    ):
        refreshed_expires_at = now + timedelta(seconds=SESSION_MAX_AGE_SECONDS)
        session_table = legacy_tables["session"]
        connection.execute(
            update(session_table)
            .where(session_table.c.id == session.session_id)
            .values(updated_at=now, expires_at=refreshed_expires_at)
        )
        _commit_if_possible(connection)
        return AuthenticatedSession(
            session_id=session.session_id,
            token=session.token,
            expires_at=refreshed_expires_at,
            created_at=session.created_at,
            updated_at=now,
            ip_address=session.ip_address,
            user_agent=session.user_agent,
            user_id=session.user_id,
            user_name=session.user_name,
            user_email=session.user_email,
            user_email_verified=session.user_email_verified,
            user_image=session.user_image,
            user_created_at=session.user_created_at,
            user_updated_at=session.user_updated_at,
        )

    _commit_if_possible(connection)
    return session


def create_session(
    connection: Connection,
    *,
    user_id: str,
    ip_address: str | None,
    user_agent: str | None,
    clock: Clock = SYSTEM_CLOCK,
) -> AuthenticatedSession:
    now = legacy_local_now(clock)
    session_table = legacy_tables["session"]
    session_id = new_id()
    token = secrets.token_urlsafe(32)
    expires_at = now + timedelta(seconds=SESSION_MAX_AGE_SECONDS)
    connection.execute(
        insert(session_table).values(
            id=session_id,
            expires_at=expires_at,
            token=token,
            created_at=now,
            updated_at=now,
            ip_address=ip_address,
            user_agent=user_agent,
            user_id=user_id,
        )
    )
    row = _fetch_active_session_row(connection, token, now=now)
    if row is None:
        raise RuntimeError("session row was not readable after insertion")
    _commit_if_possible(connection)
    return _session_from_row(row)


def clear_session_token(connection: Connection, token: str | None) -> None:
    if not token:
        return
    session_table = legacy_tables["session"]
    connection.execute(delete(session_table).where(session_table.c.token == token))
    _commit_if_possible(connection)


def clean_expired_sessions(connection: Connection, *, now: datetime | None = None) -> None:
    session_table = legacy_tables["session"]
    threshold = now if now is not None else legacy_local_now()
    connection.execute(delete(session_table).where(session_table.c.expires_at <= threshold))


def set_session_cookie(response: Response, token: str, settings: Settings) -> None:
    response.headers.append(
        "Set-Cookie",
        _cookie_header(
            SESSION_COOKIE_NAME,
            token,
            max_age=SESSION_MAX_AGE_SECONDS,
            secure=settings.silo_env is SiloEnvironment.PRODUCTION,
        ),
    )


def clear_auth_cookies(response: Response, settings: Settings) -> None:
    secure = settings.silo_env is SiloEnvironment.PRODUCTION
    for cookie_name in (SESSION_COOKIE_NAME, *BETTER_AUTH_CLEAR_COOKIE_NAMES):
        response.headers.append(
            "Set-Cookie",
            _cookie_header(cookie_name, "", max_age=0, secure=secure, expires_epoch=True),
        )


def request_ip(request: Request) -> str:
    state_ip = getattr(request.state, "client_ip", None)
    if isinstance(state_ip, str) and state_ip:
        return state_ip
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def request_user_agent(request: Request) -> str | None:
    user_agent = request.headers.get("user-agent")
    return user_agent if user_agent else None


def _fetch_active_session_row(
    connection: Connection, token: str, *, now: datetime
) -> RowMapping | None:
    session_table = legacy_tables["session"]
    user_table = legacy_tables["user"]
    return (
        connection.execute(
            select(
                session_table.c.id.label("session_id"),
                session_table.c.token,
                session_table.c.expires_at,
                session_table.c.created_at,
                session_table.c.updated_at,
                session_table.c.ip_address,
                session_table.c.user_agent,
                session_table.c.user_id,
                user_table.c.name.label("user_name"),
                user_table.c.email.label("user_email"),
                user_table.c.email_verified.label("user_email_verified"),
                user_table.c.image.label("user_image"),
                user_table.c.created_at.label("user_created_at"),
                user_table.c.updated_at.label("user_updated_at"),
            )
            .select_from(session_table.join(user_table, user_table.c.id == session_table.c.user_id))
            .where(
                and_(
                    session_table.c.token == token,
                    session_table.c.expires_at > now,
                    user_table.c.is_active.is_(True),
                )
            )
        )
        .mappings()
        .first()
    )


def _session_from_row(row: RowMapping) -> AuthenticatedSession:
    values = dict(row)
    return AuthenticatedSession(
        session_id=str(values["session_id"]),
        token=str(values["token"]),
        expires_at=_datetime(values["expires_at"]),
        created_at=_datetime(values["created_at"]),
        updated_at=_datetime(values["updated_at"]),
        ip_address=_optional_str(values["ip_address"]),
        user_agent=_optional_str(values["user_agent"]),
        user_id=str(values["user_id"]),
        user_name=str(values["user_name"]),
        user_email=str(values["user_email"]),
        user_email_verified=bool(values["user_email_verified"]),
        user_image=_optional_str(values["user_image"]),
        user_created_at=_datetime(values["user_created_at"]),
        user_updated_at=_datetime(values["user_updated_at"]),
    )


def _datetime(value: object) -> datetime:
    if not isinstance(value, datetime):
        raise TypeError(f"expected datetime, got {type(value).__name__}")
    if value.tzinfo is not None:
        return value.astimezone(UTC).replace(tzinfo=None)
    return value


def _optional_str(value: object) -> str | None:
    return value if isinstance(value, str) else None


def _usable_token(value: str | None) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _cookie_header(
    name: str,
    value: str,
    *,
    max_age: int,
    secure: bool,
    expires_epoch: bool = False,
) -> str:
    parts = [f"{name}={value}", f"Max-Age={max_age}"]
    if expires_epoch:
        parts.append("Expires=Thu, 01 Jan 1970 00:00:00 GMT")
    parts.extend(("Path=/", "HttpOnly", "SameSite=Lax"))
    if secure:
        parts.append("Secure")
    return "; ".join(parts)


def _commit_if_possible(connection: Connection) -> None:
    if getattr(connection, "closed", False):
        return
    connection.commit()
