"""Encrypt small secrets (e.g. an AI provider API key) before they are stored in the database.

The Fernet key is derived from JWT_SECRET, which is already required to be strong in production.
If that secret changes, previously stored values can no longer be decrypted and are treated as
"not set" (the admin simply re-enters them). Plaintext is never logged or returned by the API.
"""

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.config import get_settings


def _fernet() -> Fernet:
    digest = hashlib.sha256(("tatsat-secretbox:v1:" + get_settings().jwt_secret).encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt(plain: str) -> str:
    return _fernet().encrypt(plain.encode("utf-8")).decode("ascii")


def decrypt(token: str) -> str | None:
    """Return the plaintext, or None when the token is empty, corrupt, or from another secret."""
    if not token:
        return None
    try:
        return _fernet().decrypt(token.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError, UnicodeError):
        return None
