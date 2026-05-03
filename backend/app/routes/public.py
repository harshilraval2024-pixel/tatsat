import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.tables import District, Lead, State
from app.schemas.estimate import EstimateRequest, EstimateResponse
from app.schemas.cms import ProjectOut, ServiceOut
from app.schemas.site_settings import SiteSettingsOut
from app.services.cms_content import (
    list_projects,
    list_services,
    project_to_out,
    service_to_out,
)
from app.services.site_settings import get_site_settings_row, site_settings_to_out
from app.services.estimate_service import (
    compute_estimate,
    estimate_request_to_lead_dict,
)
from app.services.pdf_service import render_estimate_pdf

router = APIRouter(tags=["public"])
log = logging.getLogger(__name__)


@router.get("/site-settings", response_model=SiteSettingsOut)
async def get_site_settings_public(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> SiteSettingsOut:
    row = await get_site_settings_row(session)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Site settings not initialized. Run: python -m app.scripts.seed_data",
        )
    return site_settings_to_out(row)


@router.get("/config", response_model=SiteSettingsOut)
async def get_website_config_public(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> SiteSettingsOut:
    """Alias for full website JSON (same as `/site-settings`)."""
    row = await get_site_settings_row(session)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Site settings not initialized. Run: python -m app.scripts.seed_data",
        )
    return site_settings_to_out(row)


@router.get("/projects", response_model=list[ProjectOut])
async def list_projects_public(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> list[ProjectOut]:
    rows = await list_projects(session)
    return [project_to_out(p) for p in rows]


@router.get("/services", response_model=list[ServiceOut])
async def list_services_public(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> list[ServiceOut]:
    rows = await list_services(session, active_only=True)
    return [service_to_out(s) for s in rows]


@router.get("/states", response_model=list[dict])
async def list_states(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> list[dict]:
    r = await session.execute(
        select(State).order_by(State.name)
    )
    items = r.scalars().all()
    return [{"id": s.id, "name": s.name, "code": s.code} for s in items]


@router.get("/districts", response_model=list[dict])
async def list_districts(
    session: Annotated[AsyncSession, Depends(get_db)],
    state: Annotated[Optional[str], Query()] = None,
    state_id: Annotated[Optional[int], Query()] = None,
) -> list[dict]:
    if not state and state_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query param `state` (name) or `state_id` is required",
        )
    st: Optional[State] = None
    if state_id is not None:
        r = await session.execute(select(State).where(State.id == state_id))
        st = r.scalar_one_or_none()
    elif state:
        r2 = await session.execute(
            select(State).where(State.name.ilike(state.strip()))
        )
        st = r2.scalar_one_or_none()
        if not st:
            r3 = await session.execute(
                select(State).where(State.name.ilike(f"%{state.strip()}%"))
            )
            st = r3.scalars().first()
    if not st:
        return []
    r = await session.execute(
        select(District)
        .where(District.state_id == st.id)
        .order_by(District.name)
    )
    dlist = r.scalars().all()
    return [
        {"id": d.id, "name": d.name, "state_id": d.state_id} for d in dlist
    ]


async def run_estimate_and_save(
    body: EstimateRequest, session: AsyncSession
) -> EstimateResponse:
    try:
        result = await compute_estimate(session, body)
    except ValueError as e:
        log.warning("estimate validation: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        ) from e
    except RuntimeError as e:
        log.exception("estimate configuration error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        ) from e

    if body.save_lead:
        d = estimate_request_to_lead_dict(body, result)
        lead = Lead(
            name=d.get("name"),
            phone=d.get("phone"),
            state=d.get("state"),
            district=body.district,
            system_size=result.system_size,
            system_size_kw=result.system_size_kw,
            estimated_cost=result.final_cost,
            monthly_bill=body.monthly_bill,
            units_consumed=result.monthly_units,
            roof_type=body.roof_type,
            raw_payload={
                "request": body.model_dump(),
                "response": result.model_dump(),
            },
        )
        session.add(lead)
        await session.commit()

    return result


@router.post("/estimate", response_model=EstimateResponse)
async def post_estimate(
    body: EstimateRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> EstimateResponse:
    return await run_estimate_and_save(body, session)


@router.post("/estimate/pdf", response_class=Response)
async def post_estimate_pdf(
    body: EstimateRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    try:
        result = await compute_estimate(session, body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        ) from e
    raw = render_estimate_pdf(body, result)
    return Response(
        content=raw,
        media_type="application/pdf",
        headers={"Content-Disposition": 'inline; filename="solar-estimate.pdf"'},
    )
