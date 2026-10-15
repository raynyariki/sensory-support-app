import numpy as np
import pytest

from app.audio import FEATURE_NAMES, AudioError, decode_audio_bytes, extract_features, prepare_signal, prepare_upload
from tests.synth import noise, silence, tone, wav_bytes


def test_feature_vector_has_the_documented_shape():
    p = prepare_signal(tone())
    f = extract_features(p.y)
    assert f.shape == (len(FEATURE_NAMES),) == (64,)
    assert np.isfinite(f).all()


def test_different_sounds_give_different_features():
    a = extract_features(prepare_signal(tone(880)).y)
    b = extract_features(prepare_signal(noise()).y)
    assert not np.allclose(a, b)


def test_level_is_measured_before_normalisation_and_signal_is_normalised():
    loud = prepare_signal(tone(amplitude=0.8))
    quiet = prepare_signal(tone(amplitude=0.01))
    assert loud.level_dbfs > quiet.level_dbfs + 20
    assert abs(np.max(np.abs(quiet.y)) - 1.0) < 1e-3


def test_silence_is_reported_as_silent():
    assert prepare_signal(silence()).level_dbfs <= -100


def test_long_recordings_are_cut_to_five_seconds_and_short_ones_padded():
    long = prepare_signal(tone(seconds=9))
    assert len(long.y) <= 5 * 22_050
    short = prepare_signal(tone(seconds=0.6))
    assert len(short.y) >= 22_050


def test_other_sample_rates_are_resampled():
    y = decode_audio_bytes(wav_bytes(tone(sample_rate=44_100, seconds=1), 44_100), 15)
    assert abs(len(y) - 22_050) < 5


def test_bad_uploads_are_refused():
    with pytest.raises(AudioError):
        prepare_upload(b"this is not audio", 15)
    with pytest.raises(AudioError):
        prepare_upload(wav_bytes(tone(seconds=20)), 15)
    with pytest.raises(AudioError):
        prepare_upload(wav_bytes(tone(seconds=0.1)), 15)