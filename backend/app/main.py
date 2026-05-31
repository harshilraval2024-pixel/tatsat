import logging
import os
import time
from typing import Annotated

from fastapi import Depends, FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.dependencies import get_current_admin
from app.models import tables as T
from app.routes import admin, cms, health, public
from app.services.leads_export import streaming_leads_csv

settings = get_settings()
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger(__name__)

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Solar cost estimation API and admin",
)


origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
# Wildcard + allow_credentials=True is invalid in Starlette; use explicit dev defaults if unset.
if not origins:
    origins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://localhost:5173",
    ]
    log.warning("CORS_ORIGINS empty; using default dev origins (set CORS_ORIGINS in production).")

# Render: always allow the live Vercel site even if CORS_ORIGINS env was set to dev-only.
if os.environ.get("RENDER", "").lower() in ("true", "1", "yes"):
    for origin in ("https://tatsat.vercel.app", "https://tatsat-nrgs.vercel.app"):
        if origin not in origins:
            origins.append(origin)

_cors_kw: dict = {
    "allow_origins": origins,
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}
_rx = (settings.cors_origin_regex or "").strip()
if _rx:
    _cors_kw["allow_origin_regex"] = _rx
app.add_middleware(CORSMiddleware, **_cors_kw)


@app.middleware("http")
async def request_timer(request: Request, call_next):  # type: ignore[no-untyped-def]
    start = time.perf_counter()
    response: Response = await call_next(request)
    ms = (time.perf_counter() - start) * 1000
    if not request.url.path.startswith("/manage/assets"):
        log.info("%s %s -> %s in %.0fms", request.method, request.url.path, response.status_code, ms)
    return response


app.include_router(health.router)
app.include_router(public.router)
app.include_router(admin.router)
app.include_router(cms.router)


@app.get("/export-leads")
async def export_leads_public_alias(
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[T.AdminUser, Depends(get_current_admin)],
):
    """Same as GET /admin/export-leads — JWT on Authorization: Bearer."""
    return await streaming_leads_csv(session)


# Built admin UI: cd admin && npm run build
import os

_static_dir = os.path.join(os.path.dirname(__file__), "..", "static", "admin")
if os.path.isdir(_static_dir):
    app.mount(
        "/manage",
        StaticFiles(directory=_static_dir, html=True),
        name="admin_ui",
    )
else:
    log.warning(
        "Admin UI not built: missing %s (cd backend/admin && npm install && npm run build)",
        _static_dir,
    )

_uploads_dir = os.path.join(os.path.dirname(__file__), "..", "static", "uploads")
os.makedirs(_uploads_dir, exist_ok=True)
app.mount(
    "/uploads",
    StaticFiles(directory=_uploads_dir),
    name="uploads",
)
