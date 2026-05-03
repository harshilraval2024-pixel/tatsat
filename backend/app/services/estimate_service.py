from __future__ import annotations

from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import tables as T
from app.schemas.estimate import CostBreakdown, EstimateRequest, EstimateResponse


def _round_inr(x: float) -> int:
    return int(round(x))


def _resolve_monthly_units(req: EstimateRequest, ru_default: float) -> float:
    if req.monthly_units is not None and req.monthly_units > 0:
        return float(req.monthly_units)
    ru = float(req.rupees_per_unit) if req.rupees_per_unit else ru_default
    if not req.monthly_bill or req.monthly_bill <= 0:
        raise ValueError("Invalid bill/units")
    return float(req.monthly_bill) / max(ru, 0.01)


def _system_kw(
    units: float, units_per_kw: float, min_kw: float, max_kw: float
) -> float:
    raw = units / max(units_per_kw, 1.0)
    rounded = max(min_kw, min(max_kw, round(raw, 1)))
    return float(rounded)


def _apply_subsidy(
    total_before: float, sub: Optional[T.StateSubsidy]
) -> int:
    if not sub or not sub.is_active:
        return 0
    t = (sub.subsidy_type or "").lower()
    val = float(sub.value)
    if t == "percentage":
        s = total_before * (val / 100.0)
    else:
        s = val
    cap = sub.max_limit
    if cap is not None:
        s = min(s, float(cap))
    return max(0, _round_inr(s))


async def _get_single(session: AsyncSession, model: type) -> Any:
    r = await session.execute(select(model).order_by(model.id).limit(1))  # type: ignore[attr-defined]
    return r.scalar_one_or_none()


async def _get_state_by_name(
    session: AsyncSession, name: str
) -> Optional[T.State]:
    n = name.strip()
    r = await session.execute(select(T.State).where(T.State.name.ilike(n)))
    row = r.scalar_one_or_none()
    if row:
        return row
    r2 = await session.execute(
        select(T.State).where(T.State.name.ilike(f"%{n}%"))
    )
    return r2.scalars().first()


async def _get_roof_pricing(
    session: AsyncSession, roof: str
) -> T.RoofTypePricing:
    r = await session.execute(
        select(T.RoofTypePricing).where(T.RoofTypePricing.roof_type == roof)
    )
    row = r.scalar_one_or_none()
    if not row:
        r2 = await session.execute(select(T.RoofTypePricing).limit(1))
        row2 = r2.scalar_one_or_none()
        if not row2:
            raise RuntimeError("Roof type pricing not seeded")
        return row2
    return row


async def _get_subsidy(
    session: AsyncSession, state_id: int
) -> Optional[T.StateSubsidy]:
    r = await session.execute(
        select(T.StateSubsidy)
        .where(
            T.StateSubsidy.state_id == state_id,
            T.StateSubsidy.is_active.is_(True),
        )
        .order_by(T.StateSubsidy.id.desc())
        .limit(1)
    )
    return r.scalar_one_or_none()


async def _get_location_multiplier(
    session: AsyncSession,
    state_id: int,
    district_id: Optional[int],
) -> float:
    if district_id is not None:
        r = await session.execute(
            select(T.LocationPricing)
            .where(
                T.LocationPricing.district_id == district_id,
                T.LocationPricing.is_active.is_(True),
            )
            .limit(1)
        )
        d = r.scalar_one_or_none()
        if d and d.system_cost_multiplier and d.system_cost_multiplier > 0:
            return float(d.system_cost_multiplier)
    r2 = await session.execute(
        select(T.LocationPricing)
        .where(
            T.LocationPricing.state_id == state_id,
            T.LocationPricing.district_id.is_(None),
            T.LocationPricing.is_active.is_(True),
        )
        .limit(1)
    )
    s = r2.scalar_one_or_none()
    if s and s.system_cost_multiplier and s.system_cost_multiplier > 0:
        return float(s.system_cost_multiplier)
    return 1.0


async def _get_district_id(
    session: AsyncSession, state_id: int, district_name: Optional[str]
) -> Optional[int]:
    if not district_name or not district_name.strip():
        return None
    r = await session.execute(
        select(T.District).where(
            T.District.state_id == state_id,
            T.District.name.ilike(district_name.strip()),
        )
    )
    d = r.scalar_one_or_none()
    if d:
        return d.id
    r2 = await session.execute(
        select(T.District).where(
            T.District.state_id == state_id,
            T.District.name.ilike(f"%{district_name.strip()}%"),
        )
    )
    d2 = r2.scalars().first()
    return d2.id if d2 else None


async def compute_estimate(
    session: AsyncSession, req: EstimateRequest
) -> EstimateResponse:
    est = await _get_single(session, T.EstimationSettings)
    if not est:
        raise RuntimeError("Estimation settings not configured")

    panel = await _get_single(session, T.PanelCostPerWatt)
    inv = await _get_single(session, T.InverterCostPerKw)
    bat = await _get_single(session, T.BatteryCost)
    inst = await _get_single(session, T.InstallationCost)
    misc = await _get_single(session, T.MiscCost)
    for label, m in [
        ("panel", panel),
        ("inverter", inv),
        ("battery", bat),
        ("installation", inst),
        ("misc", misc),
    ]:
        if m is None:
            raise RuntimeError(f"Missing pricing: {label}")

    state_row = await _get_state_by_name(session, req.state)
    if not state_row:
        raise ValueError(f"Unknown state: {req.state}")

    dist_id = await _get_district_id(
        session, state_row.id, req.district
    )
    loc_mult = await _get_location_multiplier(
        session, state_row.id, dist_id
    )
    roof_p = await _get_roof_pricing(session, req.roof_type)
    sub = await _get_subsidy(session, state_row.id)

    ru_default = float(est.rupees_per_unit_default)
    units = _resolve_monthly_units(req, ru_default)
    skw = _system_kw(
        units,
        float(est.units_per_kw_per_month),
        float(est.min_system_kw),
        float(est.max_system_kw),
    )
    w_att = skw * 1000.0

    p_inr = w_att * float(panel.cost_per_watt)  # type: ignore[union-attr]
    p_inr *= float(roof_p.cost_multiplier)
    i_inr = skw * float(inv.cost_per_kw)  # type: ignore[union-attr]
    b_inr = 0.0
    if req.include_battery and req.battery_kwh and req.battery_kwh > 0:
        b_inr = float(bat.cost_per_kwh) * float(req.battery_kwh)  # type: ignore[union-attr]
    st_inr = (
        float(roof_p.structure_per_kw) * skw + float(roof_p.structure_fixed)
    )

    inst_inr = float(inst.base_amount) + skw * float(inst.per_kw_amount)  # type: ignore[union-attr]
    # Pre-misc = (panels+inverter+battery+structure+installation) × location, then + misc
    base_system = p_inr + i_inr + b_inr + st_inr + inst_inr
    scaled = base_system * loc_mult
    misc_pct = float(misc.percent_of_subtotal)  # type: ignore[union-attr]
    misc_fix = float(misc.fixed_amount)  # type: ignore[union-attr]
    misc_total = misc_fix + scaled * misc_pct
    total_before = scaled + misc_total
    subsidy = _apply_subsidy(total_before, sub)
    final = max(0, int(round(total_before - subsidy)))

    breakdown = CostBreakdown(
        panels=_round_inr(p_inr * loc_mult),
        inverter=_round_inr(i_inr * loc_mult),
        battery=_round_inr(b_inr * loc_mult),
        structure=_round_inr(st_inr * loc_mult),
        installation=_round_inr(inst_inr * loc_mult),
        misc=_round_inr(misc_total),
    )
    ssk = f"{int(skw)} kW" if skw == int(skw) else f"{round(skw, 1)} kW"
    return EstimateResponse(
        system_size=ssk,
        system_size_kw=skw,
        cost_breakdown=breakdown,
        total_before_subsidy=_round_inr(total_before),
        subsidy=subsidy,
        final_cost=final,
        monthly_units=round(units, 2),
        state=state_row.name,
        details={
            "location_cost_multiplier": loc_mult,
            "roof_type": req.roof_type,
            "rupees_per_unit_used": float(
                req.rupees_per_unit
                if req.rupees_per_unit
                else ru_default
            )
            if (req.monthly_units in (None, 0) and req.monthly_bill)
            else None,
        },
    )


def estimate_request_to_lead_dict(
    req: EstimateRequest, res: EstimateResponse
) -> dict[str, Any]:
    return {
        "name": req.name,
        "phone": req.phone,
        "state": res.state,
        "district": req.district,
        "system_size": res.system_size,
        "system_size_kw": res.system_size_kw,
        "estimated_cost": float(res.final_cost),
        "monthly_bill": req.monthly_bill,
        "units_consumed": res.monthly_units,
        "roof_type": req.roof_type,
    }
