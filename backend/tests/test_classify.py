from tests.synth import silence, tone, wav_bytes


def send(client, auth, signal=None, **params):
    signal = tone(seconds=2) if signal is None else signal
    return client.post("/classify", headers=auth, params=params, files={"file": ("clip.wav", wav_bytes(signal), "audio/wav")})


def rate(client, auth, sound="siren", level="high"):
    client.put("/sound-preferences", headers=auth, json={"preferences": [{"sound_category": sound, "sensitivity_level": level}]})


def test_requires_login(client):
    assert client.post("/classify", files={"file": ("c.wav", wav_bytes(tone()), "audio/wav")}).status_code == 401


def test_detected_sound_triggers_alert_and_is_recorded(client, auth):
    rate(client, auth)
    r = send(client, auth)
    assert r.status_code == 200
    body = r.json()
    assert body["detected"] and body["sound"] == "siren" and body["alert"] and body["recorded"]
    assert body["sensitivity"] == "high" and "not a medical device" in body["disclaimer"]
    events = client.get("/sound-events", headers=auth).json()
    assert events["total"] == 1 and events["items"][0]["source"] == "monitoring"


def test_cooldown_prevents_duplicate_entries(client, auth):
    rate(client, auth)
    first = send(client, auth).json()
    second = send(client, auth).json()
    assert first["recorded"] and not second["recorded"] and second["event_id"] == first["event_id"]
    assert client.get("/sound-events", headers=auth).json()["total"] == 1


def test_unrated_sound_is_not_recorded_and_does_not_alert(client, auth):
    body = send(client, auth).json()
    assert body["detected"] and body["sensitivity"] == "none" and not body["alert"] and not body["recorded"]


def test_record_false_saves_nothing(client, auth):
    rate(client, auth)
    assert not send(client, auth, record="false").json()["recorded"]
    assert client.get("/sound-events", headers=auth).json()["total"] == 0


def test_alerts_off_or_threshold_too_high(client, auth):
    rate(client, auth, level="medium")
    client.put("/settings", headers=auth, json={"alerts_enabled": True, "alert_threshold": "high"})
    assert not send(client, auth).json()["alert"]
    client.put("/settings", headers=auth, json={"alerts_enabled": False, "alert_threshold": "low"})
    assert not send(client, auth).json()["alert"]


def test_low_confidence_and_other_are_not_detections(client, auth, fake_model):
    rate(client, auth)
    fake_model.guesses = [("siren", 0.3), ("other", 0.3), ("alarm", 0.2)]
    low = send(client, auth).json()
    assert not low["detected"] and not low["alert"] and not low["recorded"]
    fake_model.guesses = [("other", 0.95), ("siren", 0.05)]
    other = send(client, auth).json()
    assert not other["detected"] and other["sound"] == "other"


def test_quiet_recording_is_a_normal_response(client, auth):
    r = send(client, auth, signal=silence())
    assert r.status_code == 200 and r.json()["quiet"] and r.json()["sound"] is None
    r = send(client, auth, signal=tone(amplitude=0.0005))
    assert r.json()["quiet"]


def test_bad_uploads(client, auth):
    junk = client.post("/classify", headers=auth, files={"file": ("x.wav", b"not audio", "audio/wav")})
    assert junk.status_code == 422
    empty = client.post("/classify", headers=auth, files={"file": ("x.wav", b"", "audio/wav")})
    assert empty.status_code == 422
    too_long = send(client, auth, signal=tone(seconds=20))
    assert too_long.status_code == 422
    assert client.post("/classify", headers=auth).status_code == 422


def test_model_not_trained_gives_503(client, auth, fake_model):
    fake_model.is_available = False
    assert send(client, auth).status_code == 503


def test_health_and_sounds(client, fake_model):
    h = client.get("/health").json()
    assert h["status"] == "ok" and h["database"] == "ok" and h["model"]["loaded"]
    sounds = {s["id"]: s["detectable"] for s in client.get("/sounds").json()}
    assert sounds["siren"] and not sounds["drilling"]  # drilling needs UrbanSound8K
    fake_model.is_available = False
    assert not any(s["detectable"] for s in client.get("/sounds").json())
    assert client.get("/health").json()["model"] == {"loaded": False}