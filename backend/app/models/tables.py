from __future__ import annotations

import enum
from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class RoofType(str, enum.Enum):
    RCC = "RCC"
    METAL = "METAL"
    GROUND = "GROUND"


class SubsidyType(str, enum.Enum):
    percentage = "percentage"
    fixed = "fixed"


class State(Base):
    __tablename__ = "states"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    code: Mapped[Optional[str]] = mapped_column(String(8), unique=True, nullable=True)

    districts: Mapped[list["District"]] = relationship(
        "District", back_populates="state", cascade="all, delete-orphan"
    )
    subsidies: Mapped[list["StateSubsidy"]] = relationship(
        "StateSubsidy", back_populates="state", cascade="all, delete-orphan"
    )
    location_pricings: Mapped[list["LocationPricing"]] = relationship(
        "LocationPricing", back_populates="state"
    )


class District(Base):
    __tablename__ = "districts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    state_id: Mapped[int] = mapped_column(ForeignKey("states.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)

    state: Mapped[State] = relationship("State", back_populates="districts")
    location_pricings: Mapped[list["LocationPricing"]] = relationship(
        "LocationPricing", back_populates="district"
    )

    __table_args__ = (UniqueConstraint("state_id", "name", name="uq_district_state_name"),)


class PanelCostPerWatt(Base):
    __tablename__ = "panel_cost_per_watt"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cost_per_watt: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=45.0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class InverterCostPerKw(Base):
    __tablename__ = "inverter_cost_per_kw"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cost_per_kw: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=12000.0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class BatteryCost(Base):
    __tablename__ = "battery_cost"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cost_per_kwh: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=18000.0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class InstallationCost(Base):
    __tablename__ = "installation_cost"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    base_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=15000.0)
    per_kw_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=2500.0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class MiscCost(Base):
    __tablename__ = "misc_cost"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    fixed_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=5000.0)
    # Applied on hardware+structure+installation subtotal (before misc)
    percent_of_subtotal: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.02
    )  # 2%
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class RoofTypePricing(Base):
    __tablename__ = "roof_type_pricing"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    roof_type: Mapped[str] = mapped_column(
        String(20), unique=True, nullable=False
    )  # RCC, METAL, GROUND
    # Either multiplier on panel cost, or use fixed+per_kw structure cost
    cost_multiplier: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    structure_fixed: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    structure_per_kw: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class StateSubsidy(Base):
    __tablename__ = "state_subsidy"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    state_id: Mapped[int] = mapped_column(ForeignKey("states.id", ondelete="CASCADE"), index=True)
    subsidy_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # percentage / fixed
    value: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0.0)
    max_limit: Mapped[Optional[float]] = mapped_column(Numeric(14, 2), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    state: Mapped[State] = relationship("State", back_populates="subsidies")


class LocationPricing(Base):
    __tablename__ = "location_pricing"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    state_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("states.id", ondelete="CASCADE"), nullable=True, index=True
    )
    district_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("districts.id", ondelete="CASCADE"), nullable=True, index=True
    )
    # Multiplied against total before subsidy
    system_cost_multiplier: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    label: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    state: Mapped[Optional[State]] = relationship("State", back_populates="location_pricings")
    district: Mapped[Optional[District]] = relationship(
        "District", back_populates="location_pricings"
    )


class EstimationSettings(Base):
    """
    Global knobs: bill → units, units → kW.
    Kept in one table (single row) for admin simplicity.
    """

    __tablename__ = "estimation_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    rupees_per_unit_default: Mapped[float] = mapped_column(
        Float, nullable=False, default=7.0
    )  # ₹6–8 band; default 7
    units_per_kw_per_month: Mapped[float] = mapped_column(
        Float, nullable=False, default=135.0
    )  # 120–150; default 135
    min_system_kw: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    max_system_kw: Mapped[float] = mapped_column(Float, nullable=False, default=15.0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class SiteSettings(Base):
    """
    Single public row (id=1): branding, contact, hours, address for website + metadata.
    """

    __tablename__ = "site_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False, default=1)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    tagline: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    public_url: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    phone_display: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    phone_tel: Mapped[str] = mapped_column(String(40), nullable=False, default="")
    whatsapp_digits: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    email: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    hours: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    address_line1: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    address_line2: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    address_city: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    address_state: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    address_pin: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    address_country: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    hero_headline: Mapped[str] = mapped_column(Text, nullable=False, default="")
    hero_subtitle: Mapped[str] = mapped_column(Text, nullable=False, default="")
    hero_cta_primary_label: Mapped[str] = mapped_column(String(80), nullable=False, default="Get free quote")
    hero_cta_primary_href: Mapped[str] = mapped_column(String(500), nullable=False, default="/quote")
    hero_cta_secondary_label: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    hero_footer_line: Mapped[str] = mapped_column(Text, nullable=False, default="")
    map_embed_url: Mapped[str] = mapped_column(Text, nullable=False, default="")
    service_areas: Mapped[str] = mapped_column(Text, nullable=False, default="")
    social_facebook: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    social_instagram: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    social_linkedin: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    social_youtube: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class CmsProject(Base):
    __tablename__ = "cms_projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    location: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    system_size_kw: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    completion_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    images: Mapped[list["CmsProjectImage"]] = relationship(
        "CmsProjectImage", back_populates="project", cascade="all, delete-orphan"
    )


class CmsProjectImage(Base):
    __tablename__ = "cms_project_images"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("cms_projects.id", ondelete="CASCADE"), index=True
    )
    path: Mapped[str] = mapped_column(String(500), nullable=False)
    alt_text: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    project: Mapped["CmsProject"] = relationship("CmsProject", back_populates="images")


class CmsService(Base):
    __tablename__ = "cms_services"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    icon_name: Mapped[str] = mapped_column(String(40), nullable=False, default="home")
    price_label: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    benefits_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class AdminUser(Base):
    __tablename__ = "admin_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, index=True)
    state: Mapped[Optional[str]] = mapped_column(String(120), nullable=True, index=True)
    district: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    system_size: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    system_size_kw: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    estimated_cost: Mapped[Optional[float]] = mapped_column(Numeric(16, 2), nullable=True)
    monthly_bill: Mapped[Optional[float]] = mapped_column(Numeric(14, 2), nullable=True)
    units_consumed: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    roof_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    raw_payload: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
