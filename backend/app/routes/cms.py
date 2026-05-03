"""Admin CMS: projects, services, file upload."""

import re
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_admin
from app.models import tables as T
from app.schemas.cms import (
    ProjectCreate,
    ProjectOut,
    ProjectUpdate,
    ServiceCreate,
    ServiceOut,
    ServiceUpdate,
    UploadResponse,
)
from app.services.cms_content import (
    benefits_to_json,
    list_projects,
    list_services,
    project_to_out,
    service_to_out,
)

router = APIRouter(prefix="/admin", tags=["cms"])

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "static" / "uploads"
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_UPLOAD = 12 * 1024 * 1024


class ImageAttachBody(BaseModel):
    path: str = Field(..., min_length=4, max_length=500)
    alt: str = Field("", max_length=300)
    sort_order: int = 0


def _ensure_upload_dir() -> None:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/upload", response_model=UploadResponse)
async def upload_media(
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[T.AdminUser, Depends(get_current_admin)],
    file: UploadFile = File(...),
) -> UploadResponse:
    _ensure_upload_dir()
    raw_name = file.filename or "image"
    ext = Path(raw_name).suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(
            status_code=400,
            detail=f"Allowed types: {', '.join(sorted(ALLOWED_EXT))}",
        )
    body = await file.read()
    if len(body) > MAX_UPLOAD:
        raise HTTPException(status_code=413, detail="File too large (max 12 MB)")
    safe = re.sub(r"[^a-zA-Z0-9._-]", "_", Path(raw_name).stem)[:80]
    name = f"{uuid.uuid4().hex}_{safe}{ext}"
    dest = UPLOAD_DIR / name
    dest.write_bytes(body)
    return UploadResponse(path=f"/uploads/{name}")


@router.get("/projects", response_model=list[ProjectOut])
async def admin_list_projects(
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[T.AdminUser, Depends(get_current_admin)],
) -> list[ProjectOut]:
    rows = await list_projects(session)
    return [project_to_out(p) for p in rows]


@router.post("/projects", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def admin_create_project(
    body: ProjectCreate,
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[T.AdminUser, Depends(get_current_admin)],
) -> ProjectOut:
    p = T.CmsProject(
        title=body.title,
        description=body.description,
        location=body.location,
        system_size_kw=body.system_size_kw,
        completion_date=body.completion_date,
        sort_order=body.sort_order,
    )
    session.add(p)
    await session.commit()
    await session.refresh(p)
    ro = await session.execute(
        select(T.CmsProject)
        .where(T.CmsProject.id == p.id)
        .options(selectinload(T.CmsProject.images))
    )
    return project_to_out(ro.scalar_one())


@router.put("/projects/{project_id}", response_model=ProjectOut)
async def admin_update_project(
    project_id: int,
    body: ProjectUpdate,
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[T.AdminUser, Depends(get_current_admin)],
) -> ProjectOut:
    p = await session.get(T.CmsProject, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(p, k, v)
    await session.commit()
    ro = await session.execute(
        select(T.CmsProject)
        .where(T.CmsProject.id == p.id)
        .options(selectinload(T.CmsProject.images))
    )
    return project_to_out(ro.scalar_one())


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_project(
    project_id: int,
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[T.AdminUser, Depends(get_current_admin)],
) -> None:
    r = await session.execute(
        select(T.CmsProject)
        .where(T.CmsProject.id == project_id)
        .options(selectinload(T.CmsProject.images))
    )
    p = r.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    for im in p.images:
        _delete_disk_file(im.path)
    await session.delete(p)
    await session.commit()


def _delete_disk_file(public_path: str) -> None:
    if not public_path.startswith("/uploads/"):
        return
    name = Path(public_path).name
    fp = UPLOAD_DIR / name
    try:
        if fp.is_file():
            fp.unlink()
    except OSError:
        pass


@router.post("/projects/{project_id}/images", response_model=ProjectOut)
async def admin_add_project_image(
    project_id: int,
    body: ImageAttachBody,
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[T.AdminUser, Depends(get_current_admin)],
) -> ProjectOut:
    p = await session.get(T.CmsProject, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    if body.path.startswith(("http://", "https://")):
        pass  # external image URL (e.g. seeded Unsplash)
    elif body.path.startswith("/uploads/"):
        fp = UPLOAD_DIR / Path(body.path).name
        if not fp.is_file():
            raise HTTPException(status_code=400, detail="Uploaded file not found on server")
    else:
        raise HTTPException(status_code=400, detail="path must be /uploads/… or http(s) URL")
    session.add(
        T.CmsProjectImage(
            project_id=project_id,
            path=body.path,
            alt_text=body.alt,
            sort_order=body.sort_order,
        )
    )
    await session.commit()
    ro = await session.execute(
        select(T.CmsProject)
        .where(T.CmsProject.id == project_id)
        .options(selectinload(T.CmsProject.images))
    )
    return project_to_out(ro.scalar_one())


@router.delete("/projects/{project_id}/images/{image_id}", response_model=ProjectOut)
async def admin_delete_project_image(
    project_id: int,
    image_id: int,
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[T.AdminUser, Depends(get_current_admin)],
) -> ProjectOut:
    im = await session.get(T.CmsProjectImage, image_id)
    if not im or im.project_id != project_id:
        raise HTTPException(status_code=404, detail="Image not found")
    _delete_disk_file(im.path)
    await session.delete(im)
    await session.commit()
    ro = await session.execute(
        select(T.CmsProject)
        .where(T.CmsProject.id == project_id)
        .options(selectinload(T.CmsProject.images))
    )
    return project_to_out(ro.scalar_one())


@router.get("/services", response_model=list[ServiceOut])
async def admin_list_services(
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[T.AdminUser, Depends(get_current_admin)],
) -> list[ServiceOut]:
    rows = await list_services(session, active_only=False)
    return [service_to_out(s) for s in rows]


@router.post("/services", response_model=ServiceOut, status_code=status.HTTP_201_CREATED)
async def admin_create_service(
    body: ServiceCreate,
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[T.AdminUser, Depends(get_current_admin)],
) -> ServiceOut:
    r0 = await session.execute(select(T.CmsService).where(T.CmsService.slug == body.slug))
    if r0.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="slug already exists")
    s = T.CmsService(
        slug=body.slug,
        title=body.title,
        description=body.description,
        icon_name=body.icon_name,
        price_label=body.price_label,
        benefits_json=benefits_to_json(body.benefits),
        sort_order=body.sort_order,
        is_active=body.is_active,
    )
    session.add(s)
    await session.commit()
    await session.refresh(s)
    return service_to_out(s)


@router.put("/services/{service_id}", response_model=ServiceOut)
async def admin_update_service(
    service_id: int,
    body: ServiceUpdate,
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[T.AdminUser, Depends(get_current_admin)],
) -> ServiceOut:
    s = await session.get(T.CmsService, service_id)
    if not s:
        raise HTTPException(status_code=404, detail="Service not found")
    data = body.model_dump(exclude_unset=True)
    if "benefits" in data and data["benefits"] is not None:
        s.benefits_json = benefits_to_json(data.pop("benefits"))
    new_slug = data.pop("slug", None)
    if new_slug is not None and new_slug != s.slug:
        r0 = await session.execute(
            select(T.CmsService).where(
                T.CmsService.slug == new_slug,
                T.CmsService.id != service_id,
            )
        )
        if r0.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="slug already in use")
        s.slug = new_slug
    for k, v in data.items():
        setattr(s, k, v)
    await session.commit()
    await session.refresh(s)
    return service_to_out(s)


@router.delete("/services/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_service(
    service_id: int,
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[T.AdminUser, Depends(get_current_admin)],
) -> None:
    s = await session.get(T.CmsService, service_id)
    if not s:
        raise HTTPException(status_code=404, detail="Service not found")
    await session.delete(s)
    await session.commit()