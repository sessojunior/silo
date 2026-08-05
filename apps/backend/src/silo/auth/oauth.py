from __future__ import annotations

import secrets
import warnings
from dataclasses import dataclass
from datetime import timedelta
from urllib.parse import urlencode

import httpx
from authlib.integrations.httpx_client import OAuth2Client  # type: ignore[import-untyped]
from authlib.oidc.core import CodeIDToken  # type: ignore[import-untyped]
from fastapi import Request, Response
from sqlalchemy import and_, delete, insert, select, update
from sqlalchemy.engine import Connection

from silo.auth.sessions import AuthenticatedSession, create_session, legacy_local_now
from silo.clock import SYSTEM_CLOCK, Clock
from silo.config import Settings
from silo.db.models import legacy_tables

GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_JWKS_ENDPOINT = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_SCOPES = "openid email profile"
OAUTH_STATE_COOKIE_NAME = "silo_oauth_state"
POST_LOGIN_REDIRECT_PATH = "/admin/dashboard"


@dataclass(frozen=True, slots=True)
class GoogleLoginStart:
    authorization_url: str
    state: str
    nonce: str


@dataclass(frozen=True, slots=True)
class GoogleState:
    nonce: str
    from_page: str


@dataclass(frozen=True, slots=True)
class GoogleIdentity:
    sub: str
    email: str
    email_verified: bool
    name: str
    picture: str | None


def build_google_login_start(
    connection: Connection,
    *,
    settings: Settings,
    request: Request,
    response: Response,
    from_page: str | None,
    clock: Clock = SYSTEM_CLOCK,
) -> GoogleLoginStart:
    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    now = legacy_local_now(clock)
    verification_table = legacy_tables["verification"]
    identifier = _state_identifier(state)
    connection.execute(
        delete(verification_table).where(verification_table.c.identifier == identifier)
    )
    connection.execute(
        insert(verification_table).values(
            id=secrets.token_urlsafe(16),
            identifier=identifier,
            value=f"{nonce}:{_safe_from_page(from_page)}",
            expires_at=now + timedelta(minutes=10),
            created_at=now,
            updated_at=now,
        )
    )
    connection.commit()
    response.headers.append(
        "Set-Cookie",
        f"{OAUTH_STATE_COOKIE_NAME}={state}; Max-Age=600; Path=/; HttpOnly; SameSite=Lax",
    )
    callback_url = str(request.url_for("google_callback"))
    params = {
        "client_id": settings.google.client_id,
        "redirect_uri": callback_url,
        "response_type": "code",
        "scope": GOOGLE_SCOPES,
        "state": state,
        "nonce": nonce,
        "prompt": "select_account",
    }
    return GoogleLoginStart(
        authorization_url=f"{GOOGLE_AUTHORIZATION_ENDPOINT}?{urlencode(params)}",
        state=state,
        nonce=nonce,
    )


def consume_google_state(
    connection: Connection,
    *,
    state: str,
    clock: Clock = SYSTEM_CLOCK,
) -> GoogleState | None:
    verification_table = legacy_tables["verification"]
    now = legacy_local_now(clock)
    identifier = _state_identifier(state)
    row = (
        connection.execute(
            select(verification_table.c.id, verification_table.c.value).where(
                verification_table.c.identifier == identifier,
                verification_table.c.expires_at > now,
            )
        )
        .mappings()
        .first()
    )
    if row is None:
        return None
    connection.execute(delete(verification_table).where(verification_table.c.id == row["id"]))
    connection.commit()
    value = str(row["value"])
    nonce, _, from_page = value.partition(":")
    return GoogleState(nonce=nonce, from_page=from_page)


def complete_google_callback(
    connection: Connection,
    *,
    settings: Settings,
    code: str,
    state: GoogleState,
    callback_url: str,
    ip_address: str | None,
    user_agent: str | None,
    clock: Clock = SYSTEM_CLOCK,
) -> AuthenticatedSession:
    token = exchange_google_code_for_token(
        settings=settings,
        code=code,
        callback_url=callback_url,
    )
    identity = validate_google_identity(
        settings=settings,
        token=token,
        expected_nonce=state.nonce,
    )
    if not identity.email_verified:
        raise ValueError("google account email is not verified")

    user_id = _find_or_create_google_user(
        connection,
        settings=settings,
        identity=identity,
        token=token,
        clock=clock,
    )
    return create_session(
        connection,
        user_id=user_id,
        ip_address=ip_address,
        user_agent=user_agent,
        clock=clock,
    )


def exchange_google_code_for_token(
    *,
    settings: Settings,
    code: str,
    callback_url: str,
) -> dict[str, object]:
    client = OAuth2Client(
        settings.google.client_id,
        settings.google.client_secret.get_secret_value(),
        redirect_uri=callback_url,
        scope=GOOGLE_SCOPES,
    )
    return dict(
        client.fetch_token(
            GOOGLE_TOKEN_ENDPOINT,
            grant_type="authorization_code",
            code=code,
        )
    )


def validate_google_identity(
    *,
    settings: Settings,
    token: dict[str, object],
    expected_nonce: str,
) -> GoogleIdentity:
    id_token = token.get("id_token")
    if not isinstance(id_token, str) or not id_token:
        raise ValueError("google token response did not include id_token")

    warnings.filterwarnings("ignore", message="authlib.jose module is deprecated.*")
    from authlib.jose import JsonWebKey, jwt  # type: ignore[import-untyped]

    jwks = httpx.get(GOOGLE_JWKS_ENDPOINT, timeout=10).json()
    key_set = JsonWebKey.import_key_set(jwks)
    claims = jwt.decode(
        id_token,
        key_set,
        claims_cls=CodeIDToken,
        claims_options={
            "iss": {"values": ["https://accounts.google.com", "accounts.google.com"]},
            "aud": {"values": [settings.google.client_id]},
        },
    )
    claims.validate(leeway=60)
    if claims.get("nonce") != expected_nonce:
        raise ValueError("google id_token nonce mismatch")

    sub = claims.get("sub")
    email = claims.get("email")
    if not isinstance(sub, str) or not sub:
        raise ValueError("google id_token missing sub")
    if not isinstance(email, str) or not email:
        raise ValueError("google id_token missing email")
    name = claims.get("name")
    picture = claims.get("picture")
    return GoogleIdentity(
        sub=sub,
        email=email.strip().lower(),
        email_verified=claims.get("email_verified") is True,
        name=name if isinstance(name, str) and name else email,
        picture=picture if isinstance(picture, str) and picture else None,
    )


def google_credentials_configured(settings: Settings) -> bool:
    return bool(settings.google.client_id and settings.google.client_secret.get_secret_value())


def should_use_legacy_contract_google_response(settings: Settings) -> bool:
    return settings.google.client_id == "contract-google-client"


def app_redirect_url(settings: Settings, path: str = POST_LOGIN_REDIRECT_PATH) -> str:
    base = settings.app_url_prod if settings.app_url_prod else settings.app_url_dev
    public_base_path = settings.public_base_path
    normalized_path = path if path.startswith("/") else f"/{path}"
    return f"{base}{public_base_path}{normalized_path}"


def _find_or_create_google_user(
    connection: Connection,
    *,
    settings: Settings,
    identity: GoogleIdentity,
    token: dict[str, object],
    clock: Clock,
) -> str:
    _ensure_allowed_google_domain(settings, identity.email)
    account_table = legacy_tables["account"]
    existing_account = (
        connection.execute(
            select(account_table.c.user_id).where(
                and_(
                    account_table.c.provider_id == "google",
                    account_table.c.account_id == identity.sub,
                )
            )
        )
        .mappings()
        .first()
    )
    now = legacy_local_now(clock)
    if existing_account is not None:
        user_id = str(existing_account["user_id"])
        _update_google_account_tokens(
            connection,
            user_id=user_id,
            identity=identity,
            token=token,
            now=now,
        )
        return user_id

    user_table = legacy_tables["user"]
    user = (
        connection.execute(select(user_table.c.id).where(user_table.c.email == identity.email))
        .mappings()
        .first()
    )
    if user is None:
        user_id = secrets.token_urlsafe(16)
        connection.execute(
            insert(user_table).values(
                id=user_id,
                name=identity.name,
                email=identity.email,
                email_verified=True,
                image=identity.picture,
                created_at=now,
                updated_at=now,
                is_active=True,
                last_login=None,
            )
        )
        _ensure_default_group(connection, user_id=user_id, now=now)
    else:
        user_id = str(user["id"])
        connection.execute(
            update(user_table)
            .where(user_table.c.id == user_id)
            .values(
                email_verified=True,
                is_active=True,
                image=identity.picture,
                updated_at=now,
            )
        )

    _insert_google_account(connection, user_id=user_id, identity=identity, token=token, now=now)
    return user_id


def _insert_google_account(
    connection: Connection,
    *,
    user_id: str,
    identity: GoogleIdentity,
    token: dict[str, object],
    now: object,
) -> None:
    account_table = legacy_tables["account"]
    connection.execute(
        insert(account_table).values(
            id=secrets.token_urlsafe(16),
            account_id=identity.sub,
            provider_id="google",
            user_id=user_id,
            access_token=_optional_token_str(token.get("access_token")),
            refresh_token=_optional_token_str(token.get("refresh_token")),
            id_token=_optional_token_str(token.get("id_token")),
            access_token_expires_at=None,
            refresh_token_expires_at=None,
            scope=_optional_token_str(token.get("scope")),
            password=None,
            created_at=now,
            updated_at=now,
        )
    )


def _update_google_account_tokens(
    connection: Connection,
    *,
    user_id: str,
    identity: GoogleIdentity,
    token: dict[str, object],
    now: object,
) -> None:
    account_table = legacy_tables["account"]
    connection.execute(
        update(account_table)
        .where(
            and_(
                account_table.c.user_id == user_id,
                account_table.c.provider_id == "google",
            )
        )
        .values(
            account_id=identity.sub,
            access_token=_optional_token_str(token.get("access_token")),
            refresh_token=_optional_token_str(token.get("refresh_token")),
            id_token=_optional_token_str(token.get("id_token")),
            scope=_optional_token_str(token.get("scope")),
            updated_at=now,
        )
    )


def _ensure_default_group(connection: Connection, *, user_id: str, now: object) -> None:
    group_table = legacy_tables["group"]
    user_group_table = legacy_tables["user_group"]
    default_group = (
        connection.execute(
            select(group_table.c.id)
            .where(group_table.c.is_default.is_(True))
            .order_by(group_table.c.updated_at.desc())
            .limit(1)
        )
        .mappings()
        .first()
    )
    if default_group is None:
        raise ValueError("default group is not configured")
    connection.execute(
        insert(user_group_table).values(
            id=secrets.token_urlsafe(16),
            user_id=user_id,
            group_id=default_group["id"],
            joined_at=now,
            created_at=now,
        )
    )


def _ensure_allowed_google_domain(settings: Settings, email: str) -> None:
    if not settings.allowed_email_domains:
        return
    domain = email.rsplit("@", maxsplit=1)[-1].lower()
    if domain not in {allowed.lower() for allowed in settings.allowed_email_domains}:
        raise ValueError("google account domain is not allowed")


def _optional_token_str(value: object) -> str | None:
    return value if isinstance(value, str) and value else None


def _state_identifier(state: str) -> str:
    return f"silo:oauth:google:state:{state}"


def _safe_from_page(value: str | None) -> str:
    if value in {"login", "register"}:
        return value
    return "login"
