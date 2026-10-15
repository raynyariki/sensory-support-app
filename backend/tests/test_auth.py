import jwt
import pytest

from app.config import get_settings
from tests.conftest import PASSWORD, register


def test_register_returns_token_and_user(client):
    r = register(client, email="  Amina@Example.COM ")
    assert r.status_code == 201
    body = r.json()
    assert body["user"]["email"] == "amina@example.com"
    assert "password" not in str(body).lower()  # no password or hash is ever returned
    assert body["token_type"] == "bearer"


def test_password_is_never_stored_in_plain_text(client):
    from app.models import User
    from app.database import get_db
    from app.main import app

    register(client)
    db = next(app.dependency_overrides[get_db]())
    stored = db.query(User).one().password_hash
    assert stored != PASSWORD and stored.startswith("$2")


@pytest.mark.parametrize(
    "payload,field,message",
    [
        ({"name": "", "email": "a@b.co", "password": PASSWORD}, "name", "Name cannot be empty"),
        ({"name": "A" * 51, "email": "a@b.co", "password": PASSWORD}, "name", "Name must be 50 characters or fewer"),
        ({"name": "A", "email": "", "password": PASSWORD}, "email", "Email cannot be empty"),
        ({"name": "A", "email": "not-an-email", "password": PASSWORD}, "email", "Enter a valid email address"),
        ({"name": "A", "email": "a@b.co", "password": ""}, "password", "Password cannot be empty"),
        ({"name": "A", "email": "a@b.co", "password": "short"}, "password", "Password must be at least 8 characters"),
        ({"name": "A", "email": "a@b.co", "password": "x" * 73}, "password", "Password is too long (72 bytes maximum)"),
        ({"name": "A", "email": "a@b.co", "password": PASSWORD, "confirm_password": "different"}, "confirm_password", None),
    ],
)
def test_register_validation(client, payload, field, message):
    r = client.post("/auth/register", json=payload)
    assert r.status_code == 422
    assert field in r.json()["errors"]
    if message:
        assert r.json()["errors"][field] == message


def test_missing_field_reads_like_empty(client):
    r = client.post("/auth/register", json={"name": "A", "password": PASSWORD})
    assert r.status_code == 422
    assert r.json()["errors"]["email"] == "Email cannot be empty"


def test_unknown_fields_are_rejected(client):
    r = client.post("/auth/register", json={"name": "A", "email": "a@b.co", "password": PASSWORD, "is_admin": True})
    assert r.status_code == 422


def test_duplicate_email_is_refused_case_insensitively(client):
    assert register(client).status_code == 201
    r = register(client, email="AMINA@example.com")
    assert r.status_code == 409
    assert "email" in r.json()["errors"]


def test_login_success_and_wrong_credentials(client):
    register(client)
    ok = client.post("/auth/login", json={"email": "amina@example.com", "password": PASSWORD})
    assert ok.status_code == 200
    bad = client.post("/auth/login", json={"email": "amina@example.com", "password": "wrong-pass-1"})
    unknown = client.post("/auth/login", json={"email": "nobody@example.com", "password": "wrong-pass-1"})
    assert bad.status_code == unknown.status_code == 401
    assert bad.json() == unknown.json()  # does not reveal which emails exist


def test_remember_me_changes_token_lifetime(client):
    register(client)
    short = client.post("/auth/login", json={"email": "amina@example.com", "password": PASSWORD}).json()
    long = client.post("/auth/login", json={"email": "amina@example.com", "password": PASSWORD, "remember_me": True}).json()
    settings = get_settings()
    assert short["expires_in"] == settings.access_token_hours * 3600
    assert long["expires_in"] == settings.remember_me_days * 86400


def test_login_is_throttled_after_repeated_failures(client):
    register(client)
    for _ in range(get_settings().login_max_attempts):
        client.post("/auth/login", json={"email": "amina@example.com", "password": "wrong-pass-1"})
    r = client.post("/auth/login", json={"email": "amina@example.com", "password": PASSWORD})
    assert r.status_code == 429
    assert "Retry-After" in r.headers


def test_protected_routes_need_a_valid_token(client):
    assert client.get("/profile").status_code == 401
    assert client.get("/profile", headers={"Authorization": "Bearer nonsense"}).status_code == 401


def test_expired_token_is_refused(client, auth):
    settings = get_settings()
    payload = jwt.decode(auth["Authorization"].split()[1], settings.secret_key, algorithms=["HS256"])
    payload["exp"] = payload["iat"] - 10
    old = jwt.encode(payload, settings.secret_key, algorithm="HS256")
    assert client.get("/profile", headers={"Authorization": f"Bearer {old}"}).status_code == 401


def test_logout_invalidates_the_token(client, auth):
    assert client.get("/profile", headers=auth).status_code == 200
    assert client.post("/auth/logout", headers=auth).status_code == 204
    assert client.get("/profile", headers=auth).status_code == 401