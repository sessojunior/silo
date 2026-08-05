from __future__ import annotations

import bcrypt

BCRYPTJS_MAX_INPUT_BYTES = 72
DEFAULT_LEGACY_BCRYPT_ROUNDS = 10


def legacy_bcrypt_input_bytes(password: str) -> bytes:
    return password.encode("utf-8")[:BCRYPTJS_MAX_INPUT_BYTES]


def verify_legacy_bcrypt(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    try:
        return bcrypt.checkpw(legacy_bcrypt_input_bytes(password), password_hash.encode("ascii"))
    except (ValueError, TypeError, UnicodeEncodeError):
        return False


def hash_legacy_bcrypt(
    password: str,
    *,
    rounds: int = DEFAULT_LEGACY_BCRYPT_ROUNDS,
    salt: str | None = None,
) -> str:
    salt_bytes = salt.encode("ascii") if salt is not None else bcrypt.gensalt(rounds=rounds)
    return bcrypt.hashpw(legacy_bcrypt_input_bytes(password), salt_bytes).decode("ascii")
