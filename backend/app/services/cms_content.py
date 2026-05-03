"""CRUD helpers for CMS projects and services."""

import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import tables as T
from app.schemas.cms import ProjectOut, ProjectImageOut, ServiceOut


def _benefits_list(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        data = json.loads(raw)
        if isinstance(data, list):
            return [str(x) for x in data]
    except json.JSONDecodeError:
        pass
    return []


def project_to_out(p: T.CmsProject) -> ProjectOut:
    imgs = sorted(p.images, key=lambda x: (x.sort_order, x.id))
    return ProjectOut(
        id=p.id,
        title=p.title,
        description=p.description or "",
        location=p.location or "",
        system_size_kw=float(p.system_size_kw or 0),
        completion_date=p.completion_date,
        sort_order=p.sort_order,
        images=[
            ProjectImageOut(url=im.path, alt=im.alt_text or "", sort_order=im.sort_order)
            for im in imgs
        ],
    )


async def list_projects(session: AsyncSession) -> list[T.CmsProject]:
    r = await session.execute(
        select(T.CmsProject)
        .options(selectinload(T.CmsProject.images))
        .order_by(T.CmsProject.sort_order, T.CmsProject.id)
    )
    return list(r.scalars().unique().all())


async def list_services(session: AsyncSession, active_only: bool = True) -> list[T.CmsService]:
    if active_only:
        q = (
            select(T.CmsService)
            .where(T.CmsService.is_active.is_(True))
            .order_by(T.CmsService.sort_order, T.CmsService.id)
        )
    else:
        q = select(T.CmsService).order_by(T.CmsService.sort_order, T.CmsService.id)
    r = await session.execute(q)
    return list(r.scalars().all())


def service_to_out(s: T.CmsService) -> ServiceOut:
    return ServiceOut(
        id=s.id,
        slug=s.slug,
        title=s.title,
        description=s.description or "",
        icon_name=s.icon_name or "home",
        price_label=s.price_label,
        benefits=_benefits_list(s.benefits_json),
        sort_order=s.sort_order,
        is_active=s.is_active,
    )


def benefits_to_json(benefits: list[str]) -> str:
    return json.dumps(benefits, ensure_ascii=False)
