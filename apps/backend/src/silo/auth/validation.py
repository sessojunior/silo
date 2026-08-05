from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

EMAIL_ERROR = "Digite um e-mail válido."
OTP_CODE_ERROR = "Digite o código com 6 caracteres."
PLAIN_PASSWORD_ERROR = "Digite sua senha."
STRONG_PASSWORD_ERROR = "Senha inválida."
NAME_ERROR = "Digite um nome válido."
ALLOWED_DOMAIN_ERROR = "Apenas e-mails do domínio permitido são aceitos."

_EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
_UPPERCASE_PATTERN = re.compile(r"[A-Z]")
_LOWERCASE_PATTERN = re.compile(r"[a-z]")
_DIGIT_PATTERN = re.compile(r"[0-9]")
_SYMBOL_PATTERN = re.compile(r"[^A-Za-z0-9]")

type AuthSchemaName = Literal[
    "forget_password",
    "verify_forget_password_otp",
    "login_password",
    "login_email_send_otp",
    "login_email_verify_otp",
    "setup_password",
    "sign_up_email",
    "sign_up_email_send_otp",
    "sign_up_email_verify_otp",
]


class AuthInputError(ValueError):
    def __init__(self, message: str, *, field: str) -> None:
        super().__init__(message)
        self.message = message
        self.field = field


@dataclass(frozen=True, slots=True)
class AuthFieldSpec:
    name: str
    kind: Literal["email", "otp", "plain_password", "strong_password", "name", "boolean"]
    optional: bool = False


class AuthBaseModel(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class ForgetPasswordInput(AuthBaseModel):
    email: str
    resend: bool | None = None

    @field_validator("email", mode="before")
    @classmethod
    def validate_email_field(cls, value: object) -> str:
        return validate_email(value)


class VerifyForgetPasswordOtpInput(AuthBaseModel):
    email: str
    code: str

    @field_validator("email", mode="before")
    @classmethod
    def validate_email_field(cls, value: object) -> str:
        return validate_email(value)

    @field_validator("code", mode="before")
    @classmethod
    def validate_code_field(cls, value: object) -> str:
        return validate_otp_code(value)


class LoginPasswordInput(AuthBaseModel):
    email: str
    password: str

    @field_validator("email", mode="before")
    @classmethod
    def validate_email_field(cls, value: object) -> str:
        return validate_email(value)

    @field_validator("password", mode="before")
    @classmethod
    def validate_password_field(cls, value: object) -> str:
        return validate_plain_password(value)


class SetupPasswordInput(AuthBaseModel):
    email: str
    code: str
    password: str
    auto_sign_in: bool | None = None

    @field_validator("email", mode="before")
    @classmethod
    def validate_email_field(cls, value: object) -> str:
        return validate_email(value)

    @field_validator("code", mode="before")
    @classmethod
    def validate_code_field(cls, value: object) -> str:
        return validate_otp_code(value)

    @field_validator("password", mode="before")
    @classmethod
    def validate_password_field(cls, value: object) -> str:
        return validate_strong_password(value)

    @model_validator(mode="before")
    @classmethod
    def accept_camel_case(cls, values: object) -> object:
        return _camel_to_snake_bool(values, "autoSignIn", "auto_sign_in")


class SignUpEmailInput(AuthBaseModel):
    name: str
    email: str
    password: str

    @field_validator("name", mode="before")
    @classmethod
    def validate_name_field(cls, value: object) -> str:
        return validate_name(value)

    @field_validator("email", mode="before")
    @classmethod
    def validate_email_field(cls, value: object) -> str:
        return validate_email(value)

    @field_validator("password", mode="before")
    @classmethod
    def validate_password_field(cls, value: object) -> str:
        return validate_strong_password(value)


class SignUpEmailSendOtpInput(AuthBaseModel):
    email: str

    @field_validator("email", mode="before")
    @classmethod
    def validate_email_field(cls, value: object) -> str:
        return validate_email(value)


class SignUpEmailVerifyOtpInput(AuthBaseModel):
    email: str
    code: str
    password: str | None = None
    auto_sign_in: bool | None = None

    @field_validator("email", mode="before")
    @classmethod
    def validate_email_field(cls, value: object) -> str:
        return validate_email(value)

    @field_validator("code", mode="before")
    @classmethod
    def validate_code_field(cls, value: object) -> str:
        return validate_otp_code(value)

    @field_validator("password", mode="before")
    @classmethod
    def validate_optional_password_field(cls, value: object) -> str | None:
        if value is None:
            return None
        return validate_strong_password(value, max_length=160)

    @model_validator(mode="before")
    @classmethod
    def accept_camel_case(cls, values: object) -> object:
        return _camel_to_snake_bool(values, "autoSignIn", "auto_sign_in")


AUTH_SCHEMA_FIELDS: dict[AuthSchemaName, tuple[AuthFieldSpec, ...]] = {
    "forget_password": (
        AuthFieldSpec("email", "email"),
        AuthFieldSpec("resend", "boolean", optional=True),
    ),
    "verify_forget_password_otp": (
        AuthFieldSpec("email", "email"),
        AuthFieldSpec("code", "otp"),
    ),
    "login_password": (
        AuthFieldSpec("email", "email"),
        AuthFieldSpec("password", "plain_password"),
    ),
    "login_email_send_otp": (
        AuthFieldSpec("email", "email"),
        AuthFieldSpec("resend", "boolean", optional=True),
    ),
    "login_email_verify_otp": (
        AuthFieldSpec("email", "email"),
        AuthFieldSpec("code", "otp"),
    ),
    "setup_password": (
        AuthFieldSpec("email", "email"),
        AuthFieldSpec("code", "otp"),
        AuthFieldSpec("password", "strong_password"),
        AuthFieldSpec("autoSignIn", "boolean", optional=True),
    ),
    "sign_up_email": (
        AuthFieldSpec("name", "name"),
        AuthFieldSpec("email", "email"),
        AuthFieldSpec("password", "strong_password"),
    ),
    "sign_up_email_send_otp": (AuthFieldSpec("email", "email"),),
    "sign_up_email_verify_otp": (
        AuthFieldSpec("email", "email"),
        AuthFieldSpec("code", "otp"),
        AuthFieldSpec("password", "strong_password", optional=True),
        AuthFieldSpec("autoSignIn", "boolean", optional=True),
    ),
}


def parse_auth_payload(schema_name: AuthSchemaName, payload: object) -> dict[str, Any]:
    if not isinstance(payload, Mapping):
        first_field = AUTH_SCHEMA_FIELDS[schema_name][0].name
        raise AuthInputError(_expected_string_message("undefined"), field=first_field)

    parsed: dict[str, Any] = {}
    for spec in AUTH_SCHEMA_FIELDS[schema_name]:
        if spec.name not in payload:
            if spec.optional:
                continue
            raise AuthInputError(_expected_string_message("undefined"), field=spec.name)

        raw_value = payload[spec.name]
        if raw_value is None and spec.optional:
            parsed[_public_field_to_python_key(spec.name)] = None
            continue

        parsed[_public_field_to_python_key(spec.name)] = _validate_by_kind(spec.kind, raw_value)

    return parsed


def validate_email(value: object) -> str:
    text = _require_string(value, field="email")
    normalized = text.strip().lower()
    if not _EMAIL_PATTERN.fullmatch(normalized):
        raise AuthInputError(EMAIL_ERROR, field="email")
    return normalized


def validate_otp_code(value: object) -> str:
    text = _require_string(value, field="code").strip()
    if len(text) != 6:
        raise AuthInputError(OTP_CODE_ERROR, field="code")
    return text


def validate_plain_password(value: object) -> str:
    text = _require_string(value, field="password")
    if len(text) < 1:
        raise AuthInputError(PLAIN_PASSWORD_ERROR, field="password")
    return text


def validate_strong_password(value: object, *, max_length: int = 120) -> str:
    text = _require_string(value, field="password")
    if (
        len(text) < 8
        or len(text) > max_length
        or _UPPERCASE_PATTERN.search(text) is None
        or _LOWERCASE_PATTERN.search(text) is None
        or _DIGIT_PATTERN.search(text) is None
        or _SYMBOL_PATTERN.search(text) is None
    ):
        raise AuthInputError(STRONG_PASSWORD_ERROR, field="password")
    return text


def validate_name(value: object) -> str:
    text = _require_string(value, field="name").strip()
    if len(text) < 2 or len(text) > 120 or not _contains_only_legacy_name_characters(text):
        raise AuthInputError(NAME_ERROR, field="name")
    return text


def ensure_allowed_email_domain(email: str, allowed_domains: tuple[str, ...]) -> None:
    if is_valid_domain(email, allowed_domains):
        return
    raise AuthInputError(ALLOWED_DOMAIN_ERROR, field="email")


def is_valid_domain(email: str, allowed_domains: tuple[str, ...]) -> bool:
    if not allowed_domains:
        return True
    domain = email.rsplit("@", maxsplit=1)[-1].lower()
    return domain in {allowed_domain.lower() for allowed_domain in allowed_domains}


def _validate_by_kind(
    kind: Literal["email", "otp", "plain_password", "strong_password", "name", "boolean"],
    value: object,
) -> object:
    match kind:
        case "email":
            return validate_email(value)
        case "otp":
            return validate_otp_code(value)
        case "plain_password":
            return validate_plain_password(value)
        case "strong_password":
            return validate_strong_password(value)
        case "name":
            return validate_name(value)
        case "boolean":
            if not isinstance(value, bool):
                raise AuthInputError(
                    _expected_boolean_message(_received_type_name(value)), field=""
                )
            return value


def _contains_only_legacy_name_characters(value: str) -> bool:
    return all(character.isalpha() or character in {" ", "'", "-"} for character in value)


def _require_string(value: object, *, field: str) -> str:
    if isinstance(value, str):
        return value
    raise AuthInputError(_expected_string_message(_received_type_name(value)), field=field)


def _received_type_name(value: object) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int | float):
        return "number"
    if isinstance(value, list):
        return "array"
    if isinstance(value, dict):
        return "object"
    return type(value).__name__


def _expected_string_message(received: str) -> str:
    return f"Invalid input: expected string, received {received}"


def _expected_boolean_message(received: str) -> str:
    return f"Invalid input: expected boolean, received {received}"


def _public_field_to_python_key(field: str) -> str:
    return "auto_sign_in" if field == "autoSignIn" else field


def _camel_to_snake_bool(values: object, public_key: str, python_key: str) -> object:
    if not isinstance(values, Mapping) or public_key not in values:
        return values
    copied = dict(values)
    copied[python_key] = copied.pop(public_key)
    return copied
