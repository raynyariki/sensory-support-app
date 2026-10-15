"""Shared request dependencies: who is making this request?"""

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import get_db
from app.errors import ApiError
from app.models import User
from app.security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False, description="Paste the access_token from /auth/login")


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> User:
    unauthorised = ApiError(
        401,
        "Please log in to continue.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorised
    try:
        claims = decode_access_token(credentials.credentials, settings)
        user_id = int(claims["sub"])
    except (jwt.PyJWTError, ValueError, KeyError):
        raise unauthorised

    user = db.get(User, user_id)
    # A missing user (deleted account) or an old token_version (logged out) both fail.
    if user is None or claims.get("tv") != user.token_version:
        raise unauthorised
    return user