from typing import Literal

from pydantic import BaseModel, Field, field_validator


class SiteAddressOut(BaseModel):
    line1: str
    line2: str
    city: str
    state: str
    pin: str
    country: str


class SocialLinksOut(BaseModel):
    facebook: str = ""
    instagram: str = ""
    linkedin: str = ""
    youtube: str = ""


class ContactContent(BaseModel):
    """Editable copy for the Contact page and its WhatsApp card."""

    page_eyebrow: str = Field("Visit / call", max_length=80)
    page_title: str = Field("We\u2019re easy to reach from Gift City to Surat", max_length=200)
    page_subtitle: str = Field(
        "Walk-ins by appointment \u2014 bring recent bills and roof photos if you can.",
        max_length=400,
    )
    card_title: str = Field("Chat with us on WhatsApp", max_length=120)
    card_subtitle: str = Field(
        "The fastest way to reach us \u2014 pick a topic and we\u2019ll reply on WhatsApp.",
        max_length=300,
    )
    topics_label: str = Field("What do you need?", max_length=80)
    topics: list[str] = Field(
        default_factory=lambda: [
            "Free solar quote",
            "Subsidy information",
            "Rooftop site visit",
            "Talk to an engineer",
        ],
        max_length=8,
    )
    name_label: str = Field("Your name (optional)", max_length=80)
    name_placeholder: str = Field("e.g. Ravi Patel", max_length=80)
    note_label: str = Field("Short note (optional)", max_length=80)
    note_placeholder: str = Field("City, roof type, monthly bill\u2026", max_length=120)
    button_label: str = Field("Start WhatsApp chat", max_length=60)
    message_template: str = Field(
        "Hi {business},\nI\u2019m {name}.\nI\u2019d like help with: {topic}.\n{note}",
        max_length=600,
        description="Placeholders: {business} {name} {topic} {note}. Lines with an empty value are dropped.",
    )
    call_prompt: str = Field("Prefer a call?", max_length=80)
    call_text: str = Field("Call {phone}", max_length=80)
    email_text: str = Field("Email us", max_length=80)

    @field_validator("topics")
    @classmethod
    def _clean_topics(cls, v: list[str]) -> list[str]:
        out = [t.strip()[:60] for t in v if t and t.strip()]
        return out or ["Free solar quote"]


class SiteSettingsOut(BaseModel):
    """Public + admin read shape (matches Next.js `SiteConfig`)."""

    name: str
    tagline: str
    description: str
    url: str = Field(..., description="Canonical public site URL (metadata / OG)")
    phone_display: str
    phone_tel: str = Field(..., description="tel: link, e.g. +9198...")
    whatsapp: str = Field(..., description="Digits only for wa.me, e.g. 9198...")
    email: str
    hours: str
    address: SiteAddressOut
    hero_headline: str = ""
    hero_subtitle: str = ""
    hero_cta_primary_label: str = "Get free quote"
    hero_cta_primary_href: str = "/quote"
    hero_cta_secondary_label: str | None = None
    hero_footer_line: str = ""
    map_embed_url: str = ""
    service_areas: str = ""
    social: SocialLinksOut = Field(default_factory=SocialLinksOut)
    theme: Literal["dark", "light"] = "dark"
    contact: ContactContent = Field(default_factory=ContactContent)


class SiteSettingsUpdate(BaseModel):
    """Admin replaces all public-facing branding / contact fields + CMS hero blocks."""

    name: str = Field(..., min_length=1, max_length=200)
    tagline: str = Field(..., max_length=300)
    description: str = Field(..., max_length=4000)
    url: str = Field(..., max_length=500)
    phone_display: str = Field(..., max_length=80)
    phone_tel: str = Field(..., max_length=40)
    whatsapp: str = Field(..., max_length=20)
    email: str = Field(..., max_length=200)
    hours: str = Field(..., max_length=300)
    address: SiteAddressOut
    hero_headline: str = Field("", max_length=800)
    hero_subtitle: str = Field("", max_length=2000)
    hero_cta_primary_label: str = Field("Get free quote", max_length=80)
    hero_cta_primary_href: str = Field("/quote", max_length=500)
    hero_cta_secondary_label: str | None = Field(None, max_length=80)
    hero_footer_line: str = Field("", max_length=2000)
    map_embed_url: str = Field("", max_length=8000)
    service_areas: str = Field("", max_length=4000)
    social_facebook: str = Field("", max_length=500)
    social_instagram: str = Field("", max_length=500)
    social_linkedin: str = Field("", max_length=500)
    social_youtube: str = Field("", max_length=500)
    theme: Literal["dark", "light"] = "dark"
    contact: ContactContent = Field(default_factory=ContactContent)
