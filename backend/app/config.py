"""Application configuration from environment."""
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

    # File storage (local path; replace with S3 backend later if needed)
    STORAGE_PATH: str = "uploads"

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
