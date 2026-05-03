import { site } from "@/lib/site";

export type SiteAddress = {
  line1: string;
  line2: string;
  city: string;
  state: string;
  pin: string;
  country: string;
};

/** Merged branding + contact used across the Next.js app (from API + static fallbacks). */
export type SiteSocial = {
  facebook: string;
  instagram: string;
  linkedin: string;
  youtube: string;
};

/** Merged branding + contact + CMS hero / map / social (from API + static fallbacks). */
export type SiteConfig = {
  name: string;
  tagline: string;
  description: string;
  url: string;
  phoneDisplay: string;
  phoneTel: string;
  whatsapp: string;
  email: string;
  address: SiteAddress;
  hours: string;
  heroHeadline: string;
  heroSubtitle: string;
  heroCtaPrimaryLabel: string;
  heroCtaPrimaryHref: string;
  heroCtaSecondaryLabel: string | null;
  heroFooterLine: string;
  mapEmbedUrl: string;
  serviceAreas: string;
  social: SiteSocial;
};

const defaults: SiteConfig = {
  name: site.name,
  tagline: site.tagline,
  description: site.description,
  url: site.url,
  phoneDisplay: site.phoneDisplay,
  phoneTel: site.phoneTel,
  whatsapp: site.whatsapp,
  email: site.email,
  hours: site.hours,
  address: {
    line1: site.address.line1,
    line2: site.address.line2,
    city: site.address.city,
    state: site.address.state,
    pin: site.address.pin,
    country: site.address.country,
  },
  heroHeadline: "",
  heroSubtitle:
    "Solar solutions for homes & businesses — engineered for India's heat, dust, and subsidy timelines.",
  heroCtaPrimaryLabel: "Get free quote",
  heroCtaPrimaryHref: "/quote",
  heroCtaSecondaryLabel: "Call now",
  heroFooterLine: "Serving Ahmedabad, Gandhinagar, Vadodara, Surat & nearby districts",
  mapEmbedUrl: "",
  serviceAreas: "Ahmedabad, Gandhinagar, Vadodara, Surat & nearby districts · Gujarat",
  social: { facebook: "", instagram: "", linkedin: "", youtube: "" },
};

export function getDefaultSiteConfig(): SiteConfig {
  return {
    ...defaults,
    address: { ...defaults.address },
  };
}

type ApiAddr = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pin?: string;
  country?: string;
};

type ApiSocial = {
  facebook?: string;
  instagram?: string;
  linkedin?: string;
  youtube?: string;
};

type ApiSiteSettings = {
  name?: string;
  tagline?: string;
  description?: string;
  url?: string;
  phone_display?: string;
  phone_tel?: string;
  whatsapp?: string;
  email?: string;
  hours?: string;
  address?: ApiAddr;
  hero_headline?: string;
  hero_subtitle?: string;
  hero_cta_primary_label?: string;
  hero_cta_primary_href?: string;
  hero_cta_secondary_label?: string | null;
  hero_footer_line?: string;
  map_embed_url?: string;
  service_areas?: string;
  social?: ApiSocial;
};

/** Map FastAPI `SiteSettingsOut` (snake_case) into `SiteConfig`. */
export function mergeSiteConfigFromApi(api: ApiSiteSettings | null | undefined): SiteConfig {
  if (!api || typeof api !== "object") {
    return getDefaultSiteConfig();
  }
  const a = api.address ?? {};
  const soc = api.social ?? {};
  return {
    name: api.name ?? defaults.name,
    tagline: api.tagline ?? defaults.tagline,
    description: api.description ?? defaults.description,
    url: api.url ?? defaults.url,
    phoneDisplay: api.phone_display ?? defaults.phoneDisplay,
    phoneTel: api.phone_tel ?? defaults.phoneTel,
    whatsapp: api.whatsapp ?? defaults.whatsapp,
    email: api.email ?? defaults.email,
    hours: api.hours ?? defaults.hours,
    address: {
      line1: a.line1 ?? defaults.address.line1,
      line2: a.line2 ?? defaults.address.line2,
      city: a.city ?? defaults.address.city,
      state: a.state ?? defaults.address.state,
      pin: a.pin ?? defaults.address.pin,
      country: a.country ?? defaults.address.country,
    },
    heroHeadline: api.hero_headline ?? defaults.heroHeadline,
    heroSubtitle: api.hero_subtitle ?? defaults.heroSubtitle,
    heroCtaPrimaryLabel: api.hero_cta_primary_label ?? defaults.heroCtaPrimaryLabel,
    heroCtaPrimaryHref: api.hero_cta_primary_href ?? defaults.heroCtaPrimaryHref,
    heroCtaSecondaryLabel:
      api.hero_cta_secondary_label !== undefined
        ? api.hero_cta_secondary_label
        : defaults.heroCtaSecondaryLabel,
    heroFooterLine: api.hero_footer_line ?? defaults.heroFooterLine,
    mapEmbedUrl: api.map_embed_url ?? defaults.mapEmbedUrl,
    serviceAreas: api.service_areas ?? defaults.serviceAreas,
    social: {
      facebook: soc.facebook ?? defaults.social.facebook,
      instagram: soc.instagram ?? defaults.social.instagram,
      linkedin: soc.linkedin ?? defaults.social.linkedin,
      youtube: soc.youtube ?? defaults.social.youtube,
    },
  };
}

/** Stable key so SiteConfigProvider remounts when the server sends updated branding. */
export function siteConfigProviderKey(cfg: SiteConfig): string {
  return [
    cfg.name,
    cfg.url,
    cfg.tagline,
    cfg.phoneTel,
    cfg.phoneDisplay,
    cfg.email,
    cfg.whatsapp,
    cfg.hours,
    cfg.address.line1,
    cfg.address.pin,
    cfg.heroHeadline,
    cfg.mapEmbedUrl,
    cfg.heroFooterLine,
  ].join("|");
}
