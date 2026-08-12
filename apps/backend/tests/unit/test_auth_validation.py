from __future__ import annotations

import json
from pathlib import Path

import pytest

from silo.auth.validation import (
    AuthInputError,
    ALLOWED_DOMAIN_ERROR,
    EMAIL_ERROR,
    NAME_ERROR,
    OTP_CODE_ERROR,
    PLAIN_PASSWORD_ERROR,
    STRONG_PASSWORD_ERROR,
    _camel_to_snake_bool,
    _expected_boolean_message,
    _expected_string_message,
    _public_field_to_python_key,
    _received_type_name,
    ensure_allowed_email_domain,
    is_valid_domain,
    parse_auth_payload,
    validate_email,
    validate_name,
    validate_otp_code,
    validate_plain_password,
    validate_strong_password,
)

ROOT = Path(__file__).resolve().parents[4]
VECTORS_PATH = ROOT / "tests" / "fixtures" / "auth-validation-vectors.json"


def test_shared_auth_validation_vectors() -> None:
    if not VECTORS_PATH.is_file():
        pytest.skip("Fixtures de validacao auth ausentes")
    vectors = json.loads(VECTORS_PATH.read_text(encoding="utf-8"))
    validators = {
        "email": validate_email,
        "otp": validate_otp_code,
        "plainPassword": validate_plain_password,
        "strongPassword": validate_strong_password,
        "name": validate_name,
    }

    for vector in vectors["cases"]:
        validator = validators[vector["schema"]]
        if vector["valid"]:
            assert validator(vector["input"]) == vector["value"]
        else:
            with pytest.raises(AuthInputError) as exc_info:
                validator(vector["input"])
            assert exc_info.value.message == vector["error"]
            assert exc_info.value.field == vector["field"]


def test_shared_auth_payload_vectors() -> None:
    if not VECTORS_PATH.is_file():
        pytest.skip("Fixtures de validacao auth ausentes")
    vectors = json.loads(VECTORS_PATH.read_text(encoding="utf-8"))
    for vector in vectors["payloadCases"]:
        if vector["valid"]:
            assert parse_auth_payload(vector["schema"], vector["input"]) == vector["value"]
        else:
            with pytest.raises(AuthInputError) as exc_info:
                parse_auth_payload(vector["schema"], vector["input"])
            assert exc_info.value.message == vector["error"]
            assert exc_info.value.field == vector["field"]


def test_allowed_domain_matches_node_exact_domain_rule() -> None:
    assert is_valid_domain("user@inpe.br", ("inpe.br",))
    assert is_valid_domain("user@cptec.inpe.br", ("cptec.inpe.br", "inpe.br"))
    assert not is_valid_domain("user@evilinpe.br", ("inpe.br",))
    assert not is_valid_domain("user@sub.inpe.br", ("inpe.br",))


def test_auth_validation_helpers_cover_messages_and_boolean_branches() -> None:
    assert _received_type_name(None) == "null"
    assert _received_type_name(True) == "boolean"
    assert _received_type_name(7) == "number"
    assert _received_type_name(7.5) == "number"
    assert _received_type_name([1]) == "array"
    assert _received_type_name({"a": 1}) == "object"
    assert _expected_string_message("number") == "Invalid input: expected string, received number"
    assert _expected_boolean_message("string") == "Invalid input: expected boolean, received string"
    assert _public_field_to_python_key("autoSignIn") == "auto_sign_in"
    assert _public_field_to_python_key("email") == "email"
    assert _camel_to_snake_bool({"autoSignIn": True, "email": "x"}, "autoSignIn", "auto_sign_in") == {
        "auto_sign_in": True,
        "email": "x",
    }
    assert _camel_to_snake_bool("not-a-mapping", "autoSignIn", "auto_sign_in") == "not-a-mapping"

    with pytest.raises(AuthInputError) as exc_info:
        validate_email(123)
    assert exc_info.value.message == _expected_string_message("number")
    assert exc_info.value.field == "email"

    with pytest.raises(AuthInputError) as exc_info:
        validate_email("bad")
    assert exc_info.value.message == EMAIL_ERROR
    assert exc_info.value.field == "email"

    with pytest.raises(AuthInputError) as exc_info:
        validate_otp_code("123")
    assert exc_info.value.message == OTP_CODE_ERROR
    assert exc_info.value.field == "code"

    with pytest.raises(AuthInputError) as exc_info:
        validate_plain_password("")
    assert exc_info.value.message == PLAIN_PASSWORD_ERROR
    assert exc_info.value.field == "password"

    with pytest.raises(AuthInputError) as exc_info:
        validate_strong_password("weak")
    assert exc_info.value.message == STRONG_PASSWORD_ERROR
    assert exc_info.value.field == "password"

    with pytest.raises(AuthInputError) as exc_info:
        validate_name("x")
    assert exc_info.value.message == NAME_ERROR
    assert exc_info.value.field == "name"

    with pytest.raises(AuthInputError) as exc_info:
        ensure_allowed_email_domain("user@example.test", ("example.org",))
    assert exc_info.value.message == ALLOWED_DOMAIN_ERROR
    assert exc_info.value.field == "email"

    assert is_valid_domain("user@example.test", ()) is True


def test_auth_validation_payload_edges_cover_missing_fields_and_optional_bools() -> None:
    with pytest.raises(AuthInputError) as exc_info:
        parse_auth_payload("login_password", None)
    assert exc_info.value.field == "email"

    with pytest.raises(AuthInputError) as exc_info:
        parse_auth_payload("login_email_send_otp", {"email": "user@example.test", "resend": "yes"})
    assert exc_info.value.message == "Invalid input: expected boolean, received str"

    payload = parse_auth_payload(
        "setup_password",
        {
            "email": "user@example.test",
            "code": "123456",
            "password": "Strong123!",
            "autoSignIn": True,
        },
    )
    assert payload["auto_sign_in"] is True
