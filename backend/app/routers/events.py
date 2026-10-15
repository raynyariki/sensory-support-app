"""Sound history and trigger diary.

An event is a sound the user heard. It is created automatically when monitoring
detects a sound they rated, or by hand from the History page. Either way the
user can add a note, say how it felt, correct the sound, or delete it.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.errors import ApiError, VALIDATION_SUMMARY
from app.models import SoundEvent, User, utcnow
from app.schemas import EventCreate, EventList, EventOut, EventUpdate

router = APIRouter(prefix="/sound-events", tags=["History / trigger diary"])


def _get_owned(db: Session, user: User, event_id: int) -> SoundEvent:
    event = db.get(SoundEvent, event_id)
    if event is None or event.user_id != user.id:
        raise ApiError(404, "History entry not found")
    return event


@router.get("", response_model=EventList, summary="List my history, newest first")
def list_events(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    sound_category: str | None = Query(None, description="Only entries for this sound"),
    since: datetime | None = Query(None, description="Only entries at or after this time"),
    until: datetime | None = Query(None, description="Only entries at or before this time"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conditions = [SoundEvent.user_id == user.id]
    if sound_category:
        conditions.append(SoundEvent.sound_category == sound_category)
    if since:
        conditions.append(SoundEvent.timestamp >= since)
    if until:
        conditions.append(SoundEvent.timestamp <= until)

    total = db.scalar(select(func.count()).select_from(SoundEvent).where(*conditions)) or 0
    items = db.scalars(
        select(SoundEvent)
        .where(*conditions)
        .order_by(SoundEvent.timestamp.desc(), SoundEvent.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return EventList(items=items, total=total, limit=limit, offset=offset)


@router.post("", response_model=EventOut, status_code=201, summary="Add a history entry")
def create_event(
    payload: EventCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = SoundEvent(
        user_id=user.id,
        sound_category=payload.sound_category,
        timestamp=payload.timestamp or utcnow(),
        response=payload.response,
        note=payload.note,
        confidence=payload.confidence,
        sound_level_dbfs=payload.sound_level_dbfs,
        approximate_location=payload.approximate_location,
        source=payload.source,
    )
    db.add(event)
    db.commit()
    return event


@router.get("/{event_id}", response_model=EventOut, summary="Get one history entry")
def get_event(event_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _get_owned(db, user, event_id)


@router.patch("/{event_id}", response_model=EventOut, summary="Edit a history entry")
def update_event(
    event_id: int,
    payload: EventUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = _get_owned(db, user, event_id)
    changes = payload.model_dump(exclude_unset=True)

    # The sound and the time can be changed but never emptied.
    errors = {}
    if "sound_category" in changes and changes["sound_category"] is None:
        errors["sound_category"] = "Sound category must be selected"
    if "timestamp" in changes and changes["timestamp"] is None:
        errors["timestamp"] = "Date and time cannot be empty"
    if errors:
        raise ApiError(422, VALIDATION_SUMMARY, errors=errors)

    for field, value in changes.items():
        setattr(event, field, value)
    db.commit()
    return event


@router.delete("/{event_id}", status_code=204, summary="Delete one history entry")
def delete_event(event_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    event = _get_owned(db, user, event_id)
    db.delete(event)
    db.commit()
    return Response(status_code=204)


@router.delete("", summary="Delete all of my history")
def delete_all_events(
    confirm: bool = Query(False, description="Must be true. This cannot be undone."),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not confirm:
        raise ApiError(400, "Add ?confirm=true to confirm that you want to delete your history.")
    result = db.execute(delete(SoundEvent).where(SoundEvent.user_id == user.id))
    db.commit()
    return {"deleted": result.rowcount}