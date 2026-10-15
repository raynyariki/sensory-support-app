"""Database tables.

Three tables: users, sound_preferences, sound_events.

The original plan had separate "Sound Event" and "Trigger Diary" tables. They
are merged here: a diary entry is simply a sound event the user has annotated
with how it felt and a note. Two tables would repeat the sound and the time and
need a join to show one record. See README for the field-by-field review.

No raw audio is stored anywhere.
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    """Always store UTC and always return timezone-aware UTC values.

    PostgreSQL does this natively; SQLite does not, so we make both behave alike.
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("alert_threshold IN ('high', 'medium', 'low')", name="ck_users_alert_threshold"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50))
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)  # stored lowercase
    password_hash: Mapped[str] = mapped_column(String(128))  # bcrypt hash, never the password
    # Raised on logout and password change. Tokens carrying an older number stop working.
    token_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    # Alert settings (one set per user)
    alerts_enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    alert_threshold: Mapped[str] = mapped_column(String(10), default="low", server_default="low")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    preferences: Mapped[list["SoundPreference"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    events: Mapped[list["SoundEvent"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class SoundPreference(Base):
    """How relevant one sound is to one user. One row per user per sound."""

    __tablename__ = "sound_preferences"
    __table_args__ = (
        # This constraint is what makes duplicate preferences impossible.
        UniqueConstraint("user_id", "sound_category", name="uq_preference_user_sound"),
        CheckConstraint(
            "sensitivity_level IN ('high', 'medium', 'low', 'none')",
            name="ck_preference_level",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    sound_category: Mapped[str] = mapped_column(String(40))
    sensitivity_level: Mapped[str] = mapped_column(String(10))

    user: Mapped[User] = relationship(back_populates="preferences")


class SoundEvent(Base):
    """A sound the user heard: detected automatically or added by hand."""

    __tablename__ = "sound_events"
    __table_args__ = (
        Index("ix_events_user_time", "user_id", "timestamp"),
        Index("ix_events_user_sound", "user_id", "sound_category"),
        CheckConstraint("source IN ('manual', 'monitoring')", name="ck_event_source"),
        CheckConstraint("confidence IS NULL OR (confidence >= 0 AND confidence <= 1)", name="ck_event_confidence"),
        CheckConstraint(
            "response IS NULL OR response IN ('comfortable', 'uncomfortable', 'very_uncomfortable')",
            name="ck_event_response",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    sound_category: Mapped[str] = mapped_column(String(40))
    # Model confidence. Empty for entries the user added by hand.
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    source: Mapped[str] = mapped_column(String(12), default="manual", server_default="manual")
    timestamp: Mapped[datetime] = mapped_column(UTCDateTime)  # when the sound was heard
    response: Mapped[str | None] = mapped_column(String(20), nullable=True)  # how it felt
    note: Mapped[str | None] = mapped_column(String(300), nullable=True)
    # Level of the recording in dBFS (relative to the microphone's maximum). This is
    # not dB SPL: phone microphones are not calibrated, so we never claim real loudness.
    sound_level_dbfs: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Optional, coarse place name chosen by the user (for example "Westlands"). Never coordinates.
    approximate_location: Mapped[str | None] = mapped_column(String(80), nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    user: Mapped[User] = relationship(back_populates="events")