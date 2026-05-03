from pydantic import BaseModel, Field


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
