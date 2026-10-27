"""Admin: configure the AI provider and API key from the dashboard (key is write-only)."""

import logging
import re
from typing import Annotated, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.dependencies import get_current_admin
from app.models import tables as T
from app.services.ai.config import (
    DEFAULT_MODELS,
    clean_api_key,
    clean_base_url,
    clean_model,
    key_hint,
    resolve_ai_config,
)
from app.services.ai.providers import ProviderError, build_provider, pick_default_model
from app.services.site_settings import get_site_settings_row
from app.utils.ratelimit import limiter
from app.utils.secretbox import decrypt, encrypt

router = APIRouter(prefix="/admin/ai-settings", tags=["admin-ai"])
log = logging.getLogger(__name__)


class AiSettingsOut(BaseModel):
    provider: str                 # "" (use server environment) | "off" | "gemini" | "openai"
    model: str
    base_url: str
    key_set: bool
    key_hint: str                 # last 4 characters only, never the key
    key_readable: bool
    source: str                   # "admin" | "env" | "none"
    daily_limit: int
    default_model: str
    working_provider: str         # what is actually in effect right now


class AiSettingsIn(BaseModel):
    provider: Literal["", "off", "gemini", "openai"]
    model: str = Field("", max_length=100)
    base_url: str = Field("", max_length=300)
    api_key: Optional[str] = Field(None, max_length=400)  # None/blank = keep the saved key
    clear_key: bool = False
    daily_limit: Optional[int] = Field(None, ge=1, le=100_000)


class AiTestOut(BaseModel):
    ok: bool
    message: str


async def _row(session: AsyncSession) -> T.SiteSettings:
    row = await get_site_settings_row(session)
    if row is None:
        raise HTTPException(status_code=503, detail="Site settings missing. Run seed_data.")
    return row


def _out(row: T.SiteSettings) -> AiSettingsOut:
    cfg = resolve_ai_config(row, get_settings())
    stored = decrypt(row.ai_key_enc or "") or ""
    prov = (row.ai_provider or "").strip().lower()
    working = cfg.provider if cfg.provider in ("gemini", "openai", "fake") and (cfg.api_key or cfg.provider == "fake") else "off"
    return AiSettingsOut(
        provider=prov,
        model=row.ai_model or "",
        base_url=row.ai_base_url or "",
        key_set=bool(stored),
        key_hint=key_hint(stored),
        key_readable=not (row.ai_key_enc and not stored),
        source=cfg.source,
        daily_limit=cfg.daily_limit,
        default_model=DEFAULT_MODELS.get(prov or cfg.provider, ""),
        working_provider=working,
    )


@router.get("", response_model=AiSettingsOut)
async def get_ai_settings(
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[T.AdminUser, Depends(get_current_admin)],
) -> AiSettingsOut:
    return _out(await _row(session))


@router.put("", response_model=AiSettingsOut)
async def put_ai_settings(
    body: AiSettingsIn,
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[T.AdminUser, Depends(get_current_admin)],
) -> AiSettingsOut:
    row = await _row(session)
    try:
        model = clean_model(body.model)
        base_url = clean_base_url(body.base_url) if body.provider == "openai" else ""
        new_key = clean_api_key(body.api_key) if (body.api_key or "").strip() else None
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)) from e

    row.ai_provider = body.provider
    row.ai_model = model
    row.ai_base_url = base_url
    row.ai_daily_limit = body.daily_limit
    if body.clear_key:
        row.ai_key_enc = ""
    elif new_key:
        row.ai_key_enc = encrypt(new_key)
    await session.commit()
    log.info("AI settings updated (provider=%s, key_changed=%s)", body.provider, bool(new_key or body.clear_key))
    return _out(row)


_HTTP = re.compile(r"HTTP (\d{3})")


def _friendly(err: ProviderError) -> str:
    text = str(err)
    m = _HTTP.search(text)
    if m:
        code = int(m.group(1))
        if code in (401, 403):
            return "The provider rejected the API key. Check it is correct, active and allowed to use this model."
        if code == 404:
            return (
                "Model or endpoint not found. Leave the Model field blank for automatic selection, or click "
                "'Find available models' and pick one (and check the Base URL for OpenAI-compatible providers)."
            )
        if code == 400:
            return "The provider rejected the request. Check that the API key and the model name are correct."
        if code == 429:
            return "The provider says the quota or rate limit was reached. Try again later or check your plan."
        if code >= 500:
            return "The provider is having problems right now. Try again in a minute."
    if "transport" in text:
        return "Could not reach the provider. Check the Base URL and that the server has internet access."
    return "The provider returned an unexpected reply. Check the model name."


class ModelsOut(BaseModel):
    models: list[str]
    recommended: str = ""
    message: str = ""


@router.get("/models", response_model=ModelsOut)
async def list_available_models(
    session: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[T.AdminUser, Depends(get_current_admin)],
) -> ModelsOut:
    """Ask the provider which models the saved key can use (helps when model names change)."""
    limiter.check(f"ai-models:{admin.username}", 10, 60)
    row = await _row(session)
    cfg = resolve_ai_config(row, get_settings())
    if cfg.provider in ("", "off") or not cfg.key_readable:
        return ModelsOut(models=[], message="Choose a provider and save an API key first.")
    provider = build_provider(cfg.provider, cfg.api_key, cfg.model, cfg.base_url)
    if provider is None:
        return ModelsOut(models=[], message="Save an API key first.")
    try:
        ids = await provider.list_models()
    except ProviderError as e:
        log.warning("AI model list failed: %s", e)
        return ModelsOut(models=[], message=_friendly(e))
    except Exception:  # noqa: BLE001
        log.exception("AI model list crashed")
        return ModelsOut(models=[], message="Unexpected error while listing models.")
    rec = (pick_default_model(ids) if cfg.provider == "gemini" else "") or ""
    if not ids:
        return ModelsOut(models=[], message="The provider returned no models for this key.")
    return ModelsOut(models=ids[:200], recommended=rec)


@router.post("/test", response_model=AiTestOut)
async def test_ai_settings(
    session: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[T.AdminUser, Depends(get_current_admin)],
) -> AiTestOut:
    """Make one tiny request with the saved settings to confirm the key and model work."""
    limiter.check(f"ai-test:{admin.username}", 5, 60)
    row = await _row(session)
    cfg = resolve_ai_config(row, get_settings())
    if cfg.provider in ("", "off"):
        return AiTestOut(ok=False, message="The AI is switched off. Choose a provider and save first.")
    if not cfg.key_readable:
        return AiTestOut(ok=False, message="The saved key can no longer be read. Please enter it again.")
    provider = build_provider(cfg.provider, cfg.api_key, cfg.model, cfg.base_url)
    if provider is None:
        return AiTestOut(ok=False, message="No API key saved yet. Enter a key and save first.")
    try:
        res = await provider.generate(
            "You are a connection test. Answer with the single word OK.",
            [{"role": "user", "content": "ping"}],
            [],
        )
    except ProviderError as e:
        log.warning("AI settings test failed: %s", e)
        return AiTestOut(ok=False, message=_friendly(e))
    except Exception:  # noqa: BLE001
        log.exception("AI settings test crashed")
        return AiTestOut(ok=False, message="Unexpected error while testing. Check the server logs.")
    return AiTestOut(ok=True, message="Connected. The provider replied successfully.") if (res.text or res.tool_calls) else AiTestOut(
        ok=False, message="Connected, but the model returned an empty reply. Check the model name."
    )
