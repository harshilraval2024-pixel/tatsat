import os
from collections.abc import AsyncGenerator

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


def _render_runtime() -> bool:
    return os.environ.get("RENDER", "").lower() in ("true", "1", "yes")


settings = get_settings()
_engine_kw: dict = {
    "echo": settings.debug,
    "pool_pre_ping": not settings.database_url.lower().startswith("sqlite"),
}
_du = settings.database_url.lower()
if "sqlite" in _du and "aiosqlite" in settings.database_url:
    # Local SQLite file + asyncio
    _engine_kw["connect_args"] = {"check_same_thread": False}
elif "postgresql+asyncpg" in _du and (
    _render_runtime()
    or "sslmode=require" in settings.database_url.lower()
    or "ssl=true" in settings.database_url.lower()
):
    # Render managed Postgres + asyncpg typically needs TLS for external hostname connections.
    _engine_kw["connect_args"] = {"ssl": True}
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

sync_engine = create_engine(
    settings.database_url_sync,
    echo=settings.debug,
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=sync_engine)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
