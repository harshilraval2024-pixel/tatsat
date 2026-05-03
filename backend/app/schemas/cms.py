"""CMS projects & services API shapes."""

from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


class ProjectImageOut(BaseModel):
    url: str = Field(..., description="Public URL path under API origin, e.g. /uploads/…")
    alt: str = ""
    sort_order: int = 0


class ProjectOut(BaseModel):
    id: int
    title: str
    description: str = ""
    location: str
    system_size_kw: float
    completion_date: Optional[date] = None
    sort_order: int = 0
    images: list[ProjectImageOut] = []


class ProjectCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    description: str = ""
    location: str = ""
    system_size_kw: float = 0.0
    completion_date: Optional[date] = None
    sort_order: int = 0


class ProjectUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=300)
    description: Optional[str] = None
    location: Optional[str] = None
    system_size_kw: Optional[float] = None
    completion_date: Optional[date] = None
    sort_order: Optional[int] = None


class ServiceOut(BaseModel):
    id: int
    slug: str
    title: str
    description: str
    icon_name: str = "home"
    price_label: Optional[str] = None
    benefits: list[str] = []
    sort_order: int = 0
    is_active: bool = True


class ServiceCreate(BaseModel):
    slug: str = Field(..., min_length=1, max_length=80)
    title: str = Field(..., min_length=1, max_length=200)
    description: str = ""
    icon_name: str = Field(default="home", max_length=40)
    price_label: Optional[str] = Field(None, max_length=120)
    benefits: list[str] = Field(default_factory=list)
    sort_order: int = 0
    is_active: bool = True


class ServiceUpdate(BaseModel):
    slug: Optional[str] = Field(None, min_length=1, max_length=80)
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    icon_name: Optional[str] = Field(None, max_length=40)
    price_label: Optional[str] = None
    benefits: Optional[list[str]] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class UploadResponse(BaseModel):
    path: str = Field(..., description="Relative URL stored on project/service records")

