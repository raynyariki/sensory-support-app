"""Password hashing and login tokens.

Passwords
    Hashed with bcrypt, which adds a random salt and is deliberately slow, so a
    stolen database cannot be reversed cheaply. The password itself is never
    stored or logged.

Tokens
    After login the server signs a JSON Web Token (JWT). The browser sends it
    with every request as `Authorization: Bearer <token>`. The token carries the
    user's id, an expiry time, and the user's `token_version`. Logging out or
    changing the password raises that version, which instantly invalidates every
    token issued before.
"""

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import Settings
from app.models import User

ALGORITHM = "HS256"
_dummy_hash: str | None = None


def hash_password(password: str, rounds: int) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds)).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:  # password longer than bcrypt's 72-byte limit, or a malformed hash
        return False


def dummy_hash(rounds: int) -> str:
    """A hash to check against when the email is unknown.

    Doing the same slow work either way stops an attacker learning which emails
    have accounts by timing the response.
    """
    global _dummy_hash
    if _dummy_hash is None:
        _dummy_hash = hash_password("not-a-real-password", rounds)
    return _dummy_hash


def create_access_token(user: User, remember_me: bool, settings: Settings) -> tuple[str, int]:
    """Return (token, seconds until it expires)."""
    lifetime = (
        timedelta(days=settings.remember_me_days)
        if remember_me
        else timedelta(hours=settings.access_token_hours)
    )
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "tv": user.token_version,
        "iat": now,
        "exp": now + lifetime,
    }
    token = jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)
    return token, int(lifetime.total_seconds())


def decode_access_token(token: str, settings: Settings) -> dict:
    """Return the token's claims, or raise jwt.PyJWTError if it is invalid or expired."""
    return jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM], options={"require": ["exp", "sub"]})