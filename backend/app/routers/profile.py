"""The signed-in user's own account: details, password, alert settings, deletion."""

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import get_db
from app.deps import get_current_user
from app.errors import ApiError
from app.models import User
from app.routers.auth import EMAIL_TAKEN, token_response
from app.schemas import PasswordChange, ProfileUpdate, SettingsIn, SettingsOut, TokenOut, UserOut
from app.security import hash_password, verify_password

router = APIRouter(tags=["Profile and settings"])


@router.get("/profile", response_model=UserOut, summary="Get my account details")
def get_profile(user: User = Depends(get_current_user)):
    return user


@router.put("/profile", response_model=UserOut, summary="Update my name and email")
def update_profile(
    payload: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    taken = db.scalar(select(User.id).where(User.email == payload.email, User.id != user.id))
    if taken:
        raise ApiError(409, EMAIL_TAKEN, errors={"email": EMAIL_TAKEN})
    user.name = payload.name
    user.email = payload.email
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ApiError(409, EMAIL_TAKEN, errors={"email": EMAIL_TAKEN})
    return user


@router.put("/profile/password", response_model=TokenOut, summary="Change my password")
def change_password(
    payload: PasswordChange,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    """Logs out every other device and returns a fresh token for this one."""
    if not verify_password(payload.current_password, user.password_hash):
        raise ApiError(
            400,
            "Current password is incorrect",
            errors={"current_password": "Current password is incorrect"},
        )
    user.password_hash = hash_password(payload.new_password, settings.bcrypt_rounds)
    user.token_version += 1
    db.commit()
    return token_response(user, remember_me=False, settings=settings)


@router.delete("/profile", status_code=204, summary="Delete my account and all my data")
def delete_account(
    confirm: bool = Query(False, description="Must be true. This cannot be undone."),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Permanently removes the account, sound profile and history."""
    if not confirm:
        raise ApiError(400, "Add ?confirm=true to confirm that you want to delete your account.")
    db.delete(user)  # preferences and events are removed with it
    db.commit()
    return Response(status_code=204)


@router.get("/settings", response_model=SettingsOut, summary="Get my alert settings")
def get_alert_settings(user: User = Depends(get_current_user)):
    return user


@router.put("/settings", response_model=SettingsOut, summary="Update my alert settings")
def update_alert_settings(
    payload: SettingsIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user.alerts_enabled = payload.alerts_enabled
    user.alert_threshold = payload.alert_threshold
    db.commit()
    return user