r"""
Populate initial reference data and default admin.
Run from `backend/` (PowerShell or bash):

  .venv/Scripts/python -m app.scripts.seed_data

Requires DATABASE_URL in .env and prior `alembic upgrade head`.
"""

from __future__ import annotations

import json
import os
import sys

# package path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import tables as T
from app.utils.security import get_password_hash


INDIAN_STATES = [
    ("Gujarat", "GJ"),
    ("Maharashtra", "MH"),
    ("Rajasthan", "RJ"),
    ("Karnataka", "KA"),
    ("Tamil Nadu", "TN"),
    ("Telangana", "TS"),
    ("Andhra Pradesh", "AP"),
    ("Kerala", "KL"),
    ("Madhya Pradesh", "MP"),
    ("Uttar Pradesh", "UP"),
    ("West Bengal", "WB"),
    ("Punjab", "PB"),
    ("Haryana", "HR"),
    ("Delhi", "DL"),
    ("Bihar", "BR"),
    ("Odisha", "OR"),
    ("Assam", "AS"),
    ("Himachal Pradesh", "HP"),
    ("Uttarakhand", "UK"),
    ("Goa", "GA"),
    ("Chhattisgarh", "CG"),
    ("Jharkhand", "JH"),
]

GUJARAT_DISTRICTS = [
    "Ahmedabad",
    "Vadodara",
    "Surat",
    "Rajkot",
    "Gandhinagar",
    "Bhavnagar",
    "Jamnagar",
    "Junagadh",
    "Anand",
    "Mehsana",
    "Bharuch",
    "Kutch",
]


def seed(session: Session) -> None:
    if not session.execute(select(T.PanelCostPerWatt).limit(1)).scalar_one_or_none():
        session.add(
            T.PanelCostPerWatt(cost_per_watt=45.0),
        )
    if not session.execute(select(T.InverterCostPerKw).limit(1)).scalar_one_or_none():
        session.add(T.InverterCostPerKw(cost_per_kw=12000.0))
    if not session.execute(select(T.BatteryCost).limit(1)).scalar_one_or_none():
        session.add(T.BatteryCost(cost_per_kwh=18000.0))
    if not session.execute(select(T.InstallationCost).limit(1)).scalar_one_or_none():
        session.add(
            T.InstallationCost(
                base_amount=15000.0,
                per_kw_amount=2500.0,
            )
        )
    if not session.execute(select(T.MiscCost).limit(1)).scalar_one_or_none():
        session.add(
            T.MiscCost(
                fixed_amount=5000.0,
                percent_of_subtotal=0.02,
            )
        )
    if not session.execute(select(T.EstimationSettings).limit(1)).scalar_one_or_none():
        session.add(
            T.EstimationSettings(
                rupees_per_unit_default=7.0,
                units_per_kw_per_month=135.0,
                min_system_kw=1.0,
                max_system_kw=15.0,
            )
        )
    for rt, mult, sfix, spkw in [
        ("RCC", 1.0, 0.0, 0.0),
        ("METAL", 1.04, 2000.0, 2000.0),
        ("GROUND", 0.98, 5000.0, 0.0),
    ]:
        exists = (
            session.execute(
                select(T.RoofTypePricing).where(T.RoofTypePricing.roof_type == rt)
            )
            .scalar_one_or_none()
        )
        if not exists:
            session.add(
                T.RoofTypePricing(
                    roof_type=rt,
                    cost_multiplier=mult,
                    structure_fixed=sfix,
                    structure_per_kw=spkw,
                )
            )

    st_map: dict[str, T.State] = {}
    for name, code in INDIAN_STATES:
        ex = (
            session.execute(select(T.State).where(T.State.name == name))
            .scalar_one_or_none()
        )
        if ex:
            st_map[name] = ex
        else:
            s = T.State(name=name, code=code)
            session.add(s)
            session.flush()
            st_map[name] = s

    gj = st_map.get("Gujarat")
    if gj:
        for d in GUJARAT_DISTRICTS:
            ex = (
                session.execute(
                    select(T.District).where(
                        T.District.state_id == gj.id, T.District.name == d
                    )
                )
                .scalar_one_or_none()
            )
            if not ex:
                session.add(T.District(state_id=gj.id, name=d))
        if not session.execute(
            select(T.StateSubsidy).where(T.StateSubsidy.state_id == gj.id).limit(1)
        ).scalar_one_or_none():
            session.add(
                T.StateSubsidy(
                    state_id=gj.id,
                    subsidy_type="fixed",
                    value=40000.0,
                    max_limit=40000.0,
                    is_active=True,
                )
            )
        if not session.execute(
            select(T.LocationPricing).where(
                T.LocationPricing.state_id == gj.id,
                T.LocationPricing.district_id.is_(None),
            )
        ).first():
            session.add(
                T.LocationPricing(
                    state_id=gj.id,
                    district_id=None,
                    system_cost_multiplier=1.0,
                    label="Gujarat (state default)",
                    is_active=True,
                )
            )

    if not session.execute(
        select(T.SiteSettings).where(T.SiteSettings.id == 1)
    ).scalar_one_or_none():
        session.add(
            T.SiteSettings(
                id=1,
                name="Tatsat NRGS",
                tagline="Potential Power Solutions",
                description=(
                    "Premium solar panel installation for homes and businesses across India. "
                    "Expert design, subsidy guidance, and long-term support from Gujarat."
                ),
                public_url="https://tatsat.vercel.app",
                phone_display="+91 98250 12345",
                phone_tel="+919825012345",
                whatsapp_digits="919825012345",
                email="hello@tatsatnrgs.com",
                hours="Mon–Sat: 9:00 AM – 7:00 PM IST",
                address_line1="C - 22, Dhanlaxmi Society",
                address_line2="Near L & T Circle, New Vip Road, Karelibaug",
                address_city="Vadodara",
                address_state="Gujarat",
                address_pin="390018",
                address_country="India",
                hero_headline="",
                hero_subtitle=(
                    "Solar solutions for homes & businesses — engineered for India's heat, dust, "
                    "and subsidy timelines."
                ),
                hero_cta_primary_label="Get free quote",
                hero_cta_primary_href="/quote",
                hero_cta_secondary_label="Call now",
                hero_footer_line=(
                    "Serving Ahmedabad, Gandhinagar, Vadodara, Surat & nearby districts"
                ),
                map_embed_url=(
                    "https://maps.google.com/maps?q=C-22+Dhanlaxmi+Society+New+Vip+Road+"
                    "Karelibaug+Vadodara+390018&z=15&ie=UTF8&iwloc=&output=embed"
                ),
                service_areas="Ahmedabad, Gandhinagar, Vadodara, Surat & nearby districts · Gujarat",
            )
        )

    if not session.execute(
        select(T.AdminUser).where(T.AdminUser.username == "admin")
    ).scalar_one_or_none():
        pw = os.environ.get("ADMIN_INITIAL_PASSWORD", "changeme")
        session.add(
            T.AdminUser(
                username="admin",
                password_hash=get_password_hash(pw),
                is_active=True,
            )
        )

    if not session.execute(select(T.CmsService).limit(1)).scalar_one_or_none():
        _services: list[tuple] = [
            (
                "residential",
                "Residential solar",
                "home",
                "Turnkey rooftop systems for apartments, bungalows, and farmhouses with "
                "subsidy-ready documentation for Gujarat DISCOMs.",
                [
                    "Right-sized inverter AC ratio for Indian summers",
                    "Bird netting and cable management that survives monsoon",
                    "Handover pack with warranties, SLD, and O&M schedule",
                ],
            ),
            (
                "commercial",
                "Commercial & industrial solar",
                "building",
                "Rooftop and elevated structures for factories, warehouses, cold chains, and "
                "institutions chasing demand-charge relief.",
                [
                    "Export credit modelling and TOU awareness baked into design",
                    "Safety plans aligned to factory shutdown windows",
                    "SCADA-ready monitoring integrations",
                ],
            ),
            (
                "maintenance",
                "Operations & maintenance",
                "wrench",
                "Protect your yield with scheduled visits, thermal imaging, and rapid inverter "
                "support across Ahmedabad and nearby districts.",
                [
                    "IV curve tracing on flagged strings",
                    "Soiling studies after dust storms",
                    "Spare inverter policy for critical sites",
                ],
            ),
            (
                "consultation",
                "Consultation & subsidy desk",
                "doc",
                "Independent feasibility, tender support, and step-by-step guidance for "
                "Gujarat’s rooftop programmes and central schemes.",
                [
                    "Bill disaggregation and future EV load planning",
                    "DISCOM application tracking with escalation paths",
                    "Vendor-neutral equipment shortlists",
                ],
            ),
        ]
        for i, (slug, title, icon, desc, benefits) in enumerate(_services):
            session.add(
                T.CmsService(
                    slug=slug,
                    title=title,
                    description=desc,
                    icon_name=icon,
                    price_label=None,
                    benefits_json=json.dumps(benefits, ensure_ascii=False),
                    sort_order=i,
                    is_active=True,
                )
            )

    if not session.execute(select(T.CmsProject).limit(1)).scalar_one_or_none():
        _projects = [
            (
                "Bungalow rooftop — Bodakdev",
                "Ahmedabad, Gujarat",
                10.12,
                "Representative residential installation.",
                "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=1200&q=80",
            ),
            (
                "Warehouse net-metered array — Changodar",
                "Ahmedabad district, Gujarat",
                180.0,
                "Industrial rooftop scale.",
                "https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?auto=format&fit=crop&w=1200&q=80",
            ),
            (
                "Farmhouse off-grid hybrid — Kheda",
                "Kheda, Gujarat",
                15.6,
                "Hybrid design reference.",
                "https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1200&q=80",
            ),
            (
                "Clinic rooftop — Satellite",
                "Ahmedabad, Gujarat",
                22.0,
                "Healthcare segment.",
                "https://images.unsplash.com/photo-1613665813446-82a78c468a1d?auto=format&fit=crop&w=1200&q=80",
            ),
            (
                "School canopy — Surat",
                "Surat, Gujarat",
                120.0,
                "Educational institution canopy.",
                "https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=1200&q=80",
            ),
            (
                "IT park carpark solar — Gift City",
                "Gandhinagar, Gujarat",
                640.0,
                "Large commercial reference.",
                "https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1200&q=80",
            ),
        ]
        for i, (title, loc, kw, desc, img) in enumerate(_projects):
            p = T.CmsProject(
                title=title,
                description=desc,
                location=loc,
                system_size_kw=kw,
                completion_date=None,
                sort_order=i,
            )
            session.add(p)
            session.flush()
            session.add(
                T.CmsProjectImage(
                    project_id=p.id,
                    path=img,
                    alt_text=title,
                    sort_order=0,
                )
            )


def main() -> None:
    with SessionLocal() as session:
        seed(session)
        session.commit()
        print("Seed complete. Admin login: username 'admin'")
        print("  Set ADMIN_INITIAL_PASSWORD in env before first run to choose password (default: changeme).")


if __name__ == "__main__":
    main()
