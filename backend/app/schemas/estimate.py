import re
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.tables import RoofType


class CostBreakdown(BaseModel):
    panels: int
    inverter: int
    battery: int
    structure: int
    installation: int
    misc: int


class EstimateResponse(BaseModel):
    system_size: str
    system_size_kw: float
    cost_breakdown: CostBreakdown
    total_before_subsidy: int
    subsidy: int
    final_cost: int
    monthly_units: float
    state: str
    details: dict[str, Any] = Field(default_factory=dict)


class EstimateRequest(BaseModel):
    """Public estimate — matches a typical solar form."""

    name: Optional[str] = Field(None, max_length=120)
    phone: Optional[str] = Field(None, max_length=20)
    state: str = Field(..., min_length=1, max_length=100, description="State name, e.g. Gujarat")
    district: Optional[str] = Field(None, max_length=100)
    monthly_bill: Optional[float] = Field(
        None, ge=0, le=10000000, description="INR; used if units not given"
    )
    monthly_units: Optional[float] = Field(
        None, ge=0, le=1000000, description="kWh per month; takes precedence if both set"
    )
    rupees_per_unit: Optional[float] = Field(
        None, ge=1, le=20, description="Override default ₹/unit for bill→units (band ~₹6–8)"
    )
    include_battery: bool = False
    battery_kwh: float = Field(5, ge=0, le=100)
    roof_type: str = Field("RCC", description="RCC | METAL | GROUND")
    save_lead: bool = True

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not v.strip():
            return None
        v = v.strip()
        if not re.fullmatch(r"\+?[0-9][0-9 ()-]{5,18}", v):
            raise ValueError("phone must contain only digits, spaces, +, - and ()")
        return v

    @field_validator("roof_type")
    @classmethod
    def validate_roof(cls, v: str) -> str:
        allowed = {e.value for e in RoofType}
        u = v.strip().upper()
        if u not in allowed:
            raise ValueError(f"roof_type must be one of {allowed}")
        return u

    @model_validator(mode="after")
    def bill_or_units(self) -> "EstimateRequest":
        if self.monthly_units is not None and self.monthly_units > 0:
            return self
        if self.monthly_bill is not None and self.monthly_bill > 0:
            return self
        raise ValueError("Provide either monthly_bill or monthly_units")
