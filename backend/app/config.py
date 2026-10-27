import os
import re
from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Defaults used to detect “only DATABASE_URL was set” (e.g. Render) so we can derive the sync URL.
_DEFAULT_PG_ASYNC = "postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/solar_estimator"
_DEFAULT_PG_SYNC = "postgresql://postgres:postgres@127.0.0.1:5432/solar_estimator"


_DEFAULT_JWT_SECRET = "change-me-in-production-use-long-random-string"


def _strip_ssl_params(url: str) -> str:
    """Remove libpq-only query params (asyncpg takes TLS via connect_args instead)."""
    if "?" not in url:
        return url
    base, _, query = url.partition("?")
    drop = ("sslmode", "ssl", "channel_binding")  # libpq-only; asyncpg rejects them
    kept = [p for p in query.split("&") if p.split("=", 1)[0].lower() not in drop]
    return base + ("?" + "&".join(kept) if kept else "")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Tatsat Solar Estimator API"
    debug: bool = False

    database_url: str = _DEFAULT_PG_ASYNC
    # Sync URL for Alembic / scripts (derived from DATABASE_URL on Render if you only set that)
    database_url_sync: str = _DEFAULT_PG_SYNC

    jwt_secret: str = _DEFAULT_JWT_SECRET
    jwt_algorithm: str = "HS256"
    jwt_exp_hours: int = 24

    cors_origins: str = (
        "http://localhost:3000,http://localhost:3001,"
        "http://127.0.0.1:3000,http://127.0.0.1:3001,"
        "http://localhost:5173,"
        "https://tatsat.vercel.app,https://tatsat-nrgs.vercel.app"
    )

    # Extra origins for browser dev (LAN / Docker bridge) and Vercel previews. Set CORS_ORIGIN_REGEX= to disable.
    cors_origin_regex: str = (
        r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"
        r"|^https?://\[::1\](:\d+)?$"
        r"|^https?://192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$"
        r"|^https?://10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$"
        r"|^https?://172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}(:\d+)?$"
    )

    # Apply pending Alembic migrations when the API starts. Default: on when running on Render
    # (free web services have no shell/pre-deploy step), off elsewhere. Override with AUTO_MIGRATE=true/false.
    auto_migrate: bool | None = None

    # Solar Advisor (LLM chat). Disabled until a provider + key are configured.
    #   ai_provider: "gemini" | "openai" (any OpenAI-compatible API: OpenAI, Groq, ...) | "fake" (offline demo/tests)
    ai_provider: str = ""
    ai_api_key: str = ""
    ai_model: str = ""
    ai_base_url: str = ""  # only for provider "openai", e.g. https://api.groq.com/openai/v1
    ai_daily_limit: int = 500  # hard cap on chat requests per day across all visitors

    # WhatsApp (optional) — e.g. Twilio or Meta API base URL; leave empty to disable
    whatsapp_api_url: str = ""
    whatsapp_api_token: str = ""

    @model_validator(mode="after")
    def _require_strong_jwt_secret(self) -> "Settings":
        weak = self.jwt_secret == _DEFAULT_JWT_SECRET or len(self.jwt_secret) < 32
        on_render = os.environ.get("RENDER", "").lower() in ("true", "1", "yes")
        if weak and on_render:
            raise ValueError(
                "JWT_SECRET must be set to a random string of at least 32 characters in production."
            )
        return self

    @model_validator(mode="after")
    def _normalize_database_urls(self) -> "Settings":
        u = (self.database_url or "").strip()

        # Heroku-style "postgres://" is not understood by SQLAlchemy 2; treat as postgresql://.
        if u.startswith("postgres://"):
            u = "postgresql://" + u[len("postgres://"):]
            self.database_url = u

        # Snippets copied from provider docs often name another driver
        # (postgresql+psycopg://, +psycopg2://, +pg8000://). Only asyncpg and psycopg2
        # are installed, so normalise to plain postgresql:// and pick drivers below.
        m = re.match(r"^postgresql\+(\w+)://", u)
        if m and m.group(1) != "asyncpg":
            u = "postgresql://" + u[m.end():]
            self.database_url = u

        # Local SQLite: one URL drives both engines.
        if u.startswith("sqlite+aiosqlite"):
            self.database_url_sync = u.replace("sqlite+aiosqlite", "sqlite", 1)
            return self

        # Render / Heroku-style: paste `postgresql://...` (psycopg2-style). Async engine needs +asyncpg.
        if u.startswith("postgresql://") and not u.startswith("postgresql+asyncpg"):
            self.database_url_sync = u
            # asyncpg rejects psycopg2-style ?sslmode=… — TLS is configured in app.database.
            self.database_url = _strip_ssl_params(
                u.replace("postgresql://", "postgresql+asyncpg://", 1)
            )
            return self

        # Only DATABASE_URL set to async URL — sync was still default localhost (breaks Alembic & sync engine).
        if u.startswith("postgresql+asyncpg"):
            derived_sync = u.replace("postgresql+asyncpg", "postgresql", 1)
            if self.database_url_sync == _DEFAULT_PG_SYNC:
                self.database_url_sync = derived_sync

        return self

    @model_validator(mode="after")
    def _explicit_sync_driver(self) -> "Settings":
        # SQLAlchemy 2.1 changed the default driver for "postgresql://" from psycopg2 to
        # psycopg (v3), which is not installed. Name the driver we ship explicitly.
        if self.database_url_sync.startswith("postgresql://"):
            self.database_url_sync = "postgresql+psycopg2://" + self.database_url_sync[len("postgresql://"):]
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
