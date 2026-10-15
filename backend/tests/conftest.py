import os

# Settings must be in place before the app is imported.
os.environ["SECRET_KEY"] = "test-secret-key-that-is-at-least-32-characters-long"
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["BCRYPT_ROUNDS"] = "4"  # fast hashing; production uses 12

import numpy as np
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db, make_engine
from app.limiter import login_limiter
from app.main import app
from app.ml_model import get_model_service

PASSWORD = "correct-horse-1"


class FakeModel:
    """Stands in for the trained model so API tests do not depend on training."""

    def __init__(self, guesses=None):
        self.guesses = guesses or [("siren", 0.9), ("other", 0.07), ("car_horn", 0.03)]
        self.is_available = True

    @property
    def available(self):
        return self.is_available

    def detectable_sounds(self):
        return {"siren", "car_horn", "dog_barking", "alarm"} if self.is_available else set()

    def info(self):
        return {"loaded": True, "classes": ["siren", "other"]} if self.is_available else {"loaded": False}

    def predict(self, features):
        from app.ml_model import ModelNotAvailable

        assert isinstance(features, np.ndarray)
        if not self.is_available:
            raise ModelNotAvailable("The sound recognition model has not been trained yet.")
        return self.guesses


@pytest.fixture()
def fake_model():
    return FakeModel()


@pytest.fixture()
def client(fake_model):
    engine = make_engine("sqlite://")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_model_service] = lambda: fake_model
    login_limiter.reset()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    engine.dispose()


def register(client, email="amina@example.com", name="Amina", password=PASSWORD, **extra):
    return client.post("/auth/register", json={"name": name, "email": email, "password": password, **extra})


@pytest.fixture()
def auth(client):
    """Headers for a freshly registered user."""
    token = register(client).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def second_auth(client):
    token = register(client, email="baraka@example.com", name="Baraka").json()["access_token"]
    return {"Authorization": f"Bearer {token}"}