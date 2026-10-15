"""Create an account, log in, log out."""

from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import get_db
from app.deps import get_current_user
from app.errors import ApiError
from app.limiter import login_limiter
from app.models import User
from app.schemas import LoginIn, RegisterIn, TokenOut, UserOut
from app.security import create_access_token, dummy_hash, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["Authentication"])

EMAIL_TAKEN = "An account with this email already exists"


def token_response(user: User, remember_me: bool, settings: Settings) -> TokenOut:
    token, expires_in = create_access_token(user, remember_me, settings)
    return TokenOut(access_token=token, expires_in=expires_in, user=UserOut.model_validate(user))


@router.post("/register", response_model=TokenOut, status_code=201, summary="Create an account")
def register(
    payload: RegisterIn,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    """Creates the account and logs the new user in, so they can go straight to setup."""
    if db.scalar(select(User.id).where(User.email == payload.email)):
        raise ApiError(409, EMAIL_TAKEN, errors={"email": EMAIL_TAKEN})

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password, settings.bcrypt_rounds),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:  # two sign-ups with the same email at the same moment
        db.rollback()
        raise ApiError(409, EMAIL_TAKEN, errors={"email": EMAIL_TAKEN})
    return token_response(user, remember_me=False, settings=settings)


@router.post("/login", response_model=TokenOut, summary="Log in")
def login(
    payload: LoginIn,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    """Set `remember_me` to true for a long-lived token (30 days instead of 8 hours)."""
    limiter_args = (settings.login_max_attempts, settings.login_window_seconds)
    login_limiter.check(payload.email, *limiter_args)

    user = db.scalar(select(User).where(User.email == payload.email))
    # Always do the slow password check, even for unknown emails, so timing reveals nothing.
    stored_hash = user.password_hash if user else dummy_hash(settings.bcrypt_rounds)
    password_ok = verify_password(payload.password, stored_hash)

    if user is None or not password_ok:
        login_limiter.record_failure(payload.email, settings.login_window_seconds)
        # The same message for "no such email" and "wrong password".
        raise ApiError(401, "Incorrect email or password")

    login_limiter.clear(payload.email)
    return token_response(user, payload.remember_me, settings)


@router.post("/logout", status_code=204, summary="Log out")
def logout(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Invalidates every token issued for this account, on every device."""
    user.token_version += 1
    db.commit()
    return Response(status_code=204)