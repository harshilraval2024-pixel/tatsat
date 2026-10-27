"""LLM provider adapters for the Solar Advisor.

All providers speak one small internal format so the orchestrator never cares which
vendor is behind it:

    {"role": "user", "content": str}
    {"role": "assistant", "content": str | None, "tool_calls": [{"id", "name", "args"}]}
    {"role": "tool", "tool_call_id": str, "name": str, "content": str}   # JSON text

A provider turns a message list + tool declarations into a `ProviderResult` containing
either final text or tool calls to run.
"""

from __future__ import annotations

import base64
import json
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any, Protocol

import httpx

log = logging.getLogger(__name__)

HTTP_TIMEOUT = httpx.Timeout(25.0, connect=8.0)
MAX_OUTPUT_TOKENS = 450


class ProviderError(Exception):
    """Raised for any provider failure; the message is safe to log (never contains the key)."""


@dataclass
class ToolCall:
    id: str
    name: str
    args: dict[str, Any]


@dataclass
class ProviderResult:
    text: str | None = None
    tool_calls: list[ToolCall] = field(default_factory=list)


class Provider(Protocol):
    async def generate(
        self, system: str, messages: list[dict[str, Any]], tools: list[dict[str, Any]]
    ) -> ProviderResult: ...

    async def extract_json(self, system: str, prompt: str, image: bytes, mime: str) -> dict[str, Any]: ...

    async def list_models(self) -> list[str]: ...


def _loads(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    try:
        v = json.loads(raw or "{}")
        return v if isinstance(v, dict) else {}
    except (TypeError, ValueError):
        return {}


def parse_json_object(text: str | None) -> dict[str, Any]:
    """Pull the first JSON object out of a model reply (tolerates ```json fences and chatter)."""
    if not text:
        raise ProviderError("empty model reply")
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ProviderError("model reply had no JSON object")
    try:
        data = json.loads(text[start : end + 1])
    except ValueError as e:
        raise ProviderError("model reply was not valid JSON") from e
    if not isinstance(data, dict):
        raise ProviderError("model reply JSON was not an object")
    return data


def hashlib_sha(text: str) -> str:
    import hashlib

    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


_FLASH = re.compile(r"^gemini-(\d+(?:\.\d+)*)-flash$")
_SKIP = re.compile(r"(tts|live|image|embed|transcribe|lite|thinking|audio|robotics|exp|preview|latest)")


def pick_default_model(ids: list[str]) -> str | None:
    """Newest plain 'gemini-<version>-flash' model (best price/speed for chat and vision)."""
    best: tuple[tuple[int, ...], str] | None = None
    for mid in ids:
        m = _FLASH.match(mid)
        if not m:
            continue
        ver = tuple(int(x) for x in m.group(1).split("."))
        if best is None or ver > best[0]:
            best = (ver, mid)
    if best:
        return best[1]
    # Otherwise any general-purpose Gemini text model.
    generic = sorted(i for i in ids if i.startswith("gemini-") and not _SKIP.search(i))
    return generic[-1] if generic else None


# --------------------------------------------------------------------------- Gemini
class GeminiProvider:
    """Google Gemini via the REST API (free tier available). Key goes in a header, never the URL."""

    # Last-resort name if the live model list cannot be fetched; the list is the real source.
    FALLBACK_MODEL = "gemini-3.8-flash"
    _auto_cache: dict[str, tuple[float, str]] = {}

    def __init__(self, api_key: str, model: str) -> None:
        self.api_key = api_key
        self.model = (model or "").strip()

    async def list_models(self) -> list[str]:
        """Model ids this key can call with generateContent (e.g. 'gemini-3.8-flash')."""
        try:
            async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
                r = await client.get(
                    "https://generativelanguage.googleapis.com/v1beta/models",
                    params={"pageSize": 200},
                    headers={"x-goog-api-key": self.api_key},
                )
        except httpx.HTTPError as e:
            raise ProviderError(f"gemini transport error: {type(e).__name__}") from e
        if r.status_code != 200:
            raise ProviderError(f"gemini HTTP {r.status_code}")
        try:
            items = r.json().get("models", [])
        except ValueError as e:
            raise ProviderError("gemini returned an unexpected response") from e
        ids = [
            m["name"].removeprefix("models/")
            for m in items
            if isinstance(m, dict)
            and "generateContent" in (m.get("supportedGenerationMethods") or [])
            and str(m.get("name", "")).startswith("models/gemini")
        ]
        return sorted(set(ids))

    async def _model_name(self) -> str:
        """The configured model, or (when left blank) the newest Flash model the key can use."""
        if self.model:
            return self.model
        cache_key = hashlib_sha(self.api_key)
        hit = self._auto_cache.get(cache_key)
        if hit and time.monotonic() - hit[0] < 3600:
            return hit[1]
        try:
            name = pick_default_model(await self.list_models()) or self.FALLBACK_MODEL
        except ProviderError:
            name = self.FALLBACK_MODEL
        self._auto_cache[cache_key] = (time.monotonic(), name)
        return name

    @staticmethod
    def _to_contents(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        i = 0
        while i < len(messages):
            m = messages[i]
            role = m["role"]
            if role == "user":
                out.append({"role": "user", "parts": [{"text": m["content"]}]})
            elif role == "assistant":
                parts: list[dict[str, Any]] = []
                if m.get("content"):
                    parts.append({"text": m["content"]})
                for tc in m.get("tool_calls") or []:
                    parts.append({"functionCall": {"name": tc["name"], "args": tc["args"]}})
                out.append({"role": "model", "parts": parts or [{"text": ""}]})
            elif role == "tool":
                # Gemini wants all responses to one model turn grouped in a single user turn.
                parts = []
                while i < len(messages) and messages[i]["role"] == "tool":
                    t = messages[i]
                    parts.append(
                        {"functionResponse": {"name": t["name"], "response": {"result": _loads(t["content"])}}}
                    )
                    i += 1
                out.append({"role": "user", "parts": parts})
                continue
            i += 1
        return out

    async def generate(self, system, messages, tools):  # type: ignore[no-untyped-def]
        body: dict[str, Any] = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": self._to_contents(messages),
            "generationConfig": {"maxOutputTokens": MAX_OUTPUT_TOKENS, "temperature": 0.3},
        }
        if tools:
            body["tools"] = [{"functionDeclarations": tools}]
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{await self._model_name()}:generateContent"
        try:
            async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
                r = await client.post(url, json=body, headers={"x-goog-api-key": self.api_key})
        except httpx.HTTPError as e:
            raise ProviderError(f"gemini transport error: {type(e).__name__}") from e
        if r.status_code != 200:
            raise ProviderError(f"gemini HTTP {r.status_code}")
        try:
            parts = r.json()["candidates"][0]["content"]["parts"]
        except (KeyError, IndexError, ValueError) as e:
            raise ProviderError("gemini returned an unexpected response") from e
        text = "".join(p.get("text", "") for p in parts if "text" in p).strip()
        calls = [
            ToolCall(id=f"call_{n}", name=p["functionCall"]["name"], args=_loads(p["functionCall"].get("args")))
            for n, p in enumerate(parts)
            if "functionCall" in p
        ]
        return ProviderResult(text=text or None, tool_calls=calls)


    async def extract_json(self, system, prompt, image, mime):  # type: ignore[no-untyped-def]
        body = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"text": prompt},
                        {"inline_data": {"mime_type": mime, "data": base64.b64encode(image).decode()}},
                    ],
                }
            ],
            "generationConfig": {
                "maxOutputTokens": 400,
                "temperature": 0,
                "responseMimeType": "application/json",
            },
        }
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{await self._model_name()}:generateContent"
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(40.0, connect=8.0)) as client:
                r = await client.post(url, json=body, headers={"x-goog-api-key": self.api_key})
        except httpx.HTTPError as e:
            raise ProviderError(f"gemini transport error: {type(e).__name__}") from e
        if r.status_code != 200:
            raise ProviderError(f"gemini HTTP {r.status_code}")
        try:
            parts = r.json()["candidates"][0]["content"]["parts"]
        except (KeyError, IndexError, ValueError) as e:
            raise ProviderError("gemini returned an unexpected response") from e
        return parse_json_object("".join(p.get("text", "") for p in parts))


# --------------------------------------------------------------------------- OpenAI-compatible
class OpenAICompatProvider:
    """Any OpenAI-style /chat/completions API: OpenAI, Groq, OpenRouter, Together, ..."""

    def __init__(self, api_key: str, model: str, base_url: str) -> None:
        self.api_key = api_key
        self.model = model or "gpt-4o-mini"
        self.base_url = (base_url or "https://api.openai.com/v1").rstrip("/")

    @staticmethod
    def _to_messages(system: str, messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = [{"role": "system", "content": system}]
        for m in messages:
            if m["role"] == "assistant" and m.get("tool_calls"):
                out.append(
                    {
                        "role": "assistant",
                        "content": m.get("content"),
                        "tool_calls": [
                            {
                                "id": tc["id"],
                                "type": "function",
                                "function": {"name": tc["name"], "arguments": json.dumps(tc["args"])},
                            }
                            for tc in m["tool_calls"]
                        ],
                    }
                )
            elif m["role"] == "tool":
                out.append({"role": "tool", "tool_call_id": m["tool_call_id"], "content": m["content"]})
            else:
                out.append({"role": m["role"], "content": m.get("content") or ""})
        return out

    async def generate(self, system, messages, tools):  # type: ignore[no-untyped-def]
        body: dict[str, Any] = {
            "model": self.model,
            "messages": self._to_messages(system, messages),
            "max_tokens": MAX_OUTPUT_TOKENS,
            "temperature": 0.3,
        }
        if tools:
            body["tools"] = [{"type": "function", "function": t} for t in tools]
        try:
            async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
                r = await client.post(
                    f"{self.base_url}/chat/completions",
                    json=body,
                    headers={"Authorization": f"Bearer {self.api_key}"},
                )
        except httpx.HTTPError as e:
            raise ProviderError(f"openai-compat transport error: {type(e).__name__}") from e
        if r.status_code != 200:
            raise ProviderError(f"openai-compat HTTP {r.status_code}")
        try:
            msg = r.json()["choices"][0]["message"]
        except (KeyError, IndexError, ValueError) as e:
            raise ProviderError("openai-compat returned an unexpected response") from e
        calls = [
            ToolCall(id=tc["id"], name=tc["function"]["name"], args=_loads(tc["function"].get("arguments")))
            for tc in (msg.get("tool_calls") or [])
        ]
        return ProviderResult(text=(msg.get("content") or "").strip() or None, tool_calls=calls)


    async def extract_json(self, system, prompt, image, mime):  # type: ignore[no-untyped-def]
        data_url = f"data:{mime};base64,{base64.b64encode(image).decode()}"
        body = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
                },
            ],
            "max_tokens": 400,
            "temperature": 0,
        }
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(40.0, connect=8.0)) as client:
                r = await client.post(
                    f"{self.base_url}/chat/completions",
                    json=body,
                    headers={"Authorization": f"Bearer {self.api_key}"},
                )
        except httpx.HTTPError as e:
            raise ProviderError(f"openai-compat transport error: {type(e).__name__}") from e
        if r.status_code != 200:
            raise ProviderError(f"openai-compat HTTP {r.status_code}")
        try:
            content = r.json()["choices"][0]["message"].get("content")
        except (KeyError, IndexError, ValueError) as e:
            raise ProviderError("openai-compat returned an unexpected response") from e
        return parse_json_object(content)


    async def list_models(self) -> list[str]:
        try:
            async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
                r = await client.get(f"{self.base_url}/models", headers={"Authorization": f"Bearer {self.api_key}"})
        except httpx.HTTPError as e:
            raise ProviderError(f"openai-compat transport error: {type(e).__name__}") from e
        if r.status_code != 200:
            raise ProviderError(f"openai-compat HTTP {r.status_code}")
        try:
            data = r.json().get("data", [])
        except ValueError as e:
            raise ProviderError("openai-compat returned an unexpected response") from e
        return sorted({m["id"] for m in data if isinstance(m, dict) and isinstance(m.get("id"), str)})


# --------------------------------------------------------------------------- Fake (offline)
class FakeProvider:
    """Deterministic stand-in: no network, no key. Used for tests and local demos.

    It behaves like a tiny tool-calling model: it picks a tool from keywords in the last
    user message, then phrases the tool result as the answer.
    """

    _BILL = re.compile(r"(?:₹|rs\.?|inr)?\s*(\d[\d,]{2,6})", re.I)

    async def generate(self, system, messages, tools):  # type: ignore[no-untyped-def]
        last = messages[-1]
        if last["role"] == "tool":
            data = _loads(last["content"])
            if "error" in data:
                return ProviderResult(text=f"I couldn't work that out: {data['error']}")
            if last["name"] == "estimate_system":
                return ProviderResult(
                    text=(
                        f"For about {data['monthly_units']:.0f} units a month you'd need roughly "
                        f"{data['system_size']}. Estimated cost is ₹{data['total_before_subsidy']:,}, "
                        f"with a subsidy of ₹{data['subsidy']:,}, so about ₹{data['final_cost']:,} after subsidy. "
                        "This is indicative — a site visit gives the final quote."
                    )
                )
            if last["name"] == "get_subsidy":
                if not data.get("available"):
                    return ProviderResult(text="I don't have an active subsidy listed for that state.")
                unit = "%" if data["type"] == "percentage" else " rupees"
                return ProviderResult(text=f"The current subsidy is {data['value']:g}{unit} (max ₹{data.get('max', 0):,.0f}).")
            if last["name"] == "list_services":
                names = ", ".join(s["title"] for s in data.get("services", []))
                return ProviderResult(text=f"We offer: {names}.")
            return ProviderResult(text="Done.")

        text = (last.get("content") or "").lower()
        m = self._BILL.search(text)
        if m and ("bill" in text or "pay" in text or "₹" in text or "rs" in text):
            bill = float(m.group(1).replace(",", ""))
            return ProviderResult(
                tool_calls=[ToolCall("call_0", "estimate_system", {"state": "Gujarat", "monthly_bill": bill})]
            )
        if "subsid" in text:
            return ProviderResult(tool_calls=[ToolCall("call_0", "get_subsidy", {"state": "Gujarat"})])
        if "service" in text or "offer" in text:
            return ProviderResult(tool_calls=[ToolCall("call_0", "list_services", {})])
        return ProviderResult(
            text="I'm the demo advisor. Tell me your monthly electricity bill and I'll estimate a system and subsidy."
        )


    async def list_models(self) -> list[str]:
        return ["fake-model"]

    async def extract_json(self, system, prompt, image, mime):  # type: ignore[no-untyped-def]
        # Offline demo/test stand-in: returns a fixed sample, it does not read the image.
        return {
            "units_kwh": 428,
            "bill_amount_inr": 3150,
            "state": "Gujarat",
            "billing_months": 1,
            "utility": "Demo Utility",
            "confidence": 0.9,
        }


def build_provider(name: str, api_key: str, model: str, base_url: str) -> Provider | None:
    """Return a provider instance, or None when the advisor is not configured."""
    n = (name or "").strip().lower()
    if n in ("", "off"):
        return None
    if n == "fake":
        return FakeProvider()
    if not api_key:
        return None
    if n == "gemini":
        return GeminiProvider(api_key, model)
    if n in ("openai", "openai_compat", "groq"):
        return OpenAICompatProvider(api_key, model, base_url)
    log.warning("Unknown AI_PROVIDER %r; advisor disabled.", name)
    return None
