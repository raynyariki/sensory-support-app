"""Application settings, read from environment variables or the .env file.

Nothing secret lives in the code. The database password and the token signing
key are supplied through `.env`, which is excluded from Git.
"""

from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    # Database (PostgreSQL)
    database_url: str = "postgresql+psycopg://sensory:change-me@localhost:5432/sensory_support"

    # Authentication
    secret_key: str = ""
    bcrypt_rounds: int = 12
    access_token_hours: int = 8  # login without "remember me"
    remember_me_days: int = 30  # login with "remember me"
    login_max_attempts: int = 5
    login_window_seconds: int = 900

    # Browser access (comma-separated list of allowed frontend addresses)
    cors_origins: str = "http://localhost:5173"

    # Sound recognition
    model_dir: Path = BASE_DIR / "models"
    min_confidence: float = 0.5  # below this the app does not name a sound
    quiet_dbfs: float = -65.0  # recordings quieter than this are not classified
    max_upload_bytes: int = 5_000_000
    max_audio_seconds: float = 15.0
    event_cooldown_seconds: int = 60  # one automatic event per sound per minute

    @field_validator("secret_key")
    @classmethod
    def _secret_key_is_strong(cls, value: str) -> str:
        if len(value) < 32:
            raise ValueError(
                "SECRET_KEY must be set in .env and be at least 32 characters. "
                'Generate one with: python -c "import secrets; print(secrets.token_urlsafe(48))"'
            )
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()