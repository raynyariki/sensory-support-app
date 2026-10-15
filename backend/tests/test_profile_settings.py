from tests.conftest import PASSWORD, register


def test_get_and_update_profile(client, auth):
    assert client.get("/profile", headers=auth).json()["name"] == "Amina"
    r = client.put("/profile", headers=auth, json={"name": "Amina W", "email": "new@example.com"})
    assert r.status_code == 200 and r.json()["email"] == "new@example.com"


def test_profile_email_must_stay_unique(client, auth, second_auth):
    r = client.put("/profile", headers=auth, json={"name": "Amina", "email": "baraka@example.com"})
    assert r.status_code == 409


def test_profile_validation(client, auth):
    r = client.put("/profile", headers=auth, json={"name": " ", "email": "x"})
    assert r.status_code == 422 and set(r.json()["errors"]) == {"name", "email"}


def test_change_password(client, auth):
    bad = client.put("/profile/password", headers=auth, json={"current_password": "nope-nope-1", "new_password": "brand-new-pass-2"})
    assert bad.status_code == 400
    assert bad.json()["errors"]["current_password"] == "Current password is incorrect"
    r = client.put("/profile/password", headers=auth, json={"current_password": PASSWORD, "new_password": "brand-new-pass-2"})
    assert r.status_code == 200
    assert client.get("/profile", headers=auth).status_code == 401  # old token no longer valid
    new_headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    assert client.get("/profile", headers=new_headers).status_code == 200
    assert client.post("/auth/login", json={"email": "amina@example.com", "password": "brand-new-pass-2"}).status_code == 200
    assert client.post("/auth/login", json={"email": "amina@example.com", "password": PASSWORD}).status_code == 401


def test_delete_account_needs_confirmation_and_removes_everything(client, auth):
    client.post("/sound-events", headers=auth, json={"sound_category": "siren"})
    client.put("/sound-preferences", headers=auth, json={"preferences": [{"sound_category": "siren", "sensitivity_level": "high"}]})
    assert client.delete("/profile", headers=auth).status_code == 400
    assert client.delete("/profile?confirm=true", headers=auth).status_code == 204
    assert client.post("/auth/login", json={"email": "amina@example.com", "password": PASSWORD}).status_code == 401
    # The email can be registered again, and the new account starts empty.
    token = register(client).json()["access_token"]
    fresh = {"Authorization": f"Bearer {token}"}
    assert client.get("/sound-events", headers=fresh).json()["total"] == 0
    assert client.get("/sound-preferences", headers=fresh).json() == []


def test_settings_defaults_and_update(client, auth):
    s = client.get("/settings", headers=auth).json()
    assert s["alerts_enabled"] is True
    r = client.put("/settings", headers=auth, json={"alerts_enabled": False, "alert_threshold": "high"})
    assert r.json() == {"alerts_enabled": False, "alert_threshold": "high"}
    assert client.put("/settings", headers=auth, json={"alerts_enabled": True, "alert_threshold": "none"}).status_code == 422