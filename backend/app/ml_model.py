"""Loads the trained sound classifier and uses it.

The model is a scikit-learn pipeline saved by `python -m ml.train`. It is loaded
once, the first time it is needed. If it has not been trained yet, the rest of
the API still works and `/classify` explains what to do.

Note: model.joblib is a pickle file. Only load model files you created yourself.
"""

import json
import threading
from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np

from app.audio import FEATURE_NAMES, TARGET_SR
from app.catalogue import OTHER
from app.config import get_settings


class ModelNotAvailable(RuntimeError):
    """There is no usable trained model."""


class ModelService:
    def __init__(self, model_dir: Path):
        self.model_dir = Path(model_dir)
        self._model = None
        self._meta: dict | None = None
        self._lock = threading.Lock()

    def _load(self) -> None:
        if self._model is not None:
            return
        with self._lock:
            if self._model is not None:
                return
            model_path = self.model_dir / "model.joblib"
            meta_path = self.model_dir / "model_meta.json"
            if not model_path.exists() or not meta_path.exists():
                raise ModelNotAvailable(
                    "The sound recognition model has not been trained yet. "
                    "Run `python -m ml.train` first (see the README)."
                )
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            if meta.get("feature_names") != FEATURE_NAMES or meta.get("sample_rate") != TARGET_SR:
                raise ModelNotAvailable(
                    "The saved model was trained with a different audio pipeline. "
                    "Run `python -m ml.train` again."
                )
            self._model = joblib.load(model_path)
            self._meta = meta

    @property
    def available(self) -> bool:
        try:
            self._load()
        except ModelNotAvailable:
            return False
        return True

    @property
    def classes(self) -> list[str]:
        self._load()
        return [str(c) for c in self._model.classes_]

    def detectable_sounds(self) -> set[str]:
        """App sounds this model can recognise. Empty if no model is available."""
        if not self.available:
            return set()
        return {c for c in self.classes if c != OTHER}

    def info(self) -> dict:
        if not self.available:
            return {"loaded": False}
        meta = self._meta or {}
        return {
            "loaded": True,
            "classes": self.classes,
            "model_type": meta.get("model_type"),
            "trained_at": meta.get("trained_at"),
        }

    def predict(self, features: np.ndarray) -> list[tuple[str, float]]:
        """Return (sound, probability) pairs, most likely first."""
        self._load()
        probabilities = self._model.predict_proba(features.reshape(1, -1))[0]
        pairs = [(str(c), float(p)) for c, p in zip(self._model.classes_, probabilities)]
        return sorted(pairs, key=lambda pair: pair[1], reverse=True)


@lru_cache
def get_model_service() -> ModelService:
    return ModelService(get_settings().model_dir)