import logging
import os

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.config import get_settings
from app.database import AsyncSessionLocal

router = APIRouter(tags=["health"])
log = logging.getLogger(__name__)
settings = get_settings()


def _db_config_hint() -> str:
    on_render = os.environ.get("RENDER", "").lower() in ("true", "1", "yes")
    url = settings.database_url.lower()
    if on_render and ("127.0.0.1" in url or "localhost" in url):
        return (
            "DATABASE_URL is still localhost on Render. In the dashboard: create/link Postgres, "
            "paste the Internal Database URL into DATABASE_URL, redeploy, then run seed_data."
        )
    return (
        "Check DATABASE_URL, run `alembic upgrade head`, then `python -m app.scripts.seed_data`."
    )


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/db")
async def health_db() -> JSONResponse:
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return JSONResponse({"status": "ok", "database": "connected"})
    except SQLAlchemyError:
        log.exception("Database health check failed")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "error",
                "database": "disconnected",
                "hint": _db_config_hint(),
            },
        )
