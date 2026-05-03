from sqlalchemy.ext.asyncio import AsyncSession

from app.models import tables as T
from app.schemas.site_settings import (
    SiteAddressOut,
    SiteSettingsOut,
    SiteSettingsUpdate,
    SocialLinksOut,
)


def site_settings_to_out(row: T.SiteSettings) -> SiteSettingsOut:
    return SiteSettingsOut(
        name=row.name,
        tagline=row.tagline,
        description=row.description,
        url=row.public_url,
        phone_display=row.phone_display,
        phone_tel=row.phone_tel,
        whatsapp=row.whatsapp_digits,
        email=row.email,
        hours=row.hours,
        address=SiteAddressOut(
            line1=row.address_line1,
            line2=row.address_line2,
            city=row.address_city,
            state=row.address_state,
            pin=row.address_pin,
            country=row.address_country,
        ),
        hero_headline=getattr(row, "hero_headline", "") or "",
        hero_subtitle=getattr(row, "hero_subtitle", "") or "",
        hero_cta_primary_label=getattr(row, "hero_cta_primary_label", None) or "Get free quote",
        hero_cta_primary_href=getattr(row, "hero_cta_primary_href", None) or "/quote",
        hero_cta_secondary_label=getattr(row, "hero_cta_secondary_label", None),
        hero_footer_line=getattr(row, "hero_footer_line", "") or "",
        map_embed_url=getattr(row, "map_embed_url", "") or "",
        service_areas=getattr(row, "service_areas", "") or "",
        social=SocialLinksOut(
            facebook=getattr(row, "social_facebook", "") or "",
            instagram=getattr(row, "social_instagram", "") or "",
            linkedin=getattr(row, "social_linkedin", "") or "",
            youtube=getattr(row, "social_youtube", "") or "",
        ),
    )


async def get_site_settings_row(session: AsyncSession) -> T.SiteSettings | None:
    return await session.get(T.SiteSettings, 1)


def apply_site_settings_update(row: T.SiteSettings, body: SiteSettingsUpdate) -> None:
    row.name = body.name
    row.tagline = body.tagline
    row.description = body.description
    row.public_url = body.url
    row.phone_display = body.phone_display
    row.phone_tel = body.phone_tel
    row.whatsapp_digits = body.whatsapp
    row.email = body.email
    row.hours = body.hours
    row.address_line1 = body.address.line1
    row.address_line2 = body.address.line2
    row.address_city = body.address.city
    row.address_state = body.address.state
    row.address_pin = body.address.pin
    row.address_country = body.address.country
    row.hero_headline = body.hero_headline
    row.hero_subtitle = body.hero_subtitle
    row.hero_cta_primary_label = body.hero_cta_primary_label
    row.hero_cta_primary_href = body.hero_cta_primary_href
    row.hero_cta_secondary_label = body.hero_cta_secondary_label
    row.hero_footer_line = body.hero_footer_line
    row.map_embed_url = body.map_embed_url
    row.service_areas = body.service_areas
    row.social_facebook = body.social_facebook
    row.social_instagram = body.social_instagram
    row.social_linkedin = body.social_linkedin
    row.social_youtube = body.social_youtube
