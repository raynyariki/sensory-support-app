"""Simple summaries of the user's history. Nothing here is a medical assessment."""

from collections import Counter
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.catalogue import RESPONSES, label_for, sort_key
from app.database import get_db
from app.deps import get_current_user
from app.errors import ApiError, VALIDATION_SUMMARY
from app.models import SoundEvent, SoundPreference, User
from app.schemas import AnalyticsOut, DayCount, ResponseCount, SoundCount

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("", response_model=AnalyticsOut, summary="Summary of my history")
def analytics(
    days: int = Query(14, ge=1, le=90, description="How many days the by-day counts cover"),
    tz: str = Query("UTC", description="Your time zone, for example Africa/Nairobi, so days start at your midnight"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        zone = ZoneInfo(tz)
    except (ZoneInfoNotFoundError, ValueError, KeyError):
        raise ApiError(422, VALIDATION_SUMMARY, errors={"tz": "Unknown time zone"})

    mine = SoundEvent.user_id == user.id

    # Entries per sound, most frequent first.
    sound_rows = db.execute(
        select(SoundEvent.sound_category, func.count()).where(mine).group_by(SoundEvent.sound_category)
    ).all()
    by_sound = [
        SoundCount(sound_category=category, label=label_for(category), count=count)
        for category, count in sorted(sound_rows, key=lambda row: (-row[1], sort_key(row[0])))
    ]
    total = sum(item.count for item in by_sound)

    # Entries for sounds the user currently rates as High.
    high_sounds = db.scalars(
        select(SoundPreference.sound_category).where(
            SoundPreference.user_id == user.id, SoundPreference.sensitivity_level == "high"
        )
    ).all()
    high_set = set(high_sounds)
    high_relevance = sum(item.count for item in by_sound if item.sound_category in high_set)

    # How sounds felt.
    response_counts = dict(
        db.execute(
            select(SoundEvent.response, func.count())
            .where(mine, SoundEvent.response.is_not(None))
            .group_by(SoundEvent.response)
        ).all()
    )
    by_response = [
        ResponseCount(response=key, label=label, count=response_counts.get(key, 0))
        for key, label in RESPONSES.items()
    ]

    # Entries per day over the last N days, with zeros for quiet days.
    today = datetime.now(zone).date()
    first_day = today - timedelta(days=days - 1)
    window_start = datetime.combine(first_day, time.min, tzinfo=zone).astimezone(timezone.utc)
    timestamps = db.scalars(select(SoundEvent.timestamp).where(mine, SoundEvent.timestamp >= window_start)).all()
    per_day = Counter(ts.astimezone(zone).date() for ts in timestamps)
    by_day = [
        DayCount(date=(first_day + timedelta(days=offset)).isoformat(), count=per_day.get(first_day + timedelta(days=offset), 0))
        for offset in range(days)
    ]

    return AnalyticsOut(
        total_events=total,
        high_relevance_events=high_relevance,
        most_frequent_sound=by_sound[0] if by_sound else None,
        by_sound=by_sound,
        by_day=by_day,
        by_response=by_response,
        days=days,
        tz=tz,
    )