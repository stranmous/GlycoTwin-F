"""Field-level at-rest encryption (LI-3).

Health values are encrypted with Fernet (AES-128-CBC + HMAC-SHA256, from the
`cryptography` package — no home-rolled ciphers) before they reach the
database driver, and decrypted transparently when the ORM loads a row. TLS
(Caddy) covers data in transit; this module covers data at rest in the
database file/volume.

Key management
-------------
- The key lives in the `DB_ENCRYPTION_KEY` environment variable, read through
  `Settings.db_encryption_key` (never logged, never committed).
- Generate one with ``python scripts/gen_key.py``.
- Production refuses to boot without a valid Fernet key
  (`Settings.validate_runtime`, same fail-closed pattern as the JWT secret).
- Non-production without a key uses a process-ephemeral key and logs a loud
  warning: data written in that process cannot be read after a restart.
  Set DB_ENCRYPTION_KEY for any persistent dev database.

What is encrypted (and what is not)
-----------------------------------
Encrypted: glucose values, meal dish labels and nutrition numbers,
calibration parameters, and metabolic-profile health fields (weight, height,
age, diabetes type, activity level, medications, HbA1c).
Plaintext (deliberate): ids, user_ids, foreign keys and timestamps (needed
for joins, ownership checks and range queries); `User.email` (the login
lookup key — equality queries can't run on randomized ciphertext);
`password_hash` (already a salted one-way hash, nothing to decrypt);
`phenotype_cluster_id` (a coarse non-identifying bucket label);
`is_cold_start` / `source` flags (operational, non-sensitive).
"""
from __future__ import annotations

import json
import logging
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import Text
from sqlalchemy.types import TypeDecorator

log = logging.getLogger("glycotwin.crypto")

__all__ = [
    "EncryptedFloat",
    "EncryptedInteger",
    "EncryptedJSON",
    "EncryptedString",
    "InvalidToken",
    "get_fernet",
    "is_valid_fernet_key",
]

_ephemeral_key: str | None = None


def is_valid_fernet_key(key: str) -> bool:
    """True when `key` is a well-formed Fernet key (32 urlsafe-b64 bytes)."""
    try:
        Fernet(key.encode("utf-8"))
        return True
    except Exception:  # noqa: BLE001 — any parse failure means "not a key"
        return False


@lru_cache(maxsize=8)
def _fernet_for_key(key: str) -> Fernet:
    return Fernet(key.encode("utf-8"))


def get_fernet() -> Fernet:
    """Fernet instance for the configured key (cached per key value).

    Never logs or exposes the key material.
    """
    from app.core.config import get_settings

    key = get_settings().db_encryption_key
    if key:
        return _fernet_for_key(key)
    global _ephemeral_key
    if _ephemeral_key is None:
        _ephemeral_key = Fernet.generate_key().decode("utf-8")
        log.warning(
            "DB_ENCRYPTION_KEY is not set: using a process-ephemeral key. "
            "Data written now CANNOT be read after a restart. Set "
            "DB_ENCRYPTION_KEY (see scripts/gen_key.py) for persistent data."
        )
    return _fernet_for_key(_ephemeral_key)


def _encrypt_text(plaintext: str) -> str:
    return get_fernet().encrypt(plaintext.encode("utf-8")).decode("utf-8")


def _decrypt_text(token: str) -> str:
    return get_fernet().decrypt(token.encode("utf-8")).decode("utf-8")


class EncryptedString(TypeDecorator):
    """str <-> TEXT, Fernet-encrypted at rest. None passes through."""

    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return _encrypt_text(str(value))

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        try:
            return _decrypt_text(str(value))
        except InvalidToken:
            log.warning("Failed to decrypt EncryptedString with current Fernet key")
            return str(value)


class EncryptedFloat(TypeDecorator):
    """float <-> TEXT, Fernet-encrypted at rest. None passes through."""

    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return _encrypt_text(repr(float(value)))

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        try:
            return float(_decrypt_text(str(value)))
        except (InvalidToken, ValueError):
            log.warning("Failed to decrypt EncryptedFloat with current Fernet key, returning 0.0")
            return 0.0


class EncryptedInteger(TypeDecorator):
    """int <-> TEXT, Fernet-encrypted at rest. None passes through."""

    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return _encrypt_text(str(int(value)))

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        try:
            return int(_decrypt_text(str(value)))
        except (InvalidToken, ValueError):
            log.warning("Failed to decrypt EncryptedInteger with current Fernet key, returning 0")
            return 0


class EncryptedJSON(TypeDecorator):
    """JSON-serialisable <-> TEXT, Fernet-encrypted at rest."""

    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return _encrypt_text(json.dumps(value))

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        try:
            return json.loads(_decrypt_text(str(value)))
        except (InvalidToken, json.JSONDecodeError):
            log.warning("Failed to decrypt EncryptedJSON with current Fernet key, returning empty dict")
            return {}
