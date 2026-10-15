"""The user's sound profile: how relevant each sound is to them.

Each user has at most one preference per sound. The database enforces that with
a unique constraint; the API checks first so it can give a helpful message.
"""

from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.catalogue import label_for, sort_key
from app.database import get_db
from app.deps import get_current_user
from app.errors import ApiError
from app.models import SoundPreference, User
from app.schemas import PreferenceIn, PreferenceOut, PreferencesBulkIn, PreferenceUpdate

router = APIRouter(prefix="/sound-preferences", tags=["Sound profile"])


def _list(db: Session, user: User) -> list[SoundPreference]:
    rows = db.scalars(select(SoundPreference).where(SoundPreference.user_id == user.id)).all()
    return sorted(rows, key=lambda row: sort_key(row.sound_category))


def _get_owned(db: Session, user: User, preference_id: int) -> SoundPreference:
    row = db.get(SoundPreference, preference_id)
    # Another user's preference is reported as "not found", never "forbidden".
    if row is None or row.user_id != user.id:
        raise ApiError(404, "Sound preference not found")
    return row


@router.get("", response_model=list[PreferenceOut], summary="List my sound preferences")
def list_preferences(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _list(db, user)


@router.post("", response_model=PreferenceOut, status_code=201, summary="Add a sound preference")
def add_preference(
    payload: PreferenceIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.scalar(
        select(SoundPreference).where(
            SoundPreference.user_id == user.id,
            SoundPreference.sound_category == payload.sound_category,
        )
    )
    if existing:
        message = (
            f"{label_for(payload.sound_category)} is already in your sound profile. "
            "Update its level instead."
        )
        raise ApiError(409, message, errors={"sound_category": message}, existing_id=existing.id)

    row = SoundPreference(
        user_id=user.id,
        sound_category=payload.sound_category,
        sensitivity_level=payload.sensitivity_level,
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError:  # two requests at once; the unique constraint caught it
        db.rollback()
        message = f"{label_for(payload.sound_category)} is already in your sound profile."
        raise ApiError(409, message, errors={"sound_category": message})
    return row


@router.put("", response_model=list[PreferenceOut], summary="Save my whole sound profile at once")
def save_all_preferences(
    payload: PreferencesBulkIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Adds new sounds and updates existing ones in a single request.

    Used by the setup page. Sounds not mentioned are left as they are.
    """
    existing = {row.sound_category: row for row in _list(db, user)}
    for item in payload.preferences:
        row = existing.get(item.sound_category)
        if row:
            row.sensitivity_level = item.sensitivity_level
        else:
            db.add(
                SoundPreference(
                    user_id=user.id,
                    sound_category=item.sound_category,
                    sensitivity_level=item.sensitivity_level,
                )
            )
    db.commit()
    return _list(db, user)


@router.put("/{preference_id}", response_model=PreferenceOut, summary="Change a sound's relevance")
def update_preference(
    preference_id: int,
    payload: PreferenceUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = _get_owned(db, user, preference_id)
    row.sensitivity_level = payload.sensitivity_level
    db.commit()
    return row


@router.delete("/{preference_id}", status_code=204, summary="Remove a sound from my profile")
def delete_preference(
    preference_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Sounds that are not in the profile are treated as not relevant."""
    row = _get_owned(db, user, preference_id)
    db.delete(row)
    db.commit()
    return Response(status_code=204)