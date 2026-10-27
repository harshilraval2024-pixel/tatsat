"""Tools the Solar Advisor may call. They read the same data the website uses, so the model
never has to guess prices, sizes or subsidies."""

from __future__ import annotations

import json
import logging
from typing import Any

from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.estimate import EstimateRequest
from app.services.cms_content import list_services
from app.services.estimate_service import _get_state_by_name, _get_subsidy, compute_estimate

log = logging.getLogger(__name__)

# Provider-neutral declarations (JSON-schema subset understood by Gemini and OpenAI).
TOOL_DECLARATIONS: list[dict[str, Any]] = [
    {
        "name": "estimate_system",
        "description": (
            "Estimate rooftop solar system size and cost for a customer, including state subsidy. "
            "Provide monthly_bill (INR) OR monthly_units (kWh). Always use this for any number about "
            "system size, cost or savings."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "state": {"type": "string", "description": "Indian state name, e.g. Gujarat"},
                "district": {"type": "string", "description": "Optional district/city, e.g. Vadodara"},
                "monthly_bill": {"type": "number", "description": "Monthly electricity bill in INR"},
                "monthly_units": {"type": "number", "description": "Monthly consumption in kWh"},
                "roof_type": {"type": "string", "enum": ["RCC", "METAL", "GROUND"]},
            },
            "required": ["state"],
        },
    },
    {
        "name": "get_subsidy",
        "description": "Get the current solar subsidy rule for an Indian state.",
        "parameters": {
            "type": "object",
            "properties": {"state": {"type": "string", "description": "Indian state name"}},
            "required": ["state"],
        },
    },
    {
        "name": "list_services",
        "description": "List the solar services this company offers.",
        "parameters": {"type": "object", "properties": {}},
    },
]


def _num(v: Any) -> float | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if f == f and abs(f) < 1e9 else None  # reject NaN / absurd values


def _str(v: Any, limit: int = 80) -> str | None:
    return v.strip()[:limit] if isinstance(v, str) and v.strip() else None


async def _estimate_system(session: AsyncSession, args: dict[str, Any]) -> dict[str, Any]:
    state = _str(args.get("state"))
    if not state:
        return {"error": "state is required"}
    try:
        req = EstimateRequest(
            state=state,
            district=_str(args.get("district"), 100),
            monthly_bill=_num(args.get("monthly_bill")),
            monthly_units=_num(args.get("monthly_units")),
            roof_type=_str(args.get("roof_type"), 10) or "RCC",
            save_lead=False,  # the advisor never stores anything
        )
    except ValidationError as e:
        msgs = "; ".join(err["msg"] for err in e.errors())
        return {"error": f"invalid input: {msgs}"[:200]}
    try:
        res = await compute_estimate(session, req)
    except ValueError as e:
        return {"error": str(e)[:160]}
    except RuntimeError:
        return {"error": "pricing is not configured right now"}
    return {
        "system_size": res.system_size,
        "system_size_kw": res.system_size_kw,
        "monthly_units": res.monthly_units,
        "cost_breakdown": res.cost_breakdown.model_dump(),
        "total_before_subsidy": res.total_before_subsidy,
        "subsidy": res.subsidy,
        "final_cost": res.final_cost,
        "state": res.state,
        "note": "indicative estimate; final quote needs a site visit",
    }


async def _get_subsidy_tool(session: AsyncSession, args: dict[str, Any]) -> dict[str, Any]:
    state = _str(args.get("state"))
    if not state:
        return {"error": "state is required"}
    row = await _get_state_by_name(session, state)
    if not row:
        return {"error": f"unknown state: {state}"}
    sub = await _get_subsidy(session, row.id)
    if not sub:
        return {"state": row.name, "available": False}
    return {
        "state": row.name,
        "available": True,
        "type": sub.subsidy_type,
        "value": float(sub.value),
        "max": float(sub.max_limit) if sub.max_limit is not None else None,
    }


async def _list_services_tool(session: AsyncSession, _args: dict[str, Any]) -> dict[str, Any]:
    rows = await list_services(session, active_only=True)
    return {
        "services": [
            {"title": s.title, "description": (s.description or "")[:240], "price_label": s.price_label}
            for s in rows
        ]
    }


_EXECUTORS = {
    "estimate_system": _estimate_system,
    "get_subsidy": _get_subsidy_tool,
    "list_services": _list_services_tool,
}


async def run_tool(session: AsyncSession, name: str, args: dict[str, Any]) -> str:
    """Execute a tool and return JSON text. Never raises: failures become {"error": ...}."""
    fn = _EXECUTORS.get(name)
    if fn is None:
        return json.dumps({"error": f"unknown tool: {name}"})
    try:
        return json.dumps(await fn(session, args if isinstance(args, dict) else {}), default=str)
    except Exception:  # noqa: BLE001 - tool failures must not break the chat
        log.exception("advisor tool %s failed", name)
        return json.dumps({"error": "tool failed"})
