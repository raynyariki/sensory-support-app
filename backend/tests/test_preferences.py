def add(client, auth, sound="siren", level="high"):
    return client.post("/sound-preferences", headers=auth, json={"sound_category": sound, "sensitivity_level": level})


def test_add_list_update_delete(client, auth):
    r = add(client, auth)
    assert r.status_code == 201 and r.json()["label"] == "Siren"
    pid = r.json()["id"]
    assert len(client.get("/sound-preferences", headers=auth).json()) == 1
    up = client.put(f"/sound-preferences/{pid}", headers=auth, json={"sensitivity_level": "low"})
    assert up.json()["sensitivity_level"] == "low"
    assert client.delete(f"/sound-preferences/{pid}", headers=auth).status_code == 204
    assert client.get("/sound-preferences", headers=auth).json() == []


def test_duplicate_sound_is_refused_with_existing_id(client, auth):
    first = add(client, auth).json()
    r = add(client, auth, level="low")
    assert r.status_code == 409 and r.json()["existing_id"] == first["id"]


def test_validation(client, auth):
    assert add(client, auth, sound="").status_code == 422
    assert add(client, auth, sound="vuvuzela").status_code == 422
    assert add(client, auth, level="extreme").status_code == 422


def test_bulk_save_adds_and_updates_but_keeps_other_sounds(client, auth):
    add(client, auth, "siren", "high")
    r = client.put("/sound-preferences", headers=auth, json={"preferences": [
        {"sound_category": "siren", "sensitivity_level": "low"},
        {"sound_category": "car_horn", "sensitivity_level": "medium"},
    ]})
    assert r.status_code == 200
    levels = {p["sound_category"]: p["sensitivity_level"] for p in client.get("/sound-preferences", headers=auth).json()}
    assert levels == {"siren": "low", "car_horn": "medium"}


def test_users_cannot_touch_each_others_preferences(client, auth, second_auth):
    pid = add(client, auth).json()["id"]
    assert client.put(f"/sound-preferences/{pid}", headers=second_auth, json={"sensitivity_level": "low"}).status_code == 404
    assert client.delete(f"/sound-preferences/{pid}", headers=second_auth).status_code == 404
    assert client.get("/sound-preferences", headers=second_auth).json() == []