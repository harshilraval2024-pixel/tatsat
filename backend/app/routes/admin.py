import logging
from typing import Annotated, Any

import httpx
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Response,
    status,
)
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.dependencies import get_current_admin
from app.models import tables as T
from app.schemas import admin as S
from app.schemas.estimate import EstimateRequest, EstimateResponse
from app.schemas.site_settings import SiteSettingsOut, SiteSettingsUpdate
from app.routes.public import run_estimate_and_save
from app.services.estimate_service import compute_estimate
from app.services.leads_export import streaming_leads_csv
from app.services.site_settings import (
    apply_site_settings_update,
    get_site_settings_row,
    site_settings_to_out,
)
from app.services.pdf_service import render_estimate_pdf
from app.utils.security import create_access_token, verify_password

router = APIRouter(prefix="/admin", tags=["admin"])
log = logging.getLogger(__name__)
settings = get_settings()

_PRICING_SEED_MSG = (
    "Pricing data missing or incomplete. From the `backend` folder run: "
    "`alembic upgrade head` then `python -m app.scripts.seed_data`."
)


def _pricing_missing() -> None:
    raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, _PRICING_SEED_MSG)


@router.post("/login", response_model=S.AdminTokenResponse)
async def admin_login(
    body: S.AdminLoginRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> S.AdminTokenResponse:
    r = await session.execute(
        select(T.AdminUser).where(T.AdminUser.username == body.username)
    )
    user = r.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled"
        )
    token = create_access_token({"sub": user.username, "typ": "admin"})
    return S.AdminTokenResponse(access_token=token)


async def _bundle(session: AsyncSession) -> S.PricingBundleOut:
    p = (await session.execute(select(T.PanelCostPerWatt).limit(1))).scalar_one_or_none()
    i = (await session.execute(select(T.InverterCostPerKw).limit(1))).scalar_one_or_none()
    b = (await session.execute(select(T.BatteryCost).limit(1))).scalar_one_or_none()
    inst = (await session.execute(select(T.InstallationCost).limit(1))).scalar_one_or_none()
    m = (await session.execute(select(T.MiscCost).limit(1))).scalar_one_or_none()
    e = (await session.execute(select(T.EstimationSettings).limit(1))).scalar_one_or_none()
    if not all((p, i, b, inst, m, e)):
        _pricing_missing()
    rts = (await session.execute(select(T.RoofTypePricing))).scalars().all()
    return S.PricingBundleOut(
        panel=S.PanelPricingOut(cost_per_watt=float(p.cost_per_watt)),
        inverter=S.InverterPricingOut(cost_per_kw=float(i.cost_per_kw)),
        battery=S.BatteryPricingOut(cost_per_kwh=float(b.cost_per_kwh)),
        installation=S.InstallationPricingOut(
            base_amount=float(inst.base_amount), per_kw_amount=float(inst.per_kw_amount)
        ),
        misc=S.MiscPricingOut(
            fixed_amount=float(m.fixed_amount), percent_of_subtotal=float(m.percent_of_subtotal)
        ),
        estimation=S.EstimationSettingsOut(
            rupees_per_unit_default=float(e.rupees_per_unit_default),
            units_per_kw_per_month=float(e.units_per_kw_per_month),
            min_system_kw=float(e.min_system_kw),
            max_system_kw=float(e.max_system_kw),
        ),
        roof_types=[
            S.RoofTypePricingItem(
                id=x.id,
                roof_type=x.roof_type,
                cost_multiplier=float(x.cost_multiplier),
                structure_fixed=float(x.structure_fixed),
                structure_per_kw=float(x.structure_per_kw),
            )
            for x in rts
        ],
    )


@router.get("/site-settings", response_model=SiteSettingsOut)
async def admin_get_site_settings(
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[T.AdminUser, Depends(get_current_admin)],
) -> SiteSettingsOut:
    row = await get_site_settings_row(session)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Site settings missing. Run seed_data.",
        )
    return site_settings_to_out(row)


@router.put("/site-settings", response_model=SiteSettingsOut)
async def admin_put_site_settings(
    body: SiteSettingsUpdate,
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[T.AdminUser, Depends(get_current_admin)],
) -> SiteSettingsOut:
    row = await get_site_settings_row(session)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Site settings missing. Run seed_data.",
        )
    apply_site_settings_update(row, body)
    await session.commit()
    await session.refresh(row)
    return site_settings_to_out(row)


@router.get("/pricing", response_model=S.PricingBundleOut)
async def get_pricing(
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[T.AdminUser, Depends(get_current_admin)],
) -> S.PricingBundleOut:
    return await _bundle(session)


@router.post("/pricing", response_model=S.PricingBundleOut)
async def post_pricing(
    body: S.PricingBundleUpdate,
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[T.AdminUser, Depends(get_current_admin)],
) -> S.PricingBundleOut:
    if body.panel:
        p = (await session.execute(select(T.PanelCostPerWatt).limit(1))).scalar_one_or_none()
        if not p:
            _pricing_missing()
        p.cost_per_watt = body.panel.cost_per_watt
    if body.inverter:
        o = (await session.execute(select(T.InverterCostPerKw).limit(1))).scalar_one_or_none()
        if not o:
            _pricing_missing()
        o.cost_per_kw = body.inverter.cost_per_kw
    if body.battery:
        b = (await session.execute(select(T.BatteryCost).limit(1))).scalar_one_or_none()
        if not b:
            _pricing_missing()
        b.cost_per_kwh = body.battery.cost_per_kwh
    if body.installation:
        inst = (
            await session.execute(select(T.InstallationCost).limit(1))
        ).scalar_one_or_none()
        if not inst:
            _pricing_missing()
        inst.base_amount = body.installation.base_amount
        inst.per_kw_amount = body.installation.per_kw_amount
    if body.misc:
        m = (await session.execute(select(T.MiscCost).limit(1))).scalar_one_or_none()
        if not m:
            _pricing_missing()
        m.fixed_amount = body.misc.fixed_amount
        m.percent_of_subtotal = body.misc.percent_of_subtotal
    if body.estimation:
        e = (
            await session.execute(select(T.EstimationSettings).limit(1))
        ).scalar_one_or_none()
        if not e:
            _pricing_missing()
        e.rupees_per_unit_default = body.estimation.rupees_per_unit_default
        e.units_per_kw_per_month = body.estimation.units_per_kw_per_month
        e.min_system_kw = body.estimation.min_system_kw
        e.max_system_kw = body.estimation.max_system_kw
    if body.roof_types:
        for row in body.roof_types:
            rid = int(row.get("id", 0))
            r = await session.get(T.RoofTypePricing, rid)
            if r and "cost_multiplier" in row:
                r.cost_multiplier = float(row["cost_multiplier"])
            if r and "structure_fixed" in row:
                r.structure_fixed = float(row["structure_fixed"])
            if r and "structure_per_kw" in row:
                r.structure_per_kw = float(row["structure_per_kw"])
    await session.commit()
    return await _bundle(session)


async def _load_subsidy_list(session: AsyncSession) -> list[S.SubsidyOut]:
    r = await session.execute(
        select(T.StateSubsidy, T.State)
        .join(T.State, T.State.id == T.StateSubsidy.state_id)
    )
    out: list[S.SubsidyOut] = []
    for sub, st in r.all():
        out.append(
            S.SubsidyOut(
                id=sub.id,
                state_id=sub.state_id,
                state_name=st.name,
                subsidy_type=sub.subsidy_type,
                value=float(sub.value),
                max_limit=float(sub.max_limit) if sub.max_limit is not None else None,
                is_active=sub.is_active,
            )
        )
    return out


@router.get("/subsidy", response_model=list[S.SubsidyOut])
async def get_subsidy(
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[T.AdminUser, Depends(get_current_admin)],
) -> list[S.SubsidyOut]:
    return await _load_subsidy_list(session)


@router.post("/subsidy", response_model=list[S.SubsidyOut])
async def post_subsidy(
    body: S.SubsidyIn,
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[T.AdminUser, Depends(get_current_admin)],
) -> list[S.SubsidyOut]:
    if (body.subsidy_type or "").lower() not in ("percentage", "fixed"):
        raise HTTPException(
            status_code=400, detail="subsidy_type must be 'percentage' or 'fixed'"
        )
    st = await session.get(T.State, body.state_id)
    if not st:
        raise HTTPException(status_code=400, detail="Invalid state_id")
    sub = T.StateSubsidy(
        state_id=body.state_id,
        subsidy_type=body.subsidy_type.lower(),
        value=body.value,
        max_limit=body.max_limit,
        is_active=body.is_active,
    )
    session.add(sub)
    await session.commit()
    return await _load_subsidy_list(session)


@router.get("/location-pricing", response_model=list[S.LocationPricingOut])
async def get_location_pricing(
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[T.AdminUser, Depends(get_current_admin)],
) -> list[S.LocationPricingOut]:
    r = await session.execute(select(T.LocationPricing))
    items = r.scalars().all()
    out: list[S.LocationPricingOut] = []
    for x in items:
        sn = (await session.get(T.State, x.state_id)) if x.state_id else None
        dn = (await session.get(T.District, x.district_id)) if x.district_id else None
        out.append(
            S.LocationPricingOut(
                id=x.id,
                state_id=x.state_id,
                district_id=x.district_id,
                state_name=sn.name if sn else None,
                district_name=dn.name if dn else None,
                system_cost_multiplier=float(x.system_cost_multiplier),
                label=x.label,
                is_active=x.is_active,
            )
        )
    return out


@router.post("/location-pricing", response_model=list[S.LocationPricingOut])
async def post_location_pricing(
    body: S.LocationPricingIn,
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[T.AdminUser, Depends(get_current_admin)],
) -> list[S.LocationPricingOut]:
    if (body.state_id is None) and (body.district_id is None):
        raise HTTPException(
            status_code=400, detail="Provide state_id and/or district_id"
        )
    row = T.LocationPricing(
        state_id=body.state_id,
        district_id=body.district_id,
        system_cost_multiplier=body.system_cost_multiplier,
        label=body.label,
        is_active=body.is_active,
    )
    session.add(row)
    await session.commit()
    return await get_location_pricing(session, _)


@router.get("/leads", response_model=list[S.LeadOut])
async def get_leads(
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[T.AdminUser, Depends(get_current_admin)],
    limit: int = Query(200, le=2000, ge=1),
) -> list[S.LeadOut]:
    r = await session.execute(
        select(T.Lead).order_by(T.Lead.created_at.desc()).limit(limit)
    )
    rows = r.scalars().all()
    return [S.LeadOut.model_validate(x) for x in rows]


@router.get("/export-leads")
async def export_leads(
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[T.AdminUser, Depends(get_current_admin)],
) -> StreamingResponse:
    return await streaming_leads_csv(session)


@router.post("/estimate-pdf", response_class=Response)
async def post_estimate_pdf(
    body: EstimateRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[T.AdminUser, Depends(get_current_admin)],
) -> Response:
    try:
        result = await compute_estimate(session, body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    raw = render_estimate_pdf(body, result)
    return Response(
        content=raw,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'inline; filename="solar-estimate.pdf"',
        },
    )


@router.post("/estimate", response_model=EstimateResponse)
async def post_estimate_as_admin(
    body: EstimateRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[T.AdminUser, Depends(get_current_admin)],
) -> EstimateResponse:
    """Run estimate (optional save_lead) with admin auth; same engine as public."""
    return await run_estimate_and_save(body, session)


@router.post("/whatsapp/notify", response_model=dict[str, str])
async def whatsapp_notify_stub(
    body: dict[str, str],
    _: Annotated[T.AdminUser, Depends(get_current_admin)],
) -> dict[str, str]:
    """
    Optional: set WHATSAPP_API_URL + WHATSAPP_API_TOKEN in .env to forward to your provider.
    Request JSON: { "to": "9198...", "message": "..." }.
    """
    to = (body or {}).get("to", "")
    message = (body or {}).get("message", "")
    if not to or not message:
        raise HTTPException(400, detail="Provide 'to' and 'message'")
    url = settings.whatsapp_api_url.strip()
    if not url:
        log.info("WhatsApp API URL not set; would send to %s (stub)", to[:4])
        return {"status": "disabled", "detail": "Configure WHATSAPP_API_URL in environment"}
    try:
        headers: dict[str, str] = {}
        if settings.whatsapp_api_token:
            headers["Authorization"] = f"Bearer {settings.whatsapp_api_token}"
        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.post(url, json={"to": to, "message": message}, headers=headers)
        r.raise_for_status()
        return {"status": "sent"}
    except Exception as e:  # noqa: BLE001
        log.exception("WhatsApp forward failed: %s", e)
        raise HTTPException(502, detail="Upstream WhatsApp call failed") from e
