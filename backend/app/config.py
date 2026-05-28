"""Application configuration from environment."""
from __future__ import annotations

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """App settings; load from env or .env file."""

    # Database (Neon PostgreSQL)
    DATABASE_URL: str = "postgresql://localhost/school_db"

    # JWT - in-house auth only (no Google/third-party)
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    APP_NAME: str = "School Management System"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

    # Auth caching (local perf). Set 0 to disable caching.
    CURRENT_USER_CACHE_TTL_SEC: float = 60.0

    # CORS
    # Comma-separated list, e.g. "http://localhost:3000,http://127.0.0.1:3000"
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # File storage (local path; replace with S3 backend later if needed)
    STORAGE_PATH: str = "uploads"

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    _validate_settings(s)
    return s


def parse_cors_origins(value: str) -> list[str]:
    parts = [p.strip() for p in (value or "").split(",")]
    return [p for p in parts if p]


def _validate_settings(settings: Settings) -> None:
    """Fail fast for unsafe production defaults."""
    env = (settings.ENVIRONMENT or "").lower()
    if env in ("production", "prod", "staging") and settings.SECRET_KEY.strip() in (
        "",
        "change-me-in-production",
    ):
        raise RuntimeError(
            "Unsafe SECRET_KEY for non-dev environment. Set SECRET_KEY to a strong value."
        )
