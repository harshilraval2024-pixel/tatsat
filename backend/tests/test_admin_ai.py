"""Admin AI settings: encryption, precedence, write-only key, validation, auth. Uses real SQLite."""

import asyncio
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base, get_db
from app.dependencies import get_current_admin
from app.main import app
from app.models import tables as T
from app.routes import admin_ai
from app.services.ai.config import (
    AiConfig,
    clean_api_key,
    clean_base_url,
    clean_model,
    key_hint,
    resolve_ai_config,
)
from app.services.ai.providers import GeminiProvider, OpenAICompatProvider, ProviderError, ProviderResult, pick_default_model
from app.utils import secretbox
from app.utils.ratelimit import limiter

SECRET_KEY = "AIzaSyTEST-super-secret-key-1234"


# ----------------------------------------------------------------------------- secretbox
def test_secretbox_roundtrip_and_tamper():
    token = secretbox.encrypt(SECRET_KEY)
    assert SECRET_KEY not in token and token != secretbox.encrypt(SECRET_KEY)  # random IV
    assert secretbox.decrypt(token) == SECRET_KEY
    assert secretbox.decrypt(token[:-4] + "AAAA") is None
    assert secretbox.decrypt("") is None and secretbox.decrypt("not-a-token") is None


def test_secretbox_unreadable_after_secret_rotation(monkeypatch):
    token = secretbox.encrypt(SECRET_KEY)
    monkeypatch.setattr(secretbox, "get_settings", lambda: SimpleNamespace(jwt_secret="a-completely-different-secret-value-123"))
    assert secretbox.decrypt(token) is None


# ----------------------------------------------------------------------------- validation helpers
def test_clean_helpers():
    assert clean_api_key('  "abcd1234efgh"  ') == "abcd1234efgh"
    for bad in ("short", "has space in it 12345", "line\nbreak12345", "x" * 401, ""):
        with pytest.raises(ValueError):
            clean_api_key(bad)
    assert clean_model(" gemini-2.5-flash ") == "gemini-2.5-flash" and clean_model("") == ""
    with pytest.raises(ValueError):
        clean_model("model; drop table")
    assert clean_base_url("https://api.groq.com/openai/v1/") == "https://api.groq.com/openai/v1"
    assert clean_base_url("") == ""
    for bad in (
        "http://api.example.com",
        "https://localhost/v1",
        "https://127.0.0.1/v1",
        "https://10.0.0.5/v1",
        "https://169.254.169.254/latest",
        "https://user:pw@example.com/v1",
        "https://service.internal/v1",
        "ftp://example.com",
    ):
        with pytest.raises(ValueError):
            clean_base_url(bad)
    assert key_hint(SECRET_KEY) == "…1234" and key_hint("short") == ""


def test_resolve_precedence_admin_over_env():
    env = SimpleNamespace(ai_provider="gemini", ai_api_key="ENVKEY1234", ai_model="env-model", ai_base_url="", ai_daily_limit=500)
    assert resolve_ai_config(None, env) == AiConfig("gemini", "ENVKEY1234", "env-model", "", 500, "env")
    none_env = SimpleNamespace(ai_provider="", ai_api_key="", ai_model="", ai_base_url="", ai_daily_limit=500)
    assert resolve_ai_config(None, none_env).source == "none"

    row = SimpleNamespace(
        ai_provider="openai", ai_key_enc=secretbox.encrypt("ADMINKEY5678"), ai_model="m", ai_base_url="https://x.example/v1", ai_daily_limit=50
    )
    cfg = resolve_ai_config(row, env)
    assert (cfg.provider, cfg.api_key, cfg.model, cfg.daily_limit, cfg.source) == ("openai", "ADMINKEY5678", "m", 50, "admin")

    # "off" in the admin disables the AI even though the environment has a key
    off = SimpleNamespace(ai_provider="off", ai_key_enc="", ai_model="", ai_base_url="", ai_daily_limit=None)
    assert resolve_ai_config(off, env).provider == "off"

    # empty admin provider falls back to the environment
    blank = SimpleNamespace(ai_provider="", ai_key_enc="", ai_model="", ai_base_url="", ai_daily_limit=None)
    assert resolve_ai_config(blank, env).source == "env"

    # undecryptable stored key is flagged, not crashed
    broken = SimpleNamespace(ai_provider="gemini", ai_key_enc="garbage", ai_model="", ai_base_url="", ai_daily_limit=None)
    c = resolve_ai_config(broken, env)
    assert c.api_key == "" and c.key_readable is False


# ----------------------------------------------------------------------------- endpoints (real DB)
@pytest.fixture()
def admin_client(tmp_path):
    limiter._hits.clear()
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 't.db'}")
    Session = async_sessionmaker(engine, expire_on_commit=False)

    async def setup():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with Session() as s:
            s.add(T.SiteSettings(id=1, name="Test Co"))
            await s.commit()

    asyncio.run(setup())

    async def db():
        async with Session() as s:
            yield s

    app.dependency_overrides[get_db] = db
    app.dependency_overrides[get_current_admin] = lambda: SimpleNamespace(username="admin", is_active=True)
    yield TestClient(app)
    app.dependency_overrides.clear()
    asyncio.run(engine.dispose())


def put(c, **kw):
    body = {
        "provider": "gemini", "model": "", "base_url": "", "api_key": SECRET_KEY, "clear_key": False,
        "daily_limit": None, "chat_enabled": False, "bill_reader_enabled": False,
    }
    body.update(kw)
    return c.put("/admin/ai-settings", json=body)


def test_defaults_when_unconfigured(admin_client):
    d = admin_client.get("/admin/ai-settings").json()
    assert d["provider"] == "" and d["key_set"] is False and d["working_provider"] == "off" and d["source"] in ("env", "none")


def test_save_never_returns_or_stores_plaintext_key(admin_client):
    r = put(admin_client, daily_limit=120)
    assert r.status_code == 200
    out = r.json()
    assert out["key_set"] is True and out["key_hint"] == "…1234" and out["working_provider"] == "gemini"
    assert out["source"] == "admin" and out["daily_limit"] == 120
    assert SECRET_KEY not in r.text and SECRET_KEY not in admin_client.get("/admin/ai-settings").text
    # it is not leaked through the public site settings either
    public = admin_client.get("/site-settings")
    assert public.status_code == 200 and SECRET_KEY not in public.text and "ai_key" not in public.text

    async def stored():
        eng = app.dependency_overrides[get_db]
        async for s in eng():
            row = await s.get(T.SiteSettings, 1)
            return row.ai_key_enc

    enc = asyncio.run(stored())
    assert enc and SECRET_KEY not in enc and secretbox.decrypt(enc) == SECRET_KEY


def test_blank_key_keeps_saved_key_and_clear_removes_it(admin_client):
    put(admin_client)
    kept = put(admin_client, api_key=None, model="gemini-2.5-pro").json()
    assert kept["key_set"] is True and kept["key_hint"] == "…1234" and kept["model"] == "gemini-2.5-pro"
    cleared = put(admin_client, api_key=None, clear_key=True).json()
    assert cleared["key_set"] is False and cleared["key_hint"] == ""


def test_off_switch_and_validation(admin_client):
    assert put(admin_client, provider="off").json()["working_provider"] == "off"
    assert put(admin_client, provider="skynet").status_code == 422
    assert put(admin_client, api_key="bad key").status_code == 422
    assert put(admin_client, model="x; y").status_code == 422
    assert put(admin_client, provider="openai", base_url="http://insecure.example").status_code == 422
    assert put(admin_client, provider="openai", base_url="https://127.0.0.1/v1").status_code == 422
    assert put(admin_client, daily_limit=0).status_code == 422
    ok = put(admin_client, provider="openai", base_url="https://api.groq.com/openai/v1/").json()
    assert ok["base_url"] == "https://api.groq.com/openai/v1"
    # base_url is ignored for non-openai providers
    assert put(admin_client, provider="gemini", base_url="https://api.groq.com/v1").json()["base_url"] == ""


def test_endpoints_require_admin_auth():
    app.dependency_overrides.clear()
    c = TestClient(app)
    assert c.get("/admin/ai-settings").status_code == 401
    assert c.put("/admin/ai-settings", json={"provider": "off"}).status_code == 401
    assert c.post("/admin/ai-settings/test").status_code == 401


def test_connection_test_messages(admin_client, monkeypatch):
    assert "switched off" in admin_client.post("/admin/ai-settings/test").json()["message"]
    put(admin_client)

    class Good:
        async def generate(self, *a):
            return ProviderResult(text="OK")

    monkeypatch.setattr(admin_ai, "build_provider", lambda *a: Good())
    good = admin_client.post("/admin/ai-settings/test").json()
    assert good["ok"] is True and good["message"] == "Connected. The provider replied successfully."

    for text, expect in [
        ("gemini HTTP 403", "rejected the API key"),
        ("gemini HTTP 400", "API key and the model name"),
        ("gemini HTTP 404", "Model or endpoint not found"),
        ("gemini HTTP 429", "quota"),
        ("gemini HTTP 503", "having problems"),
        ("gemini transport error: ConnectError", "Could not reach"),
    ]:
        class Bad:
            async def generate(self, *a, _t=text):
                raise ProviderError(_t)

        monkeypatch.setattr(admin_ai, "build_provider", lambda *a, b=Bad(): b)
        limiter._hits.clear()
        r = admin_client.post("/admin/ai-settings/test").json()
        assert r["ok"] is False and expect in r["message"], (text, r)
        assert SECRET_KEY not in str(r) and "HTTP" not in r["message"]


def test_connection_test_is_rate_limited(admin_client):
    codes = [admin_client.post("/admin/ai-settings/test").status_code for _ in range(7)]
    assert codes[:5] == [200] * 5 and codes[5:] == [429, 429]


# ----------------------------------------------------------------------------- model discovery
def test_pick_default_model_prefers_newest_plain_flash():
    ids = [
        "gemini-2.5-flash", "gemini-3.6-flash", "gemini-3.8-flash", "gemini-3.8-flash-lite-tts",
        "gemini-3.8-live", "gemini-3.5-flash-lite", "gemini-4-argon", "gemini-flash-latest",
    ]
    assert pick_default_model(ids) == "gemini-3.8-flash"
    assert pick_default_model(["gemini-10.1-flash", "gemini-9.9-flash"]) == "gemini-10.1-flash"  # numeric, not text, order
    assert pick_default_model(["gemini-4-argon", "gemini-3.8-live", "gemini-3.5-flash-lite"]) == "gemini-4-argon"
    assert pick_default_model([]) is None


class _Resp:
    def __init__(self, status, payload):
        self.status_code, self._p = status, payload

    def json(self):
        return self._p


def _fake_client(monkeypatch, handler):
    import app.services.ai.providers as prov

    class Client:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, url, params=None, headers=None):
            return handler("GET", url, None, headers)

        async def post(self, url, json=None, headers=None):
            return handler("POST", url, json, headers)

    monkeypatch.setattr(prov.httpx, "AsyncClient", Client)



def test_gemini_auto_falls_back_when_list_fails(monkeypatch):
    def handler(method, url, body, headers):
        if method == "GET":
            return _Resp(403, {})
        return _Resp(200, {"candidates": [{"content": {"parts": [{"text": "OK"}]}}]})

    _fake_client(monkeypatch, handler)
    GeminiProvider._auto_cache.clear()
    assert asyncio.run(GeminiProvider("KEY-FALLBACK-1", "")._model_name()) == GeminiProvider.FALLBACK_MODEL


def test_openai_compat_lists_models(monkeypatch):
    _fake_client(monkeypatch, lambda m, u, b, h: _Resp(200, {"data": [{"id": "b-model"}, {"id": "a-model"}, {"nope": 1}]}))
    assert asyncio.run(OpenAICompatProvider("K", "", "https://x.example/v1").list_models()) == ["a-model", "b-model"]


def test_models_endpoint(admin_client, monkeypatch):
    r = admin_client.get("/admin/ai-settings/models").json()
    assert r["models"] == [] and "save" in r["message"].lower()
    put(admin_client)

    class P:
        async def list_models(self):
            return ["gemini-3.6-flash", "gemini-3.8-flash"]

    monkeypatch.setattr(admin_ai, "build_provider", lambda *a: P())
    ok = admin_client.get("/admin/ai-settings/models").json()
    assert ok["models"] == ["gemini-3.6-flash", "gemini-3.8-flash"] and ok["recommended"] == "gemini-3.8-flash"

    class Bad:
        async def list_models(self):
            raise ProviderError("gemini HTTP 403")

    monkeypatch.setattr(admin_ai, "build_provider", lambda *a: Bad())
    bad = admin_client.get("/admin/ai-settings/models").json()
    assert bad["models"] == [] and "rejected the API key" in bad["message"] and SECRET_KEY not in str(bad)


def test_models_endpoint_requires_admin():
    app.dependency_overrides.clear()
    assert TestClient(app).get("/admin/ai-settings/models").status_code == 401


# ----------------------------------------------------------------------------- diagnostics + retry
def test_provider_error_carries_redacted_detail(monkeypatch):
    secret = "AIzaSyLEAKY-SECRET-9999"

    def handler(method, url, body, headers):
        return _Resp(400, {"error": {"code": 400, "message": f"API key not valid: {secret}. Please pass a valid API key."}})

    _fake_client(monkeypatch, handler)
    with pytest.raises(ProviderError) as ei:
        asyncio.run(GeminiProvider(secret, "m").generate("s", [{"role": "user", "content": "hi"}], []))
    msg = str(ei.value)
    assert "HTTP 400" in msg and "API key not valid" in msg and secret not in msg and "[key]" in msg


def test_transient_5xx_is_retried_then_succeeds(monkeypatch):
    import app.services.ai.providers as prov

    async def no_sleep(_):
        return None

    monkeypatch.setattr(prov.asyncio, "sleep", no_sleep)
    seq = [503, 503, 200]
    calls = []

    def handler(method, url, body, headers):
        calls.append(1)
        code = seq[len(calls) - 1]
        if code != 200:
            return _Resp(code, {"error": {"message": "The model is overloaded."}})
        return _Resp(200, {"candidates": [{"content": {"parts": [{"text": "hello"}]}}]})

    _fake_client(monkeypatch, handler)
    res = asyncio.run(GeminiProvider("K-RETRY-0001", "m").generate("s", [{"role": "user", "content": "hi"}], []))
    assert res.text == "hello" and len(calls) == 3


def test_persistent_5xx_gives_up_with_detail_and_4xx_is_not_retried(monkeypatch):
    import app.services.ai.providers as prov

    async def no_sleep(_):
        return None

    monkeypatch.setattr(prov.asyncio, "sleep", no_sleep)
    calls = []

    def always503(method, url, body, headers):
        calls.append(1)
        return _Resp(503, {"error": {"message": "The model is overloaded. Please try again later."}})

    _fake_client(monkeypatch, always503)
    with pytest.raises(ProviderError) as ei:
        asyncio.run(OpenAICompatProvider("K", "m", "https://x.example/v1").generate("s", [{"role": "user", "content": "hi"}], []))
    assert len(calls) == 3 and "overloaded" in str(ei.value)

    calls.clear()
    _fake_client(monkeypatch, lambda m, u, b, h: (calls.append(1), _Resp(401, {"error": {"message": "bad key"}}))[1])
    with pytest.raises(ProviderError):
        asyncio.run(OpenAICompatProvider("K", "m", "https://x.example/v1").generate("s", [{"role": "user", "content": "hi"}], []))
    assert len(calls) == 1  # auth errors are never retried


def test_admin_test_shows_provider_detail_and_model(admin_client, monkeypatch):
    put(admin_client)

    class Overloaded:
        async def _model_name(self):
            return "gemini-3.8-flash"

        async def generate(self, *a):
            raise ProviderError("gemini HTTP 503: The model is overloaded. Please try again later.")

    monkeypatch.setattr(admin_ai, "build_provider", lambda *a: Overloaded())
    r = admin_client.post("/admin/ai-settings/test").json()
    assert r["ok"] is False and "having problems" in r["message"]
    assert r["detail"] == "The model is overloaded. Please try again later." and r["model"] == "gemini-3.8-flash"


# ----------------------------------------------------------------------------- model fallback chain
LIST = {"models": [
    {"name": f"models/gemini-{v}-flash", "supportedGenerationMethods": ["generateContent"]}
    for v in ("2.5", "3.5", "3.6", "3.7", "3.8")
]}
OK = {"candidates": [{"content": {"parts": [{"text": "OK"}]}}]}


def test_pick_candidates_newest_first_and_limited():
    from app.services.ai.providers import pick_candidates

    ids = ["gemini-2.5-flash", "gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.5-flash", "gemini-3.8-live"]
    assert pick_candidates(ids) == ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash"]
    assert pick_candidates(ids, limit=2) == ["gemini-3.8-flash", "gemini-3.7-flash"]
    assert pick_candidates(["gemini-4-argon"]) == ["gemini-4-argon"] and pick_candidates([]) == []


def test_auto_mode_falls_back_past_overloaded_and_missing_models(monkeypatch):
    import httpx

    posted = []

    def handler(method, url, body, headers):
        if method == "GET":
            return _Resp(200, LIST)
        model = url.split("/models/")[1].split(":")[0]
        posted.append(model)
        if model == "gemini-3.8-flash":
            return _Resp(503, {"error": {"message": "high demand"}})
        if model == "gemini-3.7-flash":
            raise httpx.ReadTimeout("slow")
        if model == "gemini-3.6-flash":
            return _Resp(404, {"error": {"message": "no longer available"}})
        return _Resp(200, OK)

    _fake_client(monkeypatch, handler)
    GeminiProvider._auto_cache.clear()
    GeminiProvider._good_cache.clear()
    p = GeminiProvider("KEY-CHAIN-0001", "")
    res = asyncio.run(p.generate("s", [{"role": "user", "content": "hi"}], []))
    assert res.text == "OK" and p.last_model == "gemini-3.5-flash"
    # 503 (overloaded) -> timeout -> 404 (gone) -> finally a model that works
    assert posted == ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash"]




def test_explicit_model_is_never_swapped(monkeypatch):
    import app.services.ai.providers as prov

    async def no_sleep(_):
        return None

    monkeypatch.setattr(prov.asyncio, "sleep", no_sleep)
    posted = []

    def handler(method, url, body, headers):
        posted.append(url.split("/models/")[1].split(":")[0])
        return _Resp(503, {"error": {"message": "high demand"}})

    _fake_client(monkeypatch, handler)
    with pytest.raises(ProviderError) as ei:
        asyncio.run(GeminiProvider("KEY-EXPLICIT-1", "my-pinned-model").generate("s", [{"role": "user", "content": "hi"}], []))
    assert set(posted) == {"my-pinned-model"} and len(posted) == 3 and "high demand" in str(ei.value)


def test_auto_mode_raises_last_error_when_every_candidate_fails(monkeypatch):
    def handler(method, url, body, headers):
        if method == "GET":
            return _Resp(200, LIST)
        return _Resp(503, {"error": {"message": "everything is busy"}})

    _fake_client(monkeypatch, handler)
    GeminiProvider._auto_cache.clear()
    GeminiProvider._good_cache.clear()
    with pytest.raises(ProviderError) as ei:
        asyncio.run(GeminiProvider("KEY-ALLFAIL-01", "").generate("s", [{"role": "user", "content": "hi"}], []))
    assert "everything is busy" in str(ei.value)



def test_feature_switches_default_off_and_round_trip(admin_client):
    d = admin_client.get("/admin/ai-settings").json()
    assert d["chat_enabled"] is False and d["bill_reader_enabled"] is False  # nothing works until ticked
    both = put(admin_client, chat_enabled=True, bill_reader_enabled=True).json()
    assert both["chat_enabled"] is True and both["bill_reader_enabled"] is True
    only_chat = put(admin_client, api_key=None, chat_enabled=True, bill_reader_enabled=False).json()
    assert only_chat["chat_enabled"] is True and only_chat["bill_reader_enabled"] is False and only_chat["key_set"] is True
    # the public status endpoint reflects the switches (needs a configured provider)
    app.dependency_overrides[ai_routes_get_provider()] = lambda: object()
    st = admin_client.get("/ai/status").json()
    assert st["enabled"] is True and st["bill_reader"] is False
    off = put(admin_client, api_key=None).json()
    assert off["chat_enabled"] is False and off["bill_reader_enabled"] is False
    assert admin_client.get("/ai/status").json()["enabled"] is False


def ai_routes_get_provider():
    from app.routes import ai as ai_routes

    return ai_routes.get_provider


# ----------------------------------------------------------------------------- parallel model race
def _async_client(monkeypatch, handler):
    """Like _fake_client, but the handler is async so tests can simulate slow / hanging models."""
    import app.services.ai.providers as prov

    class Client:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, url, params=None, headers=None):
            return await handler("GET", url, None, headers)

        async def post(self, url, json=None, headers=None):
            return await handler("POST", url, json, headers)

    monkeypatch.setattr(prov.httpx, "AsyncClient", Client)


def _model_of(url):
    return url.split("/models/")[1].split(":")[0]


def _reset(monkeypatch):
    import app.services.ai.providers as prov

    async def no_sleep(_):
        return None

    monkeypatch.setattr(prov.asyncio, "sleep", no_sleep)  # only affects retry back-off
    GeminiProvider._auto_cache.clear()
    GeminiProvider._good_cache.clear()


def test_lists_only_generate_content_models_and_first_call_picks_newest(monkeypatch):
    posted = []

    async def handler(method, url, body, headers):
        if method == "GET":
            return _Resp(200, {"models": [
                {"name": "models/gemini-3.8-flash", "supportedGenerationMethods": ["generateContent", "countTokens"]},
                {"name": "models/gemini-3.6-flash", "supportedGenerationMethods": ["generateContent"]},
                {"name": "models/text-embedding-9", "supportedGenerationMethods": ["embedContent"]},
                {"name": "models/gemini-embed-1", "supportedGenerationMethods": ["embedContent"]},
            ]})
        posted.append(_model_of(url))
        return _Resp(200, OK)

    _async_client(monkeypatch, handler)
    _reset(monkeypatch)
    p = GeminiProvider("KEY-AUTO-0001", "")
    assert asyncio.run(p.list_models()) == ["gemini-3.6-flash", "gemini-3.8-flash"]
    asyncio.run(p.generate("s", [{"role": "user", "content": "hi"}], []))
    assert p.last_model == "gemini-3.8-flash"
    posted.clear()
    asyncio.run(p.generate("s", [{"role": "user", "content": "hi"}], []))
    assert posted == ["gemini-3.8-flash"]  # the winner is remembered: exactly one call from now on

    explicit = GeminiProvider("KEY", "my-model")
    posted.clear()
    asyncio.run(explicit.generate("s", [{"role": "user", "content": "hi"}], []))
    assert posted == ["my-model"]


def test_race_skips_overloaded_and_slow_models_and_is_fast(monkeypatch):
    import time as _t

    import httpx

    posted = []

    async def handler(method, url, body, headers):
        if method == "GET":
            return _Resp(200, LIST)
        model = _model_of(url)
        posted.append(model)
        if model == "gemini-3.8-flash":
            await asyncio.sleep(0.05)
            return _Resp(503, {"error": {"message": "high demand"}})
        if model == "gemini-3.7-flash":
            raise httpx.ReadTimeout("slow")
        if model == "gemini-3.6-flash":
            await asyncio.sleep(0.02)
            return _Resp(200, OK)
        await asyncio.sleep(1.5)  # 3.5 is slow: must be cancelled once 3.6 wins
        return _Resp(200, OK)

    _async_client(monkeypatch, handler)
    GeminiProvider._auto_cache.clear()
    GeminiProvider._good_cache.clear()
    p = GeminiProvider("KEY-RACE-00001", "")
    t0 = _t.monotonic()
    res = asyncio.run(p.generate("s", [{"role": "user", "content": "hi"}], []))
    assert res.text == "OK" and p.last_model == "gemini-3.6-flash"
    assert set(posted) == {"gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash"}
    assert _t.monotonic() - t0 < 1.0  # did not wait for the slow model


def test_race_is_time_bounded(monkeypatch):
    import time as _t

    async def handler(method, url, body, headers):
        if method == "GET":
            return _Resp(200, LIST)
        await asyncio.sleep(5)  # every model hangs
        return _Resp(200, OK)

    _async_client(monkeypatch, handler)
    GeminiProvider._auto_cache.clear()
    GeminiProvider._good_cache.clear()
    monkeypatch.setattr(GeminiProvider, "AUTO_BUDGET_S", 0.3)
    t0 = _t.monotonic()
    with pytest.raises(ProviderError):
        asyncio.run(GeminiProvider("KEY-BOUND-0001", "").generate("s", [{"role": "user", "content": "hi"}], []))
    assert _t.monotonic() - t0 < 2.0  # bounded by the budget, not by the hanging models


def test_failed_good_model_triggers_a_fresh_race(monkeypatch):
    posted = []

    async def handler(method, url, body, headers):
        if method == "GET":
            return _Resp(200, LIST)
        model = _model_of(url)
        posted.append(model)
        if model == "gemini-3.7-flash":
            return _Resp(503, {"error": {"message": "now overloaded"}})
        return _Resp(200, OK)

    _async_client(monkeypatch, handler)
    _reset(monkeypatch)
    ck = __import__("app.services.ai.providers", fromlist=["hashlib_sha"]).hashlib_sha("KEY-GOODFAIL-01")
    import time as _t

    GeminiProvider._good_cache[ck] = (_t.monotonic(), "gemini-3.7-flash")  # remembered, but it just broke
    p = GeminiProvider("KEY-GOODFAIL-01", "")
    GeminiProvider._auto_cache[ck] = (_t.monotonic(), ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash"])
    asyncio.run(p.generate("s", [{"role": "user", "content": "hi"}], []))
    assert posted[:2] == ["gemini-3.7-flash", "gemini-3.7-flash"]  # tried (plus one retry), then
    assert p.last_model in ("gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash")  # raced the rest


def test_auth_errors_surface_immediately(monkeypatch):
    async def handler(method, url, body, headers):
        if method == "GET":
            return _Resp(200, LIST)
        return _Resp(403, {"error": {"message": "key rejected"}})

    _async_client(monkeypatch, handler)
    GeminiProvider._auto_cache.clear()
    GeminiProvider._good_cache.clear()
    with pytest.raises(ProviderError) as ei:
        asyncio.run(GeminiProvider("KEY-AUTH-00001", "").generate("s", [{"role": "user", "content": "hi"}], []))
    assert ei.value.status == 403 and "key rejected" in str(ei.value)

