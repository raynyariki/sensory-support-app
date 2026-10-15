from datetime import datetime, timedelta, timezone


def create(client, auth, **body):
    body.setdefault("sound_category", "siren")
    return client.post("/sound-events", headers=auth, json=body)


def test_create_defaults_and_fields(client, auth):
    r = create(client, auth, response="uncomfortable", note="  Near the market ", approximate_location="Nairobi CBD")
    assert r.status_code == 201
    body = r.json()
    assert body["source"] == "manual" and body["note"] == "Near the market" and body["timestamp"]


def test_validation(client, auth):
    future = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    assert create(client, auth, sound_category="").status_code == 422
    assert create(client, auth, sound_category="vuvuzela").status_code == 422
    assert create(client, auth, timestamp=future).status_code == 422
    assert create(client, auth, timestamp="1990-01-01T00:00:00Z").status_code == 422
    assert create(client, auth, note="x" * 301).status_code == 422
    assert create(client, auth, approximate_location="x" * 81).status_code == 422
    assert create(client, auth, response="angry").status_code == 422
    assert create(client, auth, confidence=1.5).status_code == 422
    assert create(client, auth, sound_level_dbfs=5).status_code == 422


def test_list_is_newest_first_and_paginated_and_filtered(client, auth):
    now = datetime.now(timezone.utc)
    for i, sound in enumerate(["siren", "alarm", "siren"]):
        create(client, auth, sound_category=sound, timestamp=(now - timedelta(hours=3 - i)).isoformat())
    listing = client.get("/sound-events", headers=auth).json()
    assert listing["total"] == 3
    times = [e["timestamp"] for e in listing["items"]]
    assert times == sorted(times, reverse=True)
    assert len(client.get("/sound-events?limit=2&offset=2", headers=auth).json()["items"]) == 1
    assert client.get("/sound-events?sound_category=alarm", headers=auth).json()["total"] == 1
    since = (now - timedelta(minutes=150)).isoformat()
    assert client.get("/sound-events", headers=auth, params={"since": since}).json()["total"] == 2
    assert client.get("/sound-events?limit=0", headers=auth).status_code == 422


def test_get_update_delete(client, auth):
    eid = create(client, auth).json()["id"]
    assert client.get(f"/sound-events/{eid}", headers=auth).status_code == 200
    r = client.patch(f"/sound-events/{eid}", headers=auth, json={"response": "comfortable", "note": ""})
    assert r.status_code == 200 and r.json()["response"] == "comfortable" and r.json()["note"] is None
    assert client.delete(f"/sound-events/{eid}", headers=auth).status_code == 204
    assert client.get(f"/sound-events/{eid}", headers=auth).status_code == 404


def test_delete_all_needs_confirmation(client, auth):
    create(client, auth)
    create(client, auth)
    assert client.delete("/sound-events", headers=auth).status_code == 400
    r = client.delete("/sound-events?confirm=true", headers=auth)
    assert r.status_code == 200 and r.json() == {"deleted": 2}
    assert client.get("/sound-events", headers=auth).json()["total"] == 0


def test_users_cannot_see_or_change_each_others_events(client, auth, second_auth):
    eid = create(client, auth).json()["id"]
    assert client.get(f"/sound-events/{eid}", headers=second_auth).status_code == 404
    assert client.patch(f"/sound-events/{eid}", headers=second_auth, json={"note": "hi"}).status_code == 404
    assert client.delete(f"/sound-events/{eid}", headers=second_auth).status_code == 404
    assert client.get("/sound-events", headers=second_auth).json()["total"] == 0
    client.delete("/sound-events?confirm=true", headers=second_auth)
    assert client.get("/sound-events", headers=auth).json()["total"] == 1


def test_requires_login(client):
    assert client.get("/sound-events").status_code == 401
    assert client.post("/sound-events", json={"sound_category": "siren"}).status_code == 401