"""Shared fixtures: an API client with a fake provider, stub DB and fresh rate limits."""

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.database import get_db
from app.main import app
from app.routes import ai as ai_routes
from app.services.ai import advisor as advisor_mod
from app.services.ai.config import AiConfig
from app.services.ai.providers import FakeProvider
from app.utils.ratelimit import limiter


@pytest.fixture()
def client(monkeypatch):
    limiter._hits.clear()
    advisor_mod.daily_budget._count = 0

    async def no_db():
        yield None

    state = {"chat": True, "bill": True}

    class Row:  # live view of the two admin switches
        name = "Tatsat NRGS"

        @property
        def ai_chat_enabled(self):
            return state["chat"]

        @property
        def ai_bill_enabled(self):
            return state["bill"]

    row = Row()

    async def fake_row(session):
        return row

    monkeypatch.setattr(ai_routes, "get_site_settings_row", fake_row)
    monkeypatch.setattr(
        ai_routes,
        "site_settings_to_out",
        lambda r: SimpleNamespace(contact=SimpleNamespace(advisor_greeting="Hello!")),
    )
    app.dependency_overrides[get_db] = no_db
    app.dependency_overrides[ai_routes.get_provider] = lambda: FakeProvider()
    app.dependency_overrides[ai_routes.get_ai_config] = lambda: AiConfig("fake", "", "", "", 500, "env")
    app.dependency_overrides[ai_routes.get_daily_limit] = lambda: 500
    c = TestClient(app)
    c.state = state  # type: ignore[attr-defined]
    yield c
    app.dependency_overrides.clear()
