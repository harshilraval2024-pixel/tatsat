from collections.abc import AsyncGenerator

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()
_engine_kw: dict = {
    "echo": settings.debug,
    "pool_pre_ping": not settings.database_url.lower().startswith("sqlite"),
}
if "sqlite" in settings.database_url.lower() and "aiosqlite" in settings.database_url:
    # Local SQLite file + asyncio
    _engine_kw["connect_args"] = {"check_same_thread": False}
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
