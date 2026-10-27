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

/** Editable copy for the Contact page and its WhatsApp card (Admin → Site settings). */
export type ContactContent = {
  page_eyebrow: string;
  page_title: string;
  page_subtitle: string;
  card_title: string;
  card_subtitle: string;
  topics_label: string;
  topics: string[];
  name_label: string;
  name_placeholder: string;
  note_label: string;
  note_placeholder: string;
  button_label: string;
  message_template: string;
  advisor_greeting: string;
  call_prompt: string;
  call_text: string;
  email_text: string;
};

export const defaultContactContent: ContactContent = {
  page_eyebrow: "Visit / call",
  page_title: "We\u2019re easy to reach from Gift City to Surat",
  page_subtitle: "Walk-ins by appointment \u2014 bring recent bills and roof photos if you can.",
  card_title: "Chat with us on WhatsApp",
  card_subtitle: "The fastest way to reach us \u2014 pick a topic and we\u2019ll reply on WhatsApp.",
  topics_label: "What do you need?",
  topics: ["Free solar quote", "Subsidy information", "Rooftop site visit", "Talk to an engineer"],
  name_label: "Your name (optional)",
  name_placeholder: "e.g. Ravi Patel",
  note_label: "Short note (optional)",
  note_placeholder: "City, roof type, monthly bill\u2026",
  button_label: "Start WhatsApp chat",
  message_template: "Hi {business},\nI\u2019m {name}.\nI\u2019d like help with: {topic}.\n{note}",
  advisor_greeting:
    "Hi! I’m the Solar Advisor. Tell me your monthly bill and city and I’ll size a system and estimate the subsidy.",
  call_prompt: "Prefer a call?",
  call_text: "Call {phone}",
  email_text: "Email us",
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
  /** Public site colour theme, chosen in the admin dashboard. */
  theme: "dark" | "light";
  mapEmbedUrl: string;
  serviceAreas: string;
  social: SiteSocial;
  contact: ContactContent;
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
  theme: "dark",
  mapEmbedUrl: "",
  serviceAreas: "Ahmedabad, Gandhinagar, Vadodara, Surat & nearby districts · Gujarat",
  social: { facebook: "", instagram: "", linkedin: "", youtube: "" },
  contact: { ...defaultContactContent, topics: [...defaultContactContent.topics] },
};

export function getDefaultSiteConfig(): SiteConfig {
  return {
    ...defaults,
    address: { ...defaults.address },
    contact: { ...defaults.contact, topics: [...defaults.contact.topics] },
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
  theme?: string;
  contact?: Partial<ContactContent>;
  map_embed_url?: string;
  service_areas?: string;
  social?: ApiSocial;
};

export function mergeContact(api: Partial<ContactContent> | undefined | null): ContactContent {
  const base = defaultContactContent;
  const c = api && typeof api === "object" ? api : {};
  const str = (v: unknown, d: string) => (typeof v === "string" ? v : d);
  const topics = Array.isArray(c.topics)
    ? c.topics.filter((t): t is string => typeof t === "string" && t.trim() !== "")
    : [];
  return {
    page_eyebrow: str(c.page_eyebrow, base.page_eyebrow),
    page_title: str(c.page_title, base.page_title),
    page_subtitle: str(c.page_subtitle, base.page_subtitle),
    card_title: str(c.card_title, base.card_title),
    card_subtitle: str(c.card_subtitle, base.card_subtitle),
    topics_label: str(c.topics_label, base.topics_label),
    topics: topics.length ? topics : [...base.topics],
    name_label: str(c.name_label, base.name_label),
    name_placeholder: str(c.name_placeholder, base.name_placeholder),
    note_label: str(c.note_label, base.note_label),
    note_placeholder: str(c.note_placeholder, base.note_placeholder),
    button_label: str(c.button_label, base.button_label),
    message_template: str(c.message_template, base.message_template),
    advisor_greeting: str(c.advisor_greeting, base.advisor_greeting),
    call_prompt: str(c.call_prompt, base.call_prompt),
    call_text: str(c.call_text, base.call_text),
    email_text: str(c.email_text, base.email_text),
  };
}

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
    theme: api.theme === "light" ? "light" : "dark",
    contact: mergeContact(api.contact),
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
    cfg.theme,
    JSON.stringify(cfg.contact),
  ].join("|");
}
