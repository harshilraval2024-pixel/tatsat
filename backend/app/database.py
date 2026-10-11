import os
from collections.abc import AsyncGenerator

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


def _render_runtime() -> bool:
    return os.environ.get("RENDER", "").lower() in ("true", "1", "yes")


settings = get_settings()


def _remote_postgres() -> bool:
    """True when the Postgres host is not this machine (Neon, Render, Supabase, ...)."""
    try:
        host = (make_url(settings.database_url_sync).host or "").lower()
    except Exception:  # noqa: BLE001
        return False
    return host not in ("", "localhost", "127.0.0.1", "::1", "postgres", "db")


_engine_kw: dict = {
    "echo": settings.debug,
    "pool_pre_ping": not settings.database_url.lower().startswith("sqlite"),
}
_du = settings.database_url.lower()
if "sqlite" in _du and "aiosqlite" in settings.database_url:
    # Local SQLite file + asyncio
    _engine_kw["connect_args"] = {"check_same_thread": False}
elif "postgresql+asyncpg" in _du and (_render_runtime() or _remote_postgres()):
    # Hosted Postgres (Neon, Render, ...): encrypt the connection. "require" does not
    # verify the server certificate/hostname, which fails for some internal hostnames
    # when ssl=True (verify-full) is used.
    _engine_kw["connect_args"] = {"ssl": "require"}
    # Serverless Postgres suspends idle compute; recycle so stale sockets are replaced.
    _engine_kw["pool_recycle"] = 240

async_engine = create_async_engine(
    settings.database_url,
    **_engine_kw,
)
AsyncSessionLocal = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

_sync_kw: dict = {"echo": settings.debug, "pool_pre_ping": True}
if "postgresql" in settings.database_url_sync.lower() and (_render_runtime() or _remote_postgres()):
    # Alembic / sync scripts on Render (psycopg2).
    _sync_kw["connect_args"] = {"sslmode": "require"}

sync_engine = create_engine(
    settings.database_url_sync,
    **_sync_kw,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=sync_engine)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
