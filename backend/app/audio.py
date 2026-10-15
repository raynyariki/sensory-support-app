"""Audio decoding, clean-up and feature extraction.

This one file is used both when the model is trained and when it is used, so a
recording gets exactly the same treatment either way. If the two differed, the
model would be judged on audio that looks different from what it learned.

Pipeline
    bytes -> decode -> mono, 22,050 Hz -> trim silence -> pick the loudest 5 s
          -> measure level -> peak-normalise -> features (one vector per recording)

Features (64 numbers, each the mean and standard deviation over the recording)
    MFCC (20)            the overall "timbre" of a sound; the standard baseline for
                         environmental audio
    spectral centroid    how bright the sound is (a siren is brighter than a rumble)
    spectral bandwidth   how widely the energy is spread across frequencies
    spectral roll-off    the frequency below which most of the energy sits
    zero-crossing rate   noisy sounds cross zero often; smooth tones do not
    RMS energy           loudness over time, so bursts (barking, drilling) differ from steady sounds
    spectral contrast    peaks versus valleys in the spectrum; tonal sounds (horns, sirens)
                         have strong peaks, noise does not
    spectral flatness    close to 1 for noise, close to 0 for a pure tone

A full Mel spectrogram is not used here. MFCCs already summarise it compactly, which
suits a Random Forest or SVM. The spectrogram is the natural input if a CNN is tried
later as an optional advanced approach.
"""

import io
from dataclasses import dataclass
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf

TARGET_SR = 22_050
CLIP_SECONDS = 5.0
MIN_CLIP_SECONDS = 1.0  # shorter clips are repeated to reach this length
MIN_RECORDING_SECONDS = 0.5  # shorter uploads are rejected
N_FFT = 2048
HOP_LENGTH = 512
N_MFCC = 20
N_CONTRAST_ROWS = 6  # spectral contrast with n_bands=5
SILENCE_PEAK = 1e-4  # below this the recording is digital silence (about -80 dBFS)
TRIM_TOP_DB = 60  # trim the start and end while quieter than 60 dB below the peak

# (name, number of values per frame). Order matters: it is the order of the feature vector.
_FEATURE_GROUPS = (
    ("mfcc", N_MFCC),
    ("centroid", 1),
    ("bandwidth", 1),
    ("rolloff", 1),
    ("zcr", 1),
    ("rms", 1),
    ("contrast", N_CONTRAST_ROWS),
    ("flatness", 1),
)


def _build_feature_names() -> list[str]:
    names: list[str] = []
    for group, rows in _FEATURE_GROUPS:
        if rows == 1:
            names += [f"{group}_mean", f"{group}_std"]
        else:
            names += [f"{group}_{i:02d}_mean" for i in range(1, rows + 1)]
            names += [f"{group}_{i:02d}_std" for i in range(1, rows + 1)]
    return names


FEATURE_NAMES: list[str] = _build_feature_names()


class AudioError(ValueError):
    """The recording cannot be used (unsupported format, too long, too short, damaged)."""


@dataclass
class PreparedAudio:
    y: np.ndarray  # normalised signal, ready for feature extraction
    level_dbfs: float  # RMS level of the analysed part, before normalisation
    peak: float  # peak amplitude of the original recording (0 to 1)


# ------------------------------------------------------------------- decoding


def decode_audio_bytes(data: bytes, max_seconds: float) -> np.ndarray:
    """Decode an uploaded recording to a mono signal at TARGET_SR.

    WAV is the supported format. Browsers' default MediaRecorder output (WebM/Opus)
    cannot be decoded without extra software, so the website should send WAV.
    """
    try:
        info = sf.info(io.BytesIO(data))
    except Exception as exc:
        raise AudioError("Unsupported or damaged audio file. Please send a WAV recording.") from exc

    if info.frames == 0:
        raise AudioError("The recording is empty.")
    if info.duration > max_seconds:
        raise AudioError(f"Recording must be {max_seconds:g} seconds or shorter.")

    try:
        samples, sample_rate = sf.read(io.BytesIO(data), dtype="float32", always_2d=True)
    except Exception as exc:
        raise AudioError("Unsupported or damaged audio file. Please send a WAV recording.") from exc

    signal = samples.mean(axis=1)
    if sample_rate != TARGET_SR:
        signal = librosa.resample(signal, orig_sr=sample_rate, target_sr=TARGET_SR)

    if len(signal) / TARGET_SR < MIN_RECORDING_SECONDS:
        raise AudioError(f"Recording is too short (minimum {MIN_RECORDING_SECONDS:g} seconds).")
    return signal


# ----------------------------------------------------------------- preparing


def _loudest_window(signal: np.ndarray, length: int) -> np.ndarray:
    """If the signal is longer than `length` samples, keep the loudest stretch."""
    if len(signal) <= length:
        return signal
    cumulative = np.concatenate([[0.0], np.cumsum(signal.astype(np.float64) ** 2)])
    energy = cumulative[length:] - cumulative[:-length]
    start = int(np.argmax(energy))
    return signal[start : start + length]


def prepare_signal(signal: np.ndarray) -> PreparedAudio:
    """Clean a decoded signal. Silent input is returned unchanged with a tiny peak."""
    signal = np.nan_to_num(np.asarray(signal, dtype=np.float32))
    peak = float(np.max(np.abs(signal))) if len(signal) else 0.0
    if peak < SILENCE_PEAK:
        return PreparedAudio(y=signal, level_dbfs=-120.0, peak=peak)

    trimmed, _ = librosa.effects.trim(signal, top_db=TRIM_TOP_DB)
    if len(trimmed) == 0:
        trimmed = signal
    window = _loudest_window(trimmed, int(CLIP_SECONDS * TARGET_SR))

    minimum = int(MIN_CLIP_SECONDS * TARGET_SR)
    if len(window) < minimum:
        window = np.pad(window, (0, minimum - len(window)), mode="wrap")

    rms = float(np.sqrt(np.mean(window.astype(np.float64) ** 2)))
    level_dbfs = max(-120.0, 20.0 * float(np.log10(max(rms, 1e-6))))
    normalised = window / max(float(np.max(np.abs(window))), 1e-9)
    return PreparedAudio(y=normalised.astype(np.float32), level_dbfs=level_dbfs, peak=peak)


def prepare_upload(data: bytes, max_seconds: float) -> PreparedAudio:
    return prepare_signal(decode_audio_bytes(data, max_seconds))


# ------------------------------------------------------------------ features


def extract_features(signal: np.ndarray) -> np.ndarray:
    """Turn a prepared signal into one fixed-length feature vector."""
    spectrum = np.abs(librosa.stft(signal, n_fft=N_FFT, hop_length=HOP_LENGTH))
    mel = librosa.feature.melspectrogram(S=spectrum**2, sr=TARGET_SR, n_mels=64)
    matrices = {
        "mfcc": librosa.feature.mfcc(S=librosa.power_to_db(mel), n_mfcc=N_MFCC),
        "centroid": librosa.feature.spectral_centroid(S=spectrum, sr=TARGET_SR),
        "bandwidth": librosa.feature.spectral_bandwidth(S=spectrum, sr=TARGET_SR),
        "rolloff": librosa.feature.spectral_rolloff(S=spectrum, sr=TARGET_SR),
        "zcr": librosa.feature.zero_crossing_rate(signal, frame_length=N_FFT, hop_length=HOP_LENGTH),
        "rms": librosa.feature.rms(S=spectrum, frame_length=N_FFT),
        "contrast": librosa.feature.spectral_contrast(S=spectrum, sr=TARGET_SR, n_bands=N_CONTRAST_ROWS - 1),
        "flatness": librosa.feature.spectral_flatness(S=spectrum),
    }

    parts = []
    for group, rows in _FEATURE_GROUPS:
        matrix = matrices[group]
        if matrix.shape[0] != rows:
            raise RuntimeError(f"Feature '{group}' produced {matrix.shape[0]} rows, expected {rows}")
        parts.append(matrix.mean(axis=1))
        parts.append(matrix.std(axis=1))
    features = np.concatenate(parts).astype(np.float32)
    return np.nan_to_num(features)


def clip_features_from_file(path: str | Path) -> np.ndarray:
    """Features for one training clip on disk. Raises AudioError for unusable clips."""
    signal, _ = librosa.load(path, sr=TARGET_SR, mono=True)
    prepared = prepare_signal(signal)
    if prepared.peak < SILENCE_PEAK:
        raise AudioError("The clip is silent.")
    return extract_features(prepared.y)