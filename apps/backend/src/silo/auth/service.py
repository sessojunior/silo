from __future__ import annotations

import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import timedelta
from enum import StrEnum
from uuid import uuid4

from sqlalchemy import and_, delete, insert, select, update
from sqlalchemy.engine import Connection

from silo.api.errors import ApiError, InfrastructureUnavailableError
from silo.api.rate_limit import (
    clear_auth_rate_limit_for_email,
    get_auth_rate_limit_status,
    record_auth_rate_limit,
)
from silo.auth.email import OtpEmailSender, OtpPurpose
from silo.auth.password import hash_legacy_bcrypt, verify_legacy_bcrypt
from silo.auth.sessions import (
    AuthenticatedSession,
    create_session,
    legacy_local_now,
)
from silo.auth.validation import (
    ALLOWED_DOMAIN_ERROR,
    AuthInputError,
    ensure_allowed_email_domain,
)
from silo.clock import SYSTEM_CLOCK, Clock
from silo.config import Settings
from silo.db.models import legacy_tables

OTP_MAX_ATTEMPTS = 5
AUTH_OTP_RESEND_COOLDOWN_SECONDS = 90
AUTH_OTP_LOCKOUT_SECONDS = 15 * 60
AUTH_INVALID_EMAIL_MAX_ATTEMPTS = 10
AUTH_INVALID_EMAIL_WINDOW_SECONDS = 10 * 60
AUTH_INVALID_CREDENTIALS_MAX_ATTEMPTS = 5
AUTH_INVALID_CREDENTIALS_WINDOW_SECONDS = 15 * 60
FORGET_PASSWORD_COOLDOWN_SECONDS = 90
FORGET_PASSWORD_BURST_LIMIT = 1
SIGN_UP_COOLDOWN_SECONDS = 90
SIGN_UP_BURST_LIMIT = 8
SIGN_UP_BURST_WINDOW_SECONDS = 10 * 60

LOGIN_PASSWORD_ROUTE = "login-password"
LOGIN_EMAIL_SEND_OTP_COOLDOWN_ROUTE = "login-email-send-otp-cooldown"
LOGIN_EMAIL_WRONG_EMAIL_ROUTE = "login-email-wrong-email"
LOGIN_EMAIL_VERIFY_LOCKOUT_ROUTE = "login-email-verify-otp-lockout"
FORGET_PASSWORD_SEND_OTP_COOLDOWN_ROUTE = "forget-password-send-otp-cooldown"
FORGET_PASSWORD_WRONG_EMAIL_ROUTE = "forget-password-wrong-email"
FORGET_PASSWORD_VERIFY_LOCKOUT_ROUTE = "forget-password-verify-otp-lockout"
SIGN_UP_EMAIL_COOLDOWN_ROUTE = "sign-up-email-cooldown"
SIGN_UP_EMAIL_BURST_ROUTE = "sign-up-email-burst"
SIGN_UP_EMAIL_VERIFY_LOCKOUT_ROUTE = "sign-up-email-verification-verify-otp-lockout"

ALL_AUTH_RATE_LIMIT_ROUTES = (
    LOGIN_PASSWORD_ROUTE,
    LOGIN_EMAIL_SEND_OTP_COOLDOWN_ROUTE,
    LOGIN_EMAIL_WRONG_EMAIL_ROUTE,
    LOGIN_EMAIL_VERIFY_LOCKOUT_ROUTE,
    FORGET_PASSWORD_SEND_OTP_COOLDOWN_ROUTE,
    FORGET_PASSWORD_WRONG_EMAIL_ROUTE,
    FORGET_PASSWORD_VERIFY_LOCKOUT_ROUTE,
    SIGN_UP_EMAIL_COOLDOWN_ROUTE,
    SIGN_UP_EMAIL_BURST_ROUTE,
    SIGN_UP_EMAIL_VERIFY_LOCKOUT_ROUTE,
)


class OtpFlow(StrEnum):
    LOGIN_EMAIL = "login-email"
    SIGN_UP_EMAIL = "sign-up-email-verification"
    FORGET_PASSWORD = "forget-password"


@dataclass(frozen=True, slots=True)
class AuthService:
    connection: Connection
    settings: Settings
    email_sender: OtpEmailSender
    clock: Clock = SYSTEM_CLOCK

    def login_with_password(
        self,
        *,
        email: str,
        password: str,
        ip_address: str,
        user_agent: str | None,
    ) -> AuthenticatedSession:
        self._ensure_allowed_domain(email)
        limited = get_auth_rate_limit_status(
            self.connection,
            email=email,
            ip=ip_address,
            route=LOGIN_PASSWORD_ROUTE,
            limit=AUTH_INVALID_CREDENTIALS_MAX_ATTEMPTS,
            window_seconds=AUTH_INVALID_CREDENTIALS_WINDOW_SECONDS,
        )
        if limited.is_limited:
            raise ApiError(
                status_code=429,
                error="Aguarde para tentar novamente.",
                field="email",
                retry_after_seconds=limited.retry_after_seconds,
            )

        user = self._find_user_by_email(email)
        if user is None or not self._credential_password_matches(user["id"], password):
            self._record_limit(
                email=email,
                ip=ip_address,
                route=LOGIN_PASSWORD_ROUTE,
                window_seconds=AUTH_INVALID_CREDENTIALS_WINDOW_SECONDS,
            )
            raise ApiError(status_code=401, error="E-mail ou senha inválidos.", field="password")

        if not bool(user["is_active"]):
            raise ApiError(
                status_code=403,
                error="Usuário inativo. Contate o administrador.",
                field="email",
            )

        clear_auth_rate_limit_for_email(
            self.connection,
            email=email,
            routes=ALL_AUTH_RATE_LIMIT_ROUTES,
        )
        return create_session(
            self.connection,
            user_id=str(user["id"]),
            ip_address=ip_address,
            user_agent=user_agent,
            clock=self.clock,
        )

    def send_login_email_otp(self, *, email: str, ip_address: str) -> dict[str, int]:
        self._ensure_allowed_domain(email)
        user = self._find_user_by_email(email)
        if user is None:
            self._rate_limit_unknown_email(
                email=email, ip_address=ip_address, route=LOGIN_EMAIL_WRONG_EMAIL_ROUTE
            )
            raise ApiError(status_code=404, error="E-mail inexistente.", field="email")
        if not bool(user["is_active"]):
            raise ApiError(
                status_code=403,
                error="Usuário inativo. Contate o administrador.",
                field="email",
            )
        self._enforce_cooldown(
            email=email,
            ip_address=ip_address,
            route=LOGIN_EMAIL_SEND_OTP_COOLDOWN_ROUTE,
            cooldown_seconds=AUTH_OTP_RESEND_COOLDOWN_SECONDS,
        )
        self._store_and_send_otp(email=email, flow=OtpFlow.LOGIN_EMAIL, purpose=OtpPurpose.SIGN_IN)
        self._record_limit(
            email=email,
            ip=ip_address,
            route=LOGIN_EMAIL_SEND_OTP_COOLDOWN_ROUTE,
            window_seconds=AUTH_OTP_RESEND_COOLDOWN_SECONDS,
        )
        return {"cooldownSeconds": AUTH_OTP_RESEND_COOLDOWN_SECONDS}

    def verify_login_email_otp(
        self,
        *,
        email: str,
        code: str,
        ip_address: str,
        user_agent: str | None,
    ) -> AuthenticatedSession:
        self._ensure_allowed_domain(email)
        self._enforce_lockout(
            email=email, ip_address=ip_address, route=LOGIN_EMAIL_VERIFY_LOCKOUT_ROUTE
        )
        user = self._find_user_by_email(email)
        if user is None:
            raise ApiError(status_code=404, error="E-mail inexistente.", field="email")
        if not bool(user["is_active"]):
            raise ApiError(
                status_code=403,
                error="Usuário inativo. Contate o administrador.",
                field="email",
            )
        if not self._consume_valid_otp(email=email, code=code, flow=OtpFlow.LOGIN_EMAIL):
            self._record_otp_attempt_or_lockout(
                email=email,
                ip_address=ip_address,
                flow=OtpFlow.LOGIN_EMAIL,
                lockout_route=LOGIN_EMAIL_VERIFY_LOCKOUT_ROUTE,
            )
            raise ApiError(status_code=400, error="Código inválido.", field="code")
        self._clear_otp_attempts(email=email, flow=OtpFlow.LOGIN_EMAIL)
        clear_auth_rate_limit_for_email(
            self.connection, email=email, routes=ALL_AUTH_RATE_LIMIT_ROUTES
        )
        return create_session(
            self.connection,
            user_id=str(user["id"]),
            ip_address=ip_address,
            user_agent=user_agent,
            clock=self.clock,
        )

    def create_sign_up_email(
        self,
        *,
        name: str,
        email: str,
        password: str,
        ip_address: str,
    ) -> dict[str, int]:
        self._ensure_allowed_domain(email)
        self._enforce_cooldown(
            email=email,
            ip_address=ip_address,
            route=SIGN_UP_EMAIL_COOLDOWN_ROUTE,
            cooldown_seconds=SIGN_UP_COOLDOWN_SECONDS,
        )
        self._enforce_burst(
            email=email,
            ip_address=ip_address,
            route=SIGN_UP_EMAIL_BURST_ROUTE,
            limit=SIGN_UP_BURST_LIMIT,
            window_seconds=SIGN_UP_BURST_WINDOW_SECONDS,
        )
        if self._find_user_by_email(email) is not None:
            raise ApiError(
                status_code=400,
                error="Este e-mail já está em uso. Use outro e-mail.",
                field="email",
            )

        now = legacy_local_now(self.clock)
        user_id = str(uuid4())
        user_table = legacy_tables["user"]
        account_table = legacy_tables["account"]
        self.connection.execute(
            insert(user_table).values(
                id=user_id,
                name=name,
                email=email,
                email_verified=False,
                image=None,
                created_at=now,
                updated_at=now,
                is_active=False,
                last_login=None,
            )
        )
        self.connection.execute(
            insert(account_table).values(
                id=str(uuid4()),
                account_id=user_id,
                provider_id="credential",
                user_id=user_id,
                access_token=None,
                refresh_token=None,
                id_token=None,
                access_token_expires_at=None,
                refresh_token_expires_at=None,
                scope=None,
                password=hash_legacy_bcrypt(password),
                created_at=now,
                updated_at=now,
            )
        )
        self._store_and_send_otp(
            email=email,
            flow=OtpFlow.SIGN_UP_EMAIL,
            purpose=OtpPurpose.EMAIL_VERIFICATION,
        )
        self._record_limit(
            email=email,
            ip=ip_address,
            route=SIGN_UP_EMAIL_COOLDOWN_ROUTE,
            window_seconds=SIGN_UP_COOLDOWN_SECONDS,
        )
        self._record_limit(
            email=email,
            ip=ip_address,
            route=SIGN_UP_EMAIL_BURST_ROUTE,
            window_seconds=SIGN_UP_BURST_WINDOW_SECONDS,
        )
        self.connection.commit()
        return {"cooldownSeconds": SIGN_UP_COOLDOWN_SECONDS}

    def send_sign_up_email_otp(self, *, email: str, ip_address: str) -> dict[str, int]:
        self._ensure_allowed_domain(email)
        user = self._find_user_by_email(email)
        if user is None:
            raise ApiError(status_code=404, error="E-mail inexistente.", field="email")
        self._enforce_cooldown(
            email=email,
            ip_address=ip_address,
            route=SIGN_UP_EMAIL_COOLDOWN_ROUTE,
            cooldown_seconds=SIGN_UP_COOLDOWN_SECONDS,
        )
        self._store_and_send_otp(
            email=email,
            flow=OtpFlow.SIGN_UP_EMAIL,
            purpose=OtpPurpose.EMAIL_VERIFICATION,
        )
        self._record_limit(
            email=email,
            ip=ip_address,
            route=SIGN_UP_EMAIL_COOLDOWN_ROUTE,
            window_seconds=SIGN_UP_COOLDOWN_SECONDS,
        )
        return {"cooldownSeconds": SIGN_UP_COOLDOWN_SECONDS}

    def verify_sign_up_email_otp(
        self,
        *,
        email: str,
        code: str,
        password: str | None,
        auto_sign_in: bool,
        ip_address: str,
        user_agent: str | None,
    ) -> AuthenticatedSession | None:
        self._ensure_allowed_domain(email)
        self._enforce_lockout(
            email=email, ip_address=ip_address, route=SIGN_UP_EMAIL_VERIFY_LOCKOUT_ROUTE
        )
        user = self._find_user_by_email(email)
        if user is None:
            raise ApiError(status_code=404, error="E-mail inexistente.", field="email")
        if not self._consume_valid_otp(email=email, code=code, flow=OtpFlow.SIGN_UP_EMAIL):
            self._record_otp_attempt_or_lockout(
                email=email,
                ip_address=ip_address,
                flow=OtpFlow.SIGN_UP_EMAIL,
                lockout_route=SIGN_UP_EMAIL_VERIFY_LOCKOUT_ROUTE,
            )
            raise ApiError(status_code=400, error="Código inválido.", field="code")

        now = legacy_local_now(self.clock)
        user_table = legacy_tables["user"]
        self.connection.execute(
            update(user_table)
            .where(user_table.c.id == user["id"])
            .values(email_verified=True, is_active=True, updated_at=now)
        )
        if password is not None:
            self._upsert_credential_password(user_id=str(user["id"]), password=password, now=now)
        self._ensure_default_group(user_id=str(user["id"]), now=now)
        self._clear_otp_attempts(email=email, flow=OtpFlow.SIGN_UP_EMAIL)
        clear_auth_rate_limit_for_email(
            self.connection, email=email, routes=ALL_AUTH_RATE_LIMIT_ROUTES
        )
        if auto_sign_in:
            return create_session(
                self.connection,
                user_id=str(user["id"]),
                ip_address=ip_address,
                user_agent=user_agent,
                clock=self.clock,
            )
        self.connection.commit()
        return None

    def send_forget_password_otp(self, *, email: str, ip_address: str) -> dict[str, object]:
        self._ensure_allowed_domain(email)
        user = self._find_user_by_email(email)
        if user is None:
            self._rate_limit_unknown_email(
                email=email,
                ip_address=ip_address,
                route=FORGET_PASSWORD_WRONG_EMAIL_ROUTE,
            )
            raise ApiError(status_code=404, error="E-mail inexistente.", field="email")
        self._enforce_cooldown(
            email=email,
            ip_address=ip_address,
            route=FORGET_PASSWORD_SEND_OTP_COOLDOWN_ROUTE,
            cooldown_seconds=FORGET_PASSWORD_COOLDOWN_SECONDS,
        )
        self._store_and_send_otp(
            email=email,
            flow=OtpFlow.FORGET_PASSWORD,
            purpose=OtpPurpose.FORGET_PASSWORD,
        )
        self._record_limit(
            email=email,
            ip=ip_address,
            route=FORGET_PASSWORD_SEND_OTP_COOLDOWN_ROUTE,
            window_seconds=FORGET_PASSWORD_COOLDOWN_SECONDS,
        )
        return {
            "step": 2,
            "email": email,
            "cooldownSeconds": FORGET_PASSWORD_COOLDOWN_SECONDS,
        }

    def verify_forget_password_otp(self, *, email: str, code: str, ip_address: str) -> None:
        self._ensure_allowed_domain(email)
        self._enforce_lockout(
            email=email, ip_address=ip_address, route=FORGET_PASSWORD_VERIFY_LOCKOUT_ROUTE
        )
        if not self._consume_valid_otp(
            email=email,
            code=code,
            flow=OtpFlow.FORGET_PASSWORD,
            consume=False,
        ):
            self._record_otp_attempt_or_lockout(
                email=email,
                ip_address=ip_address,
                flow=OtpFlow.FORGET_PASSWORD,
                lockout_route=FORGET_PASSWORD_VERIFY_LOCKOUT_ROUTE,
            )
            raise ApiError(status_code=400, error="Código inválido.", field="code")
        self.connection.commit()

    def setup_password(
        self,
        *,
        email: str,
        code: str,
        password: str,
        auto_sign_in: bool,
        ip_address: str,
        user_agent: str | None,
    ) -> AuthenticatedSession | None:
        self._ensure_allowed_domain(email)
        user = self._find_user_by_email(email)
        if user is None:
            raise ApiError(status_code=404, error="E-mail inexistente.", field="email")

        attempts = self._otp_attempt_count(email=email, flow=OtpFlow.FORGET_PASSWORD)
        if attempts >= OTP_MAX_ATTEMPTS:
            raise ApiError(
                status_code=429,
                error="Excesso tentativas inválidas. Comece novamente.",
                field="code",
                reset_flow=True,
            )

        if not self._consume_valid_otp(email=email, code=code, flow=OtpFlow.FORGET_PASSWORD):
            next_attempts = self._increment_otp_attempts(email=email, flow=OtpFlow.FORGET_PASSWORD)
            if next_attempts >= OTP_MAX_ATTEMPTS:
                self.connection.commit()
                raise ApiError(
                    status_code=429,
                    error="Excesso tentativas inválidas. Comece novamente.",
                    field="code",
                    reset_flow=True,
                )
            self.connection.commit()
            raise ApiError(status_code=400, error="Código inválido.", field="code")

        now = legacy_local_now(self.clock)
        self._upsert_credential_password(user_id=str(user["id"]), password=password, now=now)
        user_table = legacy_tables["user"]
        self.connection.execute(
            update(user_table)
            .where(user_table.c.id == user["id"])
            .values(email_verified=True, is_active=True, updated_at=now)
        )
        self._ensure_default_group(user_id=str(user["id"]), now=now)
        self._clear_otp_attempts(email=email, flow=OtpFlow.FORGET_PASSWORD)
        clear_auth_rate_limit_for_email(
            self.connection, email=email, routes=ALL_AUTH_RATE_LIMIT_ROUTES
        )
        if auto_sign_in:
            return create_session(
                self.connection,
                user_id=str(user["id"]),
                ip_address=ip_address,
                user_agent=user_agent,
                clock=self.clock,
            )
        self.connection.commit()
        return None

    def _find_user_by_email(self, email: str) -> dict[str, object] | None:
        user_table = legacy_tables["user"]
        row = (
            self.connection.execute(
                select(
                    user_table.c.id,
                    user_table.c.name,
                    user_table.c.email,
                    user_table.c.email_verified,
                    user_table.c.is_active,
                ).where(user_table.c.email == email)
            )
            .mappings()
            .first()
        )
        return dict(row) if row is not None else None

    def _credential_password_matches(self, user_id: object, password: str) -> bool:
        account_table = legacy_tables["account"]
        row = (
            self.connection.execute(
                select(account_table.c.password).where(
                    and_(
                        account_table.c.user_id == str(user_id),
                        account_table.c.provider_id == "credential",
                    )
                )
            )
            .mappings()
            .first()
        )
        if row is None:
            return False
        return verify_legacy_bcrypt(password, str(row["password"]) if row["password"] else None)

    def _upsert_credential_password(self, *, user_id: str, password: str, now: object) -> None:
        account_table = legacy_tables["account"]
        existing = (
            self.connection.execute(
                select(account_table.c.id).where(
                    and_(
                        account_table.c.user_id == user_id,
                        account_table.c.provider_id == "credential",
                    )
                )
            )
            .mappings()
            .first()
        )
        password_hash = hash_legacy_bcrypt(password)
        if existing is None:
            self.connection.execute(
                insert(account_table).values(
                    id=str(uuid4()),
                    account_id=user_id,
                    provider_id="credential",
                    user_id=user_id,
                    access_token=None,
                    refresh_token=None,
                    id_token=None,
                    access_token_expires_at=None,
                    refresh_token_expires_at=None,
                    scope=None,
                    password=password_hash,
                    created_at=now,
                    updated_at=now,
                )
            )
            return
        self.connection.execute(
            update(account_table)
            .where(account_table.c.id == existing["id"])
            .values(password=password_hash, updated_at=now)
        )

    def _store_and_send_otp(self, *, email: str, flow: OtpFlow, purpose: OtpPurpose) -> None:
        otp = f"{secrets.randbelow(1_000_000):06d}"
        self._store_otp(email=email, flow=flow, otp=otp)
        try:
            self.email_sender.send_otp(recipient=email, otp=otp, purpose=purpose)
        except Exception as exc:
            raise InfrastructureUnavailableError(
                "Serviço de autenticação temporariamente indisponível."
            ) from exc

    def _store_otp(self, *, email: str, flow: OtpFlow, otp: str) -> None:
        verification_table = legacy_tables["verification"]
        now = legacy_local_now(self.clock)
        identifier = self._otp_identifier(email=email, flow=flow)
        self.connection.execute(
            delete(verification_table).where(verification_table.c.identifier == identifier)
        )
        self.connection.execute(
            insert(verification_table).values(
                id=str(uuid4()),
                identifier=identifier,
                value=self._otp_value(otp),
                expires_at=now + timedelta(minutes=10),
                created_at=now,
                updated_at=now,
            )
        )
        self._clear_otp_attempts(email=email, flow=flow)

    def _consume_valid_otp(
        self,
        *,
        email: str,
        code: str,
        flow: OtpFlow,
        consume: bool = True,
    ) -> bool:
        verification_table = legacy_tables["verification"]
        now = legacy_local_now(self.clock)
        identifier = self._otp_identifier(email=email, flow=flow)
        row = (
            self.connection.execute(
                select(verification_table.c.id, verification_table.c.value).where(
                    and_(
                        verification_table.c.identifier == identifier,
                        verification_table.c.expires_at > now,
                    )
                )
            )
            .mappings()
            .first()
        )
        if row is None or not self._verify_otp_value(code, str(row["value"])):
            return False
        if consume:
            self.connection.execute(
                delete(verification_table).where(verification_table.c.id == row["id"])
            )
        return True

    def _record_otp_attempt_or_lockout(
        self,
        *,
        email: str,
        ip_address: str,
        flow: OtpFlow,
        lockout_route: str,
    ) -> None:
        attempts = self._increment_otp_attempts(email=email, flow=flow)
        if attempts >= OTP_MAX_ATTEMPTS:
            self._record_limit(
                email=email,
                ip=ip_address,
                route=lockout_route,
                window_seconds=AUTH_OTP_LOCKOUT_SECONDS,
            )
            self.connection.commit()
            raise ApiError(
                status_code=429,
                error="Aguarde para reenviar o código.",
                field="code",
                retry_after_seconds=AUTH_OTP_LOCKOUT_SECONDS,
            )
        self.connection.commit()

    def _increment_otp_attempts(self, *, email: str, flow: OtpFlow) -> int:
        attempts = self._otp_attempt_count(email=email, flow=flow) + 1
        verification_table = legacy_tables["verification"]
        now = legacy_local_now(self.clock)
        identifier = self._attempts_identifier(email=email, flow=flow)
        self.connection.execute(
            delete(verification_table).where(verification_table.c.identifier == identifier)
        )
        self.connection.execute(
            insert(verification_table).values(
                id=str(uuid4()),
                identifier=identifier,
                value=str(attempts),
                expires_at=now + timedelta(minutes=15),
                created_at=now,
                updated_at=now,
            )
        )
        return attempts

    def _otp_attempt_count(self, *, email: str, flow: OtpFlow) -> int:
        verification_table = legacy_tables["verification"]
        now = legacy_local_now(self.clock)
        row = (
            self.connection.execute(
                select(verification_table.c.value).where(
                    and_(
                        verification_table.c.identifier
                        == self._attempts_identifier(email=email, flow=flow),
                        verification_table.c.expires_at > now,
                    )
                )
            )
            .mappings()
            .first()
        )
        if row is None:
            return 0
        try:
            return max(0, int(str(row["value"])))
        except ValueError:
            return 0

    def _clear_otp_attempts(self, *, email: str, flow: OtpFlow) -> None:
        verification_table = legacy_tables["verification"]
        self.connection.execute(
            delete(verification_table).where(
                verification_table.c.identifier == self._attempts_identifier(email=email, flow=flow)
            )
        )

    def _enforce_cooldown(
        self,
        *,
        email: str,
        ip_address: str,
        route: str,
        cooldown_seconds: int,
    ) -> None:
        limited = get_auth_rate_limit_status(
            self.connection,
            email=email,
            ip=ip_address,
            route=route,
            limit=1,
            window_seconds=cooldown_seconds,
        )
        if limited.is_limited:
            raise ApiError(
                status_code=429,
                error="Aguarde para reenviar o código.",
                field="email",
                retry_after_seconds=limited.retry_after_seconds,
            )

    def _enforce_burst(
        self,
        *,
        email: str,
        ip_address: str,
        route: str,
        limit: int,
        window_seconds: int,
    ) -> None:
        limited = get_auth_rate_limit_status(
            self.connection,
            email=email,
            ip=ip_address,
            route=route,
            limit=limit,
            window_seconds=window_seconds,
        )
        if limited.is_limited:
            raise ApiError(
                status_code=429,
                error="Aguarde para reenviar o código.",
                field="email",
                retry_after_seconds=limited.retry_after_seconds,
            )

    def _enforce_lockout(self, *, email: str, ip_address: str, route: str) -> None:
        limited = get_auth_rate_limit_status(
            self.connection,
            email=email,
            ip=ip_address,
            route=route,
            limit=1,
            window_seconds=AUTH_OTP_LOCKOUT_SECONDS,
        )
        if limited.is_limited:
            raise ApiError(
                status_code=429,
                error="Aguarde para reenviar o código.",
                field="code",
                retry_after_seconds=limited.retry_after_seconds,
            )

    def _rate_limit_unknown_email(self, *, email: str, ip_address: str, route: str) -> None:
        limited = get_auth_rate_limit_status(
            self.connection,
            email=email,
            ip=ip_address,
            route=route,
            limit=AUTH_INVALID_EMAIL_MAX_ATTEMPTS,
            window_seconds=AUTH_INVALID_EMAIL_WINDOW_SECONDS,
        )
        if limited.is_limited:
            raise ApiError(
                status_code=429,
                error="Aguarde para tentar novamente.",
                field="email",
                retry_after_seconds=limited.retry_after_seconds,
            )
        self._record_limit(
            email=email,
            ip=ip_address,
            route=route,
            window_seconds=AUTH_INVALID_EMAIL_WINDOW_SECONDS,
        )

    def _record_limit(self, *, email: str, ip: str, route: str, window_seconds: int) -> None:
        record_auth_rate_limit(
            self.connection,
            email=email,
            ip=ip,
            route=route,
            window_seconds=window_seconds,
        )
        self.connection.commit()

    def _ensure_default_group(self, *, user_id: str, now: object) -> None:
        group_table = legacy_tables["group"]
        user_group_table = legacy_tables["user_group"]
        default_group = (
            self.connection.execute(
                select(group_table.c.id)
                .where(group_table.c.is_default.is_(True))
                .order_by(group_table.c.updated_at.desc())
                .limit(1)
            )
            .mappings()
            .first()
        )
        if default_group is None:
            raise ApiError(
                status_code=500,
                error="Grupo padrão não configurado no sistema.",
            )
        existing = (
            self.connection.execute(
                select(user_group_table.c.id).where(
                    and_(
                        user_group_table.c.user_id == user_id,
                        user_group_table.c.group_id == default_group["id"],
                    )
                )
            )
            .mappings()
            .first()
        )
        if existing is not None:
            return
        self.connection.execute(
            insert(user_group_table).values(
                id=uuid4(),
                user_id=user_id,
                group_id=default_group["id"],
                joined_at=now,
                created_at=now,
            )
        )

    def _ensure_allowed_domain(self, email: str) -> None:
        try:
            ensure_allowed_email_domain(email, self.settings.allowed_email_domains)
        except AuthInputError as exc:
            raise ApiError(status_code=400, error=ALLOWED_DOMAIN_ERROR, field=exc.field) from exc

    def _otp_identifier(self, *, email: str, flow: OtpFlow) -> str:
        return f"silo:otp:{flow.value}:{email}"

    def _attempts_identifier(self, *, email: str, flow: OtpFlow) -> str:
        return f"{flow.value}:attempts:{email}"

    def _otp_value(self, otp: str) -> str:
        salt = secrets.token_hex(16)
        digest = self._otp_digest(salt=salt, otp=otp)
        return f"silo-otp-v1:{salt}:{digest}"

    def _verify_otp_value(self, otp: str, stored: str) -> bool:
        parts = stored.split(":", maxsplit=2)
        if len(parts) == 3 and parts[0] == "silo-otp-v1":
            expected = self._otp_digest(salt=parts[1], otp=otp)
            return hmac.compare_digest(expected, parts[2])
        return hmac.compare_digest(stored, otp)

    def _otp_digest(self, *, salt: str, otp: str) -> str:
        secret = self.settings.session_secret.get_secret_value()
        material = f"{salt}:{otp}".encode()
        return hmac.new(secret.encode("utf-8"), material, hashlib.sha256).hexdigest()
