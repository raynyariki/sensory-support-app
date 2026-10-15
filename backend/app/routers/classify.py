"""POST /classify: recognise a sound, then personalise the result.

    recording -> pre-processing -> features -> model -> sound + confidence
              -> the user's sound profile -> alert decision -> history entry

The recording is analysed in memory and thrown away. Only the result is kept.
"""

from datetime import timedelta

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audio import AudioError, extract_features, prepare_upload
from app.catalogue import OTHER, label_for
from app.config import Settings, get_settings
from app.database import get_db
from app.deps import get_current_user
from app.errors import ApiError
from app.ml_model import ModelNotAvailable, ModelService, get_model_service
from app.models import SoundEvent, SoundPreference, User, utcnow
from app.personalisation import no_alert_message, relevance_message, should_alert
from app.schemas import ClassifyOut, SoundGuess

router = APIRouter(tags=["Sound recognition"])

DISCLAIMER = (
    "Confidence is the model's best estimate, not a certainty. "
    "This is a sensory-support tool, not a medical device."
)


@router.post("/classify", response_model=ClassifyOut, summary="Recognise a sound in a short recording")
def classify(
    file: UploadFile = File(..., description="A short WAV recording (up to about 5 seconds is ideal)"),
    record: bool = Query(True, description="Save a history entry when a sound you rated is detected"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    model: ModelService = Depends(get_model_service),
):
    # 1. Read the upload, refusing anything unreasonably large.
    data = file.file.read(settings.max_upload_bytes + 1)
    if len(data) > settings.max_upload_bytes:
        raise ApiError(413, f"The recording is too large (maximum {settings.max_upload_bytes // 1_000_000} MB).")
    if not data:
        raise ApiError(422, "No recording was received.")

    # 2. Decode and clean the audio.
    try:
        prepared = prepare_upload(data, settings.max_audio_seconds)
    except AudioError as exc:
        raise ApiError(422, str(exc))

    # 3. Too quiet to analyse: not an error, simply nothing to report.
    if prepared.level_dbfs < settings.quiet_dbfs:
        return ClassifyOut(
            sound=None,
            label=None,
            confidence=None,
            detected=False,
            quiet=True,
            sensitivity="none",
            alert=False,
            message="The recording was too quiet to identify a sound.",
            level_dbfs=round(prepared.level_dbfs, 1),
            top=[],
            recorded=False,
            event_id=None,
            disclaimer=DISCLAIMER,
        )

    # 4. Run the model.
    try:
        guesses = model.predict(extract_features(prepared.y))
    except ModelNotAvailable as exc:
        raise ApiError(503, str(exc))
    best_sound, best_confidence = guesses[0]
    detected = best_sound != OTHER and best_confidence >= settings.min_confidence

    top = [
        SoundGuess(sound=sound, label=label_for(sound), confidence=round(prob, 3))
        for sound, prob in guesses[:3]
    ]
    base = dict(
        sound=best_sound,
        label=label_for(best_sound),
        confidence=round(best_confidence, 3),
        quiet=False,
        level_dbfs=round(prepared.level_dbfs, 1),
        top=top,
        disclaimer=DISCLAIMER,
    )

    # 5. Nothing from the user's list was recognised.
    if not detected:
        message = (
            "None of the sounds you track were identified."
            if best_sound == OTHER
            else "The model is not confident enough to name this sound."
        )
        return ClassifyOut(
            **base, detected=False, sensitivity="none", alert=False, message=message, recorded=False, event_id=None
        )

    # 6. Personalise: look up how relevant this sound is to this user.
    preference = db.scalar(
        select(SoundPreference).where(
            SoundPreference.user_id == user.id, SoundPreference.sound_category == best_sound
        )
    )
    level = preference.sensitivity_level if preference else "none"
    alert = should_alert(level, user.alerts_enabled, user.alert_threshold)
    message = relevance_message(level) if alert else no_alert_message(level, user.alerts_enabled)

    # 7. Save a history entry for sounds the user rated, at most once per cooldown period
    #    so a continuous siren does not create dozens of entries.
    recorded = False
    event_id = None
    if record and level != "none":
        recent = db.scalar(
            select(SoundEvent)
            .where(
                SoundEvent.user_id == user.id,
                SoundEvent.sound_category == best_sound,
                SoundEvent.source == "monitoring",
                SoundEvent.timestamp >= utcnow() - timedelta(seconds=settings.event_cooldown_seconds),
            )
            .order_by(SoundEvent.timestamp.desc())
            .limit(1)
        )
        if recent:
            event_id = recent.id
        else:
            event = SoundEvent(
                user_id=user.id,
                sound_category=best_sound,
                confidence=round(best_confidence, 3),
                source="monitoring",
                timestamp=utcnow(),
                sound_level_dbfs=round(prepared.level_dbfs, 1),
            )
            db.add(event)
            db.commit()
            recorded, event_id = True, event.id

    return ClassifyOut(
        **base,
        detected=True,
        sensitivity=level,
        alert=alert,
        message=message,
        recorded=recorded,
        event_id=event_id,
    )