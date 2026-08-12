from __future__ import annotations

import json
from pathlib import Path

import pytest

from silo.auth.password import hash_legacy_bcrypt, legacy_bcrypt_input_bytes, verify_legacy_bcrypt

ROOT = Path(__file__).resolve().parents[4]
VECTORS_PATH = (
    ROOT / "tests" / "fixtures" / "legacy-golden" / "phase1_11.auth_bcryptjs_vectors.json"
)


def test_legacy_bcrypt_vectors_match_bcryptjs() -> None:
    if not VECTORS_PATH.is_file():
        pytest.skip("Fixtures de vetores bcrypt ausentes")
    payload = json.loads(VECTORS_PATH.read_text(encoding="utf-8"))

    for vector in payload["vectors"]:
        password = vector["password"]
        assert legacy_bcrypt_input_bytes(password).hex() == vector["first72Utf8Hex"]
        assert hash_legacy_bcrypt(password, salt=vector["salt"]) == vector["hash"]
        assert verify_legacy_bcrypt(password, vector["hash"])

        for equivalent in vector["equivalentPasswords"]:
            assert verify_legacy_bcrypt(equivalent, vector["hash"])

        for rejected in vector["rejectedPasswords"]:
            assert not verify_legacy_bcrypt(rejected, vector["hash"])


def test_legacy_bcrypt_rejects_missing_and_invalid_hash_values() -> None:
    assert verify_legacy_bcrypt("secret", None) is False
    assert verify_legacy_bcrypt("secret", "not-a-valid-bcrypt-hash") is False
