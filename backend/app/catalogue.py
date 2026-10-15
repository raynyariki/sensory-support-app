"""The sounds the application knows about, and the fixed vocabularies it uses.

This file is the single source of truth. The database, the API, the classifier
and the training script all read from here.

How dataset labels map onto app sounds
--------------------------------------
Each app sound lists the dataset classes that count as that sound. Any dataset
class that is not listed becomes the special class "other", so the model can
say "none of the sounds I track" instead of forcing every noise into a category.

No class is invented. ESC-50 has no drilling or jackhammer recordings, so those
two sounds can only be trained from UrbanSound8K. `GET /sounds` tells the
frontend which sounds the currently loaded model can actually detect.

"alarm" is trained on ESC-50 "clock_alarm" (alarm-clock beeps) only. It must
not be presented as fire-alarm or smoke-alarm detection.
"""

from dataclasses import dataclass

OTHER = "other"
OTHER_LABEL = "Other sound"


@dataclass(frozen=True)
class Sound:
    id: str
    label: str
    esc50: tuple[str, ...] = ()
    urbansound8k: tuple[str, ...] = ()


SOUNDS: tuple[Sound, ...] = (
    Sound("siren", "Siren", esc50=("siren",), urbansound8k=("siren",)),
    Sound("car_horn", "Car horn", esc50=("car_horn",), urbansound8k=("car_horn",)),
    Sound("drilling", "Drilling", urbansound8k=("drilling",)),
    Sound("jackhammer", "Jackhammer", urbansound8k=("jackhammer",)),
    Sound("dog_barking", "Dog barking", esc50=("dog",), urbansound8k=("dog_bark",)),
    Sound("alarm", "Alarm", esc50=("clock_alarm",)),
)

SOUND_IDS: tuple[str, ...] = tuple(s.id for s in SOUNDS)
_BY_ID = {s.id: s for s in SOUNDS}

# How relevant a sound is to the user. "none" means "Not relevant".
SENSITIVITY_LEVELS: tuple[str, ...] = ("high", "medium", "low", "none")
ALERT_THRESHOLDS: tuple[str, ...] = ("high", "medium", "low")

# How a sound felt, recorded in the diary.
RESPONSES: dict[str, str] = {
    "comfortable": "Comfortable",
    "uncomfortable": "Uncomfortable",
    "very_uncomfortable": "Very uncomfortable",
}


def is_known_sound(sound_id: str) -> bool:
    return sound_id in _BY_ID


def label_for(sound_id: str) -> str:
    if sound_id == OTHER:
        return OTHER_LABEL
    sound = _BY_ID.get(sound_id)
    return sound.label if sound else sound_id


def sort_key(sound_id: str) -> int:
    """Position of a sound in the catalogue, used to keep lists in a stable order."""
    try:
        return SOUND_IDS.index(sound_id)
    except ValueError:
        return len(SOUND_IDS)


def dataset_class_map(dataset: str) -> dict[str, str]:
    """Map a dataset's class names to app sound ids. 'esc50' or 'urbansound8k'."""
    mapping: dict[str, str] = {}
    for sound in SOUNDS:
        for dataset_class in getattr(sound, dataset):
            mapping[dataset_class] = sound.id
    return mapping