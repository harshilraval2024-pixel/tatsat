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

import asyncio
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


def _redact(text: str, secret: str) -> str:
    return text.replace(secret, "[key]") if secret else text


def api_error(provider: str, r: Any, secret: str) -> ProviderError:
    """Build a ProviderError carrying the provider's own (redacted, short) message."""
    detail = ""
    try:
        err = r.json().get("error")
        detail = str(err.get("message") if isinstance(err, dict) else err or "")
    except Exception:  # noqa: BLE001 - body may not be JSON
        detail = ""
    detail = _redact(" ".join(detail.split())[:240], secret)
    return ProviderError(f"{provider} HTTP {r.status_code}" + (f": {detail}" if detail else ""))


RETRY_STATUSES = (500, 502, 503, 504)  # transient provider-side failures


async def post_with_retry(client: Any, url: str, body: dict[str, Any], headers: dict[str, str], retries: int = 2) -> Any:
    """POST, retrying brief provider outages/overloads (503 'model is overloaded' is common on free tiers)."""
    for attempt in range(retries + 1):
        r = await client.post(url, json=body, headers=headers)
        if r.status_code in RETRY_STATUSES and attempt < retries:
            await asyncio.sleep(1.2 * (attempt + 1))
            continue
        return r
    return r  # pragma: no cover


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


def pick_candidates(ids: list[str], limit: int = 4) -> list[str]:
    """Plain 'gemini-<version>-flash' models, newest first (used as an automatic fallback chain)."""
    scored: list[tuple[tuple[int, ...], str]] = []
    for mid in ids:
        m = _FLASH.match(mid)
        if m:
            scored.append((tuple(int(x) for x in m.group(1).split(".")), mid))
    scored.sort(reverse=True)
    out = [mid for _, mid in scored][:limit]
    if not out:
        d = pick_default_model(ids)
        out = [d] if d else []
    return out


# --------------------------------------------------------------------------- Gemini
class GeminiProvider:
    """Google Gemini via the REST API (free tier available). Key goes in a header, never the URL.

    Model names change often and the newest one is frequently overloaded, so when no model is
    configured the provider builds a fallback chain of the newest plain Flash models the key can
    use, remembers the one that last worked, and moves on to an older one on 404 / 5xx / timeouts.
    An explicitly configured model is respected (it is only retried, never swapped).
    """

    FALLBACK_MODEL = "gemini-3.5-flash"  # last resort if the live model list cannot be fetched
    _auto_cache: dict[str, tuple[float, list[str]]] = {}   # key -> (time, candidate chain)
    _good_cache: dict[str, tuple[float, str]] = {}          # key -> (time, model that last worked)
    AUTO_READ_TIMEOUT = 20.0
    AUTO_BUDGET_S = 40.0  # total time allowed for walking the fallback chain

    def __init__(self, api_key: str, model: str) -> None:
        self.api_key = api_key
        self.model = (model or "").strip()
        self.last_model: str = self.model  # model that served the most recent call

    async def list_models(self) -> list[str]:
        """Model ids this key can call with generateContent (e.g. 'gemini-3.6-flash')."""
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
            raise api_error("gemini", r, self.api_key)
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

    async def _chain(self) -> list[str]:
        """Models to try, best first. Explicit model -> just that one."""
        if self.model:
            return [self.model]
        ck = hashlib_sha(self.api_key)
        now = time.monotonic()
        hit = self._auto_cache.get(ck)
        if hit and now - hit[0] < 3600:
            chain = hit[1]
        else:
            try:
                chain = pick_candidates(await self.list_models()) or [self.FALLBACK_MODEL]
            except ProviderError:
                chain = [self.FALLBACK_MODEL]
            self._auto_cache[ck] = (now, chain)
        good = self._good_cache.get(ck)
        if good and now - good[0] < 3600 and good[1] in chain:
            chain = [good[1]] + [m for m in chain if m != good[1]]
        return chain

    async def _model_name(self) -> str:
        """The model that would be tried first (what the admin 'Test' shows before any call)."""
        return (await self._chain())[0]

    async def _request(self, body: dict[str, Any], read_timeout: float = 25.0) -> dict[str, Any]:
        """POST generateContent with model fallback; returns the parsed JSON of the first success."""
        auto = not self.model
        chain = await self._chain()
        ck = hashlib_sha(self.api_key)
        last: ProviderError | None = None
        deadline = time.monotonic() + self.AUTO_BUDGET_S
        for n, model in enumerate(chain):
            if n and auto and time.monotonic() > deadline:
                break  # keep the visitor's wait bounded even if several models are struggling
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            timeout = httpx.Timeout(min(read_timeout, self.AUTO_READ_TIMEOUT) if auto else read_timeout, connect=8.0)
            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    r = await post_with_retry(
                        client, url, body, {"x-goog-api-key": self.api_key}, retries=0 if auto else 2
                    )
            except httpx.HTTPError as e:
                last = ProviderError(f"gemini transport error: {type(e).__name__}")
                if auto:
                    log.warning("gemini model %s unreachable (%s); trying next", model, type(e).__name__)
                    continue
                raise last from e
            if r.status_code == 200:
                try:
                    data = r.json()
                except ValueError as e:
                    raise ProviderError("gemini returned an unexpected response") from e
                self.last_model = model
                self._good_cache[ck] = (time.monotonic(), model)
                return data
            last = api_error("gemini", r, self.api_key)
            if auto and (r.status_code in RETRY_STATUSES or r.status_code == 404):
                log.warning("gemini model %s failed (HTTP %s); trying next", model, r.status_code)
                self._good_cache.pop(ck, None)
                continue
            raise last
        self.last_model = chain[0]
        raise last or ProviderError("gemini request failed")

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
        data = await self._request(body)
        try:
            parts = data["candidates"][0]["content"]["parts"]
        except (KeyError, IndexError, TypeError) as e:
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
        data = await self._request(body, read_timeout=40.0)
        try:
            parts = data["candidates"][0]["content"]["parts"]
        except (KeyError, IndexError, TypeError) as e:
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
                r = await post_with_retry(
                    client, f"{self.base_url}/chat/completions", body, {"Authorization": f"Bearer {self.api_key}"}
                )
        except httpx.HTTPError as e:
            raise ProviderError(f"openai-compat transport error: {type(e).__name__}") from e
        if r.status_code != 200:
            raise api_error("openai-compat", r, self.api_key)
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
                r = await post_with_retry(
                    client, f"{self.base_url}/chat/completions", body, {"Authorization": f"Bearer {self.api_key}"}
                )
        except httpx.HTTPError as e:
            raise ProviderError(f"openai-compat transport error: {type(e).__name__}") from e
        if r.status_code != 200:
            raise api_error("openai-compat", r, self.api_key)
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
            raise api_error("openai-compat", r, self.api_key)
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
