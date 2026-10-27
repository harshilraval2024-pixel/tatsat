"""Solar Advisor API: GET /ai/status and POST /ai/chat."""

import logging
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.services.ai.advisor import FALLBACK_REPLY, daily_budget, run_advisor
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


def get_provider() -> Provider | None:
    s = get_settings()
    return build_provider(s.ai_provider, s.ai_api_key, s.ai_model, s.ai_base_url)


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


@router.post("/chat", response_model=ChatResponse)
async def ai_chat(
    body: ChatRequest,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db)],
    provider: Annotated[Provider | None, Depends(get_provider)],
) -> ChatResponse:
    ip = client_ip(request)
    limiter.check(f"ai-min:{ip}", 12, 60)
    limiter.check(f"ai-hour:{ip}", 60, 3600)

    if provider is None:
        return ChatResponse(reply=FALLBACK_REPLY, fallback=True)
    row = await get_site_settings_row(session)
    if row is None or not site_settings_to_out(row).contact.advisor_enabled:
        return ChatResponse(reply=FALLBACK_REPLY, fallback=True)
    if not daily_budget.take(get_settings().ai_daily_limit):
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
