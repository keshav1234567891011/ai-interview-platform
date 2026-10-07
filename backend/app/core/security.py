import secrets
from datetime import UTC, datetime, timedelta

import jwt
from fastapi import HTTPException
from pwdlib import PasswordHash

from app.core.config import get_settings
from app.models.user import User

password_hash = PasswordHash.recommended()
# Random dummy hash equalizes the password verification path for missing accounts.
dummy_hash = password_hash.hash(secrets.token_urlsafe(32))
COOKIE_NAME = "interviewai_session"


def signing_key() -> str:
    value = get_settings().jwt_secret
    if (
        value is None
        or len(value.get_secret_value()) < 32
        or value.get_secret_value().startswith("REPLACE_")
    ):
        raise HTTPException(503, "Authentication is not configured. Contact the administrator.")
    return value.get_secret_value()


def create_token(user: User) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    return jwt.encode(
        {
            "sub": str(user.id),
            "ver": user.token_version,
            "iat": now,
            "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
            "iss": "interviewai",
            "aud": "interviewai-web",
        },
        signing_key(),
        algorithm=settings.jwt_algorithm,
    )


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            signing_key(),
            algorithms=[get_settings().jwt_algorithm],
            issuer="interviewai",
            audience="interviewai-web",
            options={"require": ["sub", "ver", "iat", "exp"]},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Session expired or invalid. Please sign in again.") from None
