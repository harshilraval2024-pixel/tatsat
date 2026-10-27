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
from app.services.ai.providers import ProviderError, ProviderResult
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
    body = {"provider": "gemini", "model": "", "base_url": "", "api_key": SECRET_KEY, "clear_key": False, "daily_limit": None}
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
    assert admin_client.post("/admin/ai-settings/test").json() == {"ok": True, "message": "Connected. The provider replied successfully."}

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
