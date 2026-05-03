from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Tatsat Solar Estimator API"
    debug: bool = False

    database_url: str = "postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/solar_estimator"
    # Sync URL for Alembic / scripts
    database_url_sync: str = "postgresql://postgres:postgres@127.0.0.1:5432/solar_estimator"

    jwt_secret: str = "change-me-in-production-use-long-random-string"
    jwt_algorithm: str = "HS256"
    jwt_exp_hours: int = 24

    cors_origins: str = (
        "http://localhost:3000,http://localhost:3001,"
        "http://127.0.0.1:3000,http://127.0.0.1:3001,"
        "http://localhost:5173"
    )

    # Extra origins for browser dev (LAN / Docker bridge). Set CORS_ORIGIN_REGEX= to disable.
    cors_origin_regex: str = (
        r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"
        r"|^https?://\[::1\](:\d+)?$"
        r"|^https?://192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$"
        r"|^https?://10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$"
        r"|^https?://172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}(:\d+)?$"
    )

    # WhatsApp (optional) — e.g. Twilio or Meta API base URL; leave empty to disable
    whatsapp_api_url: str = ""
    whatsapp_api_token: str = ""

    @model_validator(mode="after")
    def _derive_sync_from_async_sqlite(self) -> "Settings":
        u = self.database_url or ""
        if u.startswith("sqlite+aiosqlite"):
            # One source of truth for local dev: async + sync sqlite file match
            self.database_url_sync = u.replace("sqlite+aiosqlite", "sqlite", 1)
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
