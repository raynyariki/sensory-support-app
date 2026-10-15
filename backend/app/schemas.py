"""What the API accepts and returns, and the validation rules for every input.

Limits and why they were chosen
    Name          1-50 characters      long enough for full names, short enough to stop abuse
    Email         valid format, <=254  254 is the maximum length of an email address
    Password      8-72 bytes           8 is the usual minimum; bcrypt cannot use more than 72 bytes
    Note          <=300 characters     a couple of sentences, a quick diary note
    Location      <=80 characters      a coarse place name, deliberately not an address
    Timestamp     not in the future    a diary records sounds that already happened (5 min grace for clock drift)
    Confidence    0 to 1               a probability
    Level (dBFS)  -120 to 0            0 dBFS is the loudest a microphone can record
"""

import re
from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    computed_field,
    field_validator,
)

from app.catalogue import ALERT_THRESHOLDS, RESPONSES, SENSITIVITY_LEVELS, is_known_sound, label_for

EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")  # same rule as the frontend
MAX_EMAIL_LENGTH = 254
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_BYTES = 72
MAX_NAME_LENGTH = 50
MAX_NOTE_LENGTH = 300
MAX_LOCATION_LENGTH = 80
CLOCK_DRIFT = timedelta(minutes=5)
EARLIEST_TIMESTAMP = datetime(2000, 1, 1, tzinfo=timezone.utc)

Level = Literal["high", "medium", "low", "none"]
AlertLevel = Literal["high", "medium", "low"]
ResponseValue = Literal["comfortable", "uncomfortable", "very_uncomfortable"]
EventSource = Literal["manual", "monitoring"]

# Keep the literals above in step with the catalogue.
assert set(Level.__args__) == set(SENSITIVITY_LEVELS)
assert set(AlertLevel.__args__) == set(ALERT_THRESHOLDS)
assert set(ResponseValue.__args__) == set(RESPONSES)


# ---------------------------------------------------------------- validators


def _name(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("Name cannot be empty")
    if len(value) > MAX_NAME_LENGTH:
        raise ValueError(f"Name must be {MAX_NAME_LENGTH} characters or fewer")
    return value


def _email(value: str) -> str:
    value = value.strip().lower()
    if not value:
        raise ValueError("Email cannot be empty")
    if len(value) > MAX_EMAIL_LENGTH or not EMAIL_PATTERN.match(value):
        raise ValueError("Enter a valid email address")
    return value


def _new_password(value: str) -> str:
    if not value:
        raise ValueError("Password cannot be empty")
    if len(value) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters")
    if len(value.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise ValueError(f"Password is too long ({MAX_PASSWORD_BYTES} bytes maximum)")
    return value


def _present_password(value: str) -> str:
    if not value:
        raise ValueError("Password cannot be empty")
    return value


def _category(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("Sound category must be selected")
    if not is_known_sound(value):
        raise ValueError("Unknown sound category")
    return value


def _note(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    if len(value) > MAX_NOTE_LENGTH:
        raise ValueError(f"Note must be {MAX_NOTE_LENGTH} characters or fewer")
    return value


def _location(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    if len(value) > MAX_LOCATION_LENGTH:
        raise ValueError(f"Location must be {MAX_LOCATION_LENGTH} characters or fewer")
    return value


def _timestamp(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)  # a time with no zone is taken as UTC
    value = value.astimezone(timezone.utc)
    if value < EARLIEST_TIMESTAMP:
        raise ValueError("Enter a valid date and time")
    if value > datetime.now(timezone.utc) + CLOCK_DRIFT:
        raise ValueError("Date and time cannot be in the future")
    return value


Name = Annotated[str, AfterValidator(_name)]
Email = Annotated[str, AfterValidator(_email)]
NewPassword = Annotated[str, AfterValidator(_new_password)]
PresentPassword = Annotated[str, AfterValidator(_present_password)]
Category = Annotated[str, AfterValidator(_category)]
Note = Annotated[str | None, AfterValidator(_note)]
Location = Annotated[str | None, AfterValidator(_location)]
EventTime = Annotated[datetime | None, AfterValidator(_timestamp)]


class _In(BaseModel):
    """Base for everything the client sends. Unknown fields are rejected."""

    model_config = ConfigDict(extra="forbid")


class _Out(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ------------------------------------------------------------------ accounts


class RegisterIn(_In):
    name: Name
    email: Email
    password: NewPassword
    confirm_password: str | None = None  # optional; when sent it must match

    @field_validator("confirm_password")
    @classmethod
    def _matches(cls, value: str | None, info):
        password = info.data.get("password")
        if value is not None and password is not None and value != password:
            raise ValueError("Passwords do not match")
        return value


class LoginIn(_In):
    email: Email
    password: PresentPassword
    remember_me: bool = False


class UserOut(_Out):
    id: int
    name: str
    email: str
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int = Field(description="Seconds until the token expires")
    user: UserOut


class ProfileUpdate(_In):
    name: Name
    email: Email


class PasswordChange(_In):
    current_password: PresentPassword
    new_password: NewPassword
    confirm_password: str | None = None

    @field_validator("confirm_password")
    @classmethod
    def _matches(cls, value: str | None, info):
        password = info.data.get("new_password")
        if value is not None and password is not None and value != password:
            raise ValueError("Passwords do not match")
        return value


class SettingsIn(_In):
    alerts_enabled: bool
    alert_threshold: AlertLevel


class SettingsOut(_Out):
    alerts_enabled: bool
    alert_threshold: AlertLevel


# --------------------------------------------------------------- preferences


class PreferenceIn(_In):
    sound_category: Category
    sensitivity_level: Level


class PreferenceUpdate(_In):
    sensitivity_level: Level


class PreferencesBulkIn(_In):
    preferences: list[PreferenceIn]

    @field_validator("preferences")
    @classmethod
    def _no_duplicates(cls, items: list[PreferenceIn]):
        categories = [item.sound_category for item in items]
        if len(categories) != len(set(categories)):
            raise ValueError("Each sound can only appear once")
        return items


class PreferenceOut(_Out):
    id: int
    sound_category: str
    sensitivity_level: Level

    @computed_field
    @property
    def label(self) -> str:
        return label_for(self.sound_category)


# -------------------------------------------------------------------- events


class EventCreate(_In):
    sound_category: Category
    timestamp: EventTime = None  # defaults to now
    response: ResponseValue | None = None
    note: Note = None
    confidence: float | None = Field(default=None, ge=0, le=1)
    sound_level_dbfs: float | None = Field(default=None, ge=-120, le=0)
    approximate_location: Location = None
    source: EventSource = "manual"


class EventUpdate(_In):
    """Partial update: only the fields that are sent change. Send null to clear response, note or location."""

    sound_category: Category | None = None
    timestamp: EventTime = None
    response: ResponseValue | None = None
    note: Note = None
    approximate_location: Location = None


class EventOut(_Out):
    id: int
    sound_category: str
    confidence: float | None
    source: EventSource
    timestamp: datetime
    response: ResponseValue | None
    note: str | None
    sound_level_dbfs: float | None
    approximate_location: str | None
    created_at: datetime

    @computed_field
    @property
    def label(self) -> str:
        return label_for(self.sound_category)


class EventList(BaseModel):
    items: list[EventOut]
    total: int
    limit: int
    offset: int


# ------------------------------------------------------------ classification


class SoundGuess(BaseModel):
    sound: str
    label: str
    confidence: float


class ClassifyOut(BaseModel):
    sound: str | None = Field(description="Best guess, 'other', or null if the recording was too quiet")
    label: str | None
    confidence: float | None = Field(description="The model's estimate between 0 and 1. It is not a certainty.")
    detected: bool = Field(description="True when a tracked sound was named with enough confidence")
    quiet: bool = Field(description="True when the recording was too quiet to analyse")
    sensitivity: Level = Field(description="How relevant the user marked this sound")
    alert: bool
    message: str
    level_dbfs: float | None = Field(description="Recording level relative to the microphone maximum. Not dB SPL.")
    top: list[SoundGuess]
    recorded: bool = Field(description="True if a new history entry was created")
    event_id: int | None
    disclaimer: str


# ----------------------------------------------------------------- analytics


class SoundCount(BaseModel):
    sound_category: str
    label: str
    count: int


class DayCount(BaseModel):
    date: str
    count: int


class ResponseCount(BaseModel):
    response: str
    label: str
    count: int


class AnalyticsOut(BaseModel):
    total_events: int
    high_relevance_events: int
    most_frequent_sound: SoundCount | None
    by_sound: list[SoundCount]
    by_day: list[DayCount]
    by_response: list[ResponseCount]
    days: int
    tz: str


# ------------------------------------------------------------------- catalogue


class SoundInfo(BaseModel):
    id: str
    label: str
    detectable: bool = Field(description="True if the loaded model can recognise this sound")