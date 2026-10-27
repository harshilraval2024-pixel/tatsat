"""Effective AI configuration: values saved in the admin panel win over environment variables."""

from __future__ import annotations

import ipaddress
import re
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

from app.utils.secretbox import decrypt

PROVIDERS = ("gemini", "openai")  # selectable in the admin; "off" disables, "" means "use env"

# Default model shown/used per provider when the admin leaves the field blank.
DEFAULT_MODELS = {"gemini": "gemini-2.5-flash", "openai": "gpt-4o-mini"}


@dataclass(frozen=True)
class AiConfig:
    provider: str          # "gemini" | "openai" | "fake" | "off" | ""
    api_key: str
    model: str
    base_url: str
    daily_limit: int
    source: str            # "admin" | "env" | "none"
    key_readable: bool = True  # False when a stored key exists but cannot be decrypted


def resolve_ai_config(row: Any | None, settings: Any) -> AiConfig:
    admin_provider = (getattr(row, "ai_provider", "") or "").strip().lower() if row is not None else ""
    daily = int(getattr(row, "ai_daily_limit", None) or settings.ai_daily_limit) if row is not None else int(settings.ai_daily_limit)

    if admin_provider:
        enc = getattr(row, "ai_key_enc", "") or ""
        key = decrypt(enc) or ""
        return AiConfig(
            provider=admin_provider,
            api_key=key,
            model=(getattr(row, "ai_model", "") or "").strip(),
            base_url=(getattr(row, "ai_base_url", "") or "").strip(),
            daily_limit=daily,
            source="admin",
            key_readable=not (enc and not key),
        )
    env_provider = (settings.ai_provider or "").strip().lower()
    return AiConfig(
        provider=env_provider,
        api_key=settings.ai_api_key,
        model=settings.ai_model,
        base_url=settings.ai_base_url,
        daily_limit=daily,
        source="env" if env_provider else "none",
    )


_MODEL_RE = re.compile(r"^[A-Za-z0-9._:/\-]{0,100}$")
_KEY_RE = re.compile(r"^[A-Za-z0-9._~+/=:\-]{8,400}$")


def clean_model(model: str) -> str:
    m = (model or "").strip()
    if not _MODEL_RE.fullmatch(m):
        raise ValueError("Model name may only contain letters, numbers and . _ : / -")
    return m


def clean_api_key(key: str) -> str:
    k = (key or "").strip().strip('"').strip("'")
    if not _KEY_RE.fullmatch(k):
        raise ValueError("That does not look like an API key (no spaces or line breaks, 8-400 characters).")
    return k


def clean_base_url(url: str) -> str:
    """Admin-supplied endpoint the server will call: https only, no local/private targets."""
    u = (url or "").strip().rstrip("/")
    if not u:
        return ""
    p = urlparse(u)
    host = (p.hostname or "").lower()
    if p.scheme != "https" or not host:
        raise ValueError("Base URL must start with https://")
    if p.username or p.password:
        raise ValueError("Base URL must not contain credentials.")
    if host == "localhost" or host.endswith((".local", ".internal", ".localhost")):
        raise ValueError("Base URL must be a public address.")
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return u  # a normal hostname
    if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
        raise ValueError("Base URL must be a public address.")
    return u


def key_hint(key: str) -> str:
    return f"…{key[-4:]}" if len(key) >= 8 else ""
