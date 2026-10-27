"""Solar Advisor API: GET /ai/status and POST /ai/chat."""

import logging
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.services.ai.advisor import FALLBACK_REPLY, daily_budget, run_advisor
from app.services.ai.config import AiConfig, resolve_ai_config
from app.services.ai.bill import MAX_IMAGE_BYTES, BillFields, read_bill, sniff_image
from app.services.ai.providers import Provider, ProviderError, build_provider
from app.services.site_settings import get_site_settings_row, site_settings_to_out
from app.utils.ratelimit import client_ip, limiter

router = APIRouter(prefix="/ai", tags=["ai"])
log = logging.getLogger(__name__)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=1000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(..., min_length=1, max_length=12)

    @model_validator(mode="after")
    def _ends_with_user(self) -> "ChatRequest":
        if self.messages[-1].role != "user":
            raise ValueError("the last message must come from the user")
        return self


class ChatResponse(BaseModel):
    reply: str
    estimate: dict[str, Any] | None = None
    fallback: bool = False


class StatusResponse(BaseModel):
    enabled: bool
    greeting: str = ""


async def get_ai_config(session: Annotated[AsyncSession, Depends(get_db)]) -> AiConfig:
    """Settings saved in the admin panel win over environment variables."""
    row = await get_site_settings_row(session)
    return resolve_ai_config(row, get_settings())


async def get_provider(cfg: Annotated[AiConfig, Depends(get_ai_config)]) -> Provider | None:
    return build_provider(cfg.provider, cfg.api_key, cfg.model, cfg.base_url)


async def get_daily_limit(cfg: Annotated[AiConfig, Depends(get_ai_config)]) -> int:
    return cfg.daily_limit


@router.get("/status", response_model=StatusResponse)
async def ai_status(
    session: Annotated[AsyncSession, Depends(get_db)],
    provider: Annotated[Provider | None, Depends(get_provider)],
) -> StatusResponse:
    """Tells the website whether to show the advisor (configured AND switched on in the admin)."""
    if provider is None:
        return StatusResponse(enabled=False)
    row = await get_site_settings_row(session)
    if row is None:
        return StatusResponse(enabled=False)
    contact = site_settings_to_out(row).contact
    return StatusResponse(enabled=contact.advisor_enabled, greeting=contact.advisor_greeting)


class BillResponse(BaseModel):
    fields: BillFields | None = None
    fallback: bool = False
    message: str = ""


@router.post("/read-bill", response_model=BillResponse)
async def ai_read_bill(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db)],
    provider: Annotated[Provider | None, Depends(get_provider)],
    daily_limit: Annotated[int, Depends(get_daily_limit)],
    file: UploadFile = File(...),
) -> BillResponse:
    """Read units / amount / state from a photo of an electricity bill (nothing is stored)."""
    ip = client_ip(request)
    limiter.check(f"bill-min:{ip}", 5, 60)
    limiter.check(f"bill-hour:{ip}", 20, 3600)

    data = await file.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Image too large (max 5 MB).")
    mime = sniff_image(data)
    if mime is None:
        raise HTTPException(status_code=400, detail="Please upload a JPG, PNG or WebP photo of your bill.")

    unavailable = BillResponse(fallback=True, message="Bill reading isn't available right now. Please type your bill amount.")
    if provider is None:
        return unavailable
    row = await get_site_settings_row(session)
    if row is None or not site_settings_to_out(row).contact.advisor_enabled:
        return unavailable
    if not daily_budget.take(daily_limit):
        log.warning("advisor daily limit reached (bill reader)")
        return unavailable

    try:
        fields = await read_bill(provider, session, data, mime)
    except ProviderError as e:
        log.warning("bill reader provider error: %s", e)
        return unavailable
    except Exception:  # noqa: BLE001 - never leak internals to the visitor
        log.exception("bill reader failed")
        return unavailable
    if fields is None:
        return BillResponse(message="We couldn't read your bill clearly. Try a sharper, well-lit photo, or type the amount.")
    return BillResponse(fields=fields)


@router.post("/chat", response_model=ChatResponse)
async def ai_chat(
    body: ChatRequest,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db)],
    provider: Annotated[Provider | None, Depends(get_provider)],
    daily_limit: Annotated[int, Depends(get_daily_limit)],
) -> ChatResponse:
    ip = client_ip(request)
    limiter.check(f"ai-min:{ip}", 12, 60)
    limiter.check(f"ai-hour:{ip}", 60, 3600)

    if provider is None:
        return ChatResponse(reply=FALLBACK_REPLY, fallback=True)
    row = await get_site_settings_row(session)
    if row is None or not site_settings_to_out(row).contact.advisor_enabled:
        return ChatResponse(reply=FALLBACK_REPLY, fallback=True)
    if not daily_budget.take(daily_limit):
        log.warning("advisor daily limit reached")
        return ChatResponse(reply=FALLBACK_REPLY, fallback=True)

    history = [{"role": m.role, "content": m.content} for m in body.messages]
    try:
        out = await run_advisor(provider, session, row.name, history)
    except ProviderError as e:
        log.warning("advisor provider error: %s", e)
        return ChatResponse(reply=FALLBACK_REPLY, fallback=True)
    except Exception:  # noqa: BLE001 - never leak internals to the visitor
        log.exception("advisor failed")
        return ChatResponse(reply=FALLBACK_REPLY, fallback=True)
    return ChatResponse(reply=out.text, estimate=out.estimate)
