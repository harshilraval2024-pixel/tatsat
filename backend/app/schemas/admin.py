from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class AdminLoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1, max_length=128)


class AdminTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class PanelPricingOut(BaseModel):
    cost_per_watt: float = Field(..., ge=0, le=100000)


class InverterPricingOut(BaseModel):
    cost_per_kw: float = Field(..., ge=0, le=10000000)


class BatteryPricingOut(BaseModel):
    cost_per_kwh: float = Field(..., ge=0, le=10000000)


class InstallationPricingOut(BaseModel):
    base_amount: float = Field(..., ge=0, le=100000000)
    per_kw_amount: float = Field(..., ge=0, le=100000000)


class MiscPricingOut(BaseModel):
    fixed_amount: float = Field(..., ge=0, le=100000000)
    percent_of_subtotal: float = Field(..., ge=0, le=1)


class RoofTypePricingItem(BaseModel):
    id: int
    roof_type: str
    cost_multiplier: float
    structure_fixed: float
    structure_per_kw: float


class EstimationSettingsOut(BaseModel):
    rupees_per_unit_default: float = Field(..., gt=0, le=100)
    units_per_kw_per_month: float = Field(..., gt=0, le=1000)
    min_system_kw: float = Field(..., gt=0, le=1000)
    max_system_kw: float = Field(..., gt=0, le=10000)


class PricingBundleOut(BaseModel):
    panel: PanelPricingOut
    inverter: InverterPricingOut
    battery: BatteryPricingOut
    installation: InstallationPricingOut
    misc: MiscPricingOut
    roof_types: list[RoofTypePricingItem]
    estimation: EstimationSettingsOut


class RoofTypePricingUpdate(BaseModel):
    id: int
    cost_multiplier: Optional[float] = Field(None, gt=0, le=100)
    structure_fixed: Optional[float] = Field(None, ge=0, le=100000000)
    structure_per_kw: Optional[float] = Field(None, ge=0, le=100000000)


class PricingBundleUpdate(BaseModel):
    panel: Optional[PanelPricingOut] = None
    inverter: Optional[InverterPricingOut] = None
    battery: Optional[BatteryPricingOut] = None
    installation: Optional[InstallationPricingOut] = None
    misc: Optional[MiscPricingOut] = None
    estimation: Optional[EstimationSettingsOut] = None
    roof_types: Optional[list[RoofTypePricingUpdate]] = Field(None, max_length=20)


class StateOut(BaseModel):
    id: int
    name: str
    code: Optional[str] = None


class DistrictOut(BaseModel):
    id: int
    name: str
    state_id: int


class SubsidyOut(BaseModel):
    id: int
    state_id: int
    state_name: str
    subsidy_type: str
    value: float
    max_limit: Optional[float] = None
    is_active: bool


class SubsidyIn(BaseModel):
    state_id: int
    subsidy_type: str = Field(..., max_length=20)
    value: float = Field(..., ge=0, le=100000000)
    max_limit: Optional[float] = Field(None, ge=0, le=100000000)
    is_active: bool = True


class SubsidyUpdate(BaseModel):
    subsidy_type: str = Field(..., max_length=20)
    value: float = Field(..., ge=0, le=100000000)
    max_limit: Optional[float] = Field(None, ge=0, le=100000000)
    is_active: bool = True


class LocationPricingUpdate(BaseModel):
    system_cost_multiplier: float = Field(..., gt=0, le=10)
    label: Optional[str] = Field(None, max_length=200)
    is_active: bool = True


class LocationPricingOut(BaseModel):
    id: int
    state_id: Optional[int] = None
    district_id: Optional[int] = None
    state_name: Optional[str] = None
    district_name: Optional[str] = None
    system_cost_multiplier: float
    label: Optional[str] = None
    is_active: bool


class LocationPricingIn(BaseModel):
    state_id: Optional[int] = None
    district_id: Optional[int] = None
    system_cost_multiplier: float = Field(1.0, gt=0, le=10)
    label: Optional[str] = Field(None, max_length=200)
    is_active: bool = True


class LeadOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    name: Optional[str] = None
    phone: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    system_size: Optional[str] = None
    system_size_kw: Optional[float] = None
    estimated_cost: Optional[float] = None
    monthly_bill: Optional[float] = None
    units_consumed: Optional[float] = None
    roof_type: Optional[str] = None
    created_at: datetime
