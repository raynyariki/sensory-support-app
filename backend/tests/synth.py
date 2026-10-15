"""Synthetic audio for tests, so no real recordings are needed."""

import io

import numpy as np
import soundfile as sf


def wav_bytes(signal: np.ndarray, sample_rate: int = 22_050) -> bytes:
    buffer = io.BytesIO()
    sf.write(buffer, signal.astype(np.float32), sample_rate, format="WAV", subtype="PCM_16")
    return buffer.getvalue()


def tone(frequency=880.0, seconds=2.0, amplitude=0.5, sample_rate=22_050) -> np.ndarray:
    t = np.arange(int(seconds * sample_rate)) / sample_rate
    return amplitude * np.sin(2 * np.pi * frequency * t)


def noise(seconds=2.0, amplitude=0.3, sample_rate=22_050, seed=0) -> np.ndarray:
    rng = np.random.default_rng(seed)
    return amplitude * rng.uniform(-1, 1, int(seconds * sample_rate))


def silence(seconds=2.0, sample_rate=22_050) -> np.ndarray:
    return np.zeros(int(seconds * sample_rate))