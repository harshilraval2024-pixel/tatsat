"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearAdminToken,
  downloadWithAuth,
  jfetch,
  notifyAdminAuthChanged,
  notifySiteConfigUpdated,
  setAdminToken,
} from "@/lib/nrgs-api";
import { useAdminSession } from "@/lib/use-admin-session";
import { CmsProjectsSection } from "@/components/admin/CmsProjectsSection";
import { CmsServicesSection } from "@/components/admin/CmsServicesSection";

type Tab = "site" | "projects" | "services" | "pricing" | "subsidy" | "location" | "leads";

type SiteSettingsApi = {
  name: string;
  tagline: string;
  description: string;
  url: string;
  phone_display: string;
  phone_tel: string;
  whatsapp: string;
  email: string;
  hours: string;
  address: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    pin: string;
    country: string;
  };
  hero_headline: string;
  hero_subtitle: string;
  hero_cta_primary_label: string;
  hero_cta_primary_href: string;
  hero_cta_secondary_label: string | null;
  hero_footer_line: string;
  map_embed_url: string;
  service_areas: string;
  social_facebook: string;
  social_instagram: string;
  social_linkedin: string;
  social_youtube: string;
};

function mapSiteSettingsFromApi(raw: Record<string, unknown>): SiteSettingsApi {
  const soc = (raw.social as Record<string, string> | undefined) ?? {};
  const addr = (raw.address as Record<string, string> | undefined) ?? {};
  return {
    name: String(raw.name ?? ""),
    tagline: String(raw.tagline ?? ""),
    description: String(raw.description ?? ""),
    url: String(raw.url ?? ""),
    phone_display: String(raw.phone_display ?? ""),
    phone_tel: String(raw.phone_tel ?? ""),
    whatsapp: String(raw.whatsapp ?? ""),
    email: String(raw.email ?? ""),
    hours: String(raw.hours ?? ""),
    address: {
      line1: String(addr.line1 ?? ""),
      line2: String(addr.line2 ?? ""),
      city: String(addr.city ?? ""),
      state: String(addr.state ?? ""),
      pin: String(addr.pin ?? ""),
      country: String(addr.country ?? ""),
    },
    hero_headline: String(raw.hero_headline ?? ""),
    hero_subtitle: String(raw.hero_subtitle ?? ""),
    hero_cta_primary_label: String(raw.hero_cta_primary_label ?? "Get free quote"),
    hero_cta_primary_href: String(raw.hero_cta_primary_href ?? "/quote"),
    hero_cta_secondary_label:
      raw.hero_cta_secondary_label === null || raw.hero_cta_secondary_label === undefined
        ? null
        : String(raw.hero_cta_secondary_label),
    hero_footer_line: String(raw.hero_footer_line ?? ""),
    map_embed_url: String(raw.map_embed_url ?? ""),
    service_areas: String(raw.service_areas ?? ""),
    social_facebook: String(soc.facebook ?? ""),
    social_instagram: String(soc.instagram ?? ""),
    social_linkedin: String(soc.linkedin ?? ""),
    social_youtube: String(soc.youtube ?? ""),
  };
}

type Pricing = {
  panel: { cost_per_watt: number };
  inverter: { cost_per_kw: number };
  battery: { cost_per_kwh: number };
  installation: { base_amount: number; per_kw_amount: number };
  misc: { fixed_amount: number; percent_of_subtotal: number };
  estimation: {
    rupees_per_unit_default: number;
    units_per_kw_per_month: number;
    min_system_kw: number;
    max_system_kw: number;
  };
  roof_types: {
    id: number;
    roof_type: string;
    cost_multiplier: number;
    structure_fixed: number;
    structure_per_kw: number;
  }[];
};

type SubRow = {
  id: number;
  state_id: number;
  state_name: string;
  subsidy_type: string;
  value: number;
  max_limit: number | null;
  is_active: boolean;
};

type LocRow = {
  id: number;
  state_id: number | null;
  district_id: number | null;
  system_cost_multiplier: number;
  state_name: string | null;
  district_name: string | null;
  is_active: boolean;
};

type Lead = {
  id: number;
  name: string | null;
  phone: string | null;
  state: string | null;
  district: string | null;
  system_size: string | null;
  system_size_kw: number | null;
  estimated_cost: number | null;
  created_at: string;
};

type State = { id: number; name: string };

const field =
  "focus-ring mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white";
const label = "text-xs font-semibold uppercase tracking-wide text-muted";
const th = "border-b border-white/10 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted";
const td = "border-b border-white/5 px-3 py-2 text-sm text-white/90";

export function AdminDashboard() {
  const authed = useAdminSession();
  const [tab, setTab] = useState<Tab>("site");
  const [err, setErr] = useState<string | null>(null);
  const [u, setU] = useState("");
  const [p, setP] = useState("");

  const [states, setStates] = useState<State[]>([]);
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [subsidies, setSubsidies] = useState<SubRow[]>([]);
  const [loc, setLoc] = useState<LocRow[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [siteSettings, setSiteSettings] = useState<SiteSettingsApi | null>(null);
  const [siteSaving, setSiteSaving] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  const [newSub, setNewSub] = useState({
    state_id: 1,
    subsidy_type: "fixed",
    value: 40000,
    max_limit: 40000 as number | null,
  });
  const [newLoc, setNewLoc] = useState({
    state_id: 0,
    system_cost_multiplier: 1.0,
  });

  const loadStates = useCallback(() => {
    jfetch<State[]>("/states", { auth: false }).then(setStates).catch(() => {});
  }, []);

  const loadPricing = useCallback(() => {
    jfetch<Pricing>("/admin/pricing")
      .then(setPricing)
      .catch((e) => setErr(String(e)));
  }, []);

  const loadSubsidies = useCallback(() => {
    jfetch<SubRow[]>("/admin/subsidy")
      .then(setSubsidies)
      .catch((e) => setErr(String(e)));
  }, []);

  const loadLocation = useCallback(() => {
    jfetch<LocRow[]>("/admin/location-pricing")
      .then(setLoc)
      .catch((e) => setErr(String(e)));
  }, []);

  const loadLeads = useCallback(() => {
    jfetch<Lead[]>("/admin/leads")
      .then(setLeads)
      .catch((e) => setErr(String(e)));
  }, []);

  const loadSiteSettings = useCallback(async () => {
    try {
      const raw = await jfetch<Record<string, unknown>>("/admin/site-settings");
      setSiteSettings(mapSiteSettingsFromApi(raw));
    } catch (e) {
      setErr(String(e));
    }
  }, []);

  useEffect(() => {
    loadStates();
  }, [loadStates]);

  useEffect(() => {
    if (!authed) return;
    if (tab === "site") loadSiteSettings();
    if (tab === "pricing") loadPricing();
    if (tab === "subsidy") {
      loadSubsidies();
      loadStates();
    }
    if (tab === "location") {
      loadLocation();
      loadStates();
    }
    if (tab === "leads") loadLeads();
  }, [tab, authed, loadSiteSettings, loadPricing, loadSubsidies, loadLocation, loadLeads, loadStates]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const r = await jfetch<{ access_token: string }>("/admin/login", {
        method: "POST",
        body: JSON.stringify({ username: u, password: p }),
        auth: false,
      });
      setAdminToken(r.access_token);
      notifyAdminAuthChanged();
      setTab("site");
    } catch (q) {
      setErr(String(q));
    }
  }

  async function savePricing(e: React.FormEvent) {
    e.preventDefault();
    if (!pricing) return;
    setErr(null);
    try {
      const next = await jfetch<Pricing>("/admin/pricing", {
        method: "POST",
        body: JSON.stringify({
          panel: pricing.panel,
          inverter: pricing.inverter,
          battery: pricing.battery,
          installation: pricing.installation,
          misc: pricing.misc,
          estimation: pricing.estimation,
          roof_types: pricing.roof_types,
        }),
      });
      setPricing(next);
    } catch (q) {
      setErr(String(q));
    }
  }

  async function addSubsidy(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const rows = await jfetch<SubRow[]>("/admin/subsidy", {
        method: "POST",
        body: JSON.stringify(newSub),
      });
      setSubsidies(rows);
    } catch (q) {
      setErr(String(q));
    }
  }

  async function addLocation(e: React.FormEvent) {
    e.preventDefault();
    if (!newLoc.state_id) {
      setErr("Pick a state");
      return;
    }
    setErr(null);
    try {
      const rows = await jfetch<LocRow[]>("/admin/location-pricing", {
        method: "POST",
        body: JSON.stringify({
          state_id: newLoc.state_id,
          system_cost_multiplier: newLoc.system_cost_multiplier,
        }),
      });
      setLoc(rows);
    } catch (q) {
      setErr(String(q));
    }
  }

  async function saveSite(e: React.FormEvent) {
    e.preventDefault();
    if (!siteSettings || siteSaving) return;
    setErr(null);
    setSiteSaving(true);
    try {
      await jfetch<Record<string, unknown>>("/admin/site-settings", {
        method: "PUT",
        body: JSON.stringify(siteSettings),
      });
      notifySiteConfigUpdated();
      await loadSiteSettings();
    } catch (q) {
      setErr(String(q));
    } finally {
      setSiteSaving(false);
    }
  }

  async function exportCsv() {
    const res = await downloadWithAuth("/export-leads");
    if (!res.ok) {
      setErr("Export failed");
      return;
    }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "leads.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function logout() {
    clearAdminToken();
    notifyAdminAuthChanged();
    setPricing(null);
    setSiteSettings(null);
  }

  if (!authed) {
    return (
      <div className="glass-panel mx-auto max-w-md rounded-3xl p-8">
        <h1 className="font-display text-2xl font-bold text-white">Staff dashboard</h1>
        <p className="mt-2 text-sm text-muted">Sign in to manage public site details, pricing, subsidies, and leads.</p>
        {err ? <p className="mt-4 text-sm text-accent">{err}</p> : null}
        <form onSubmit={login} className="mt-6 space-y-4">
          <div>
            <label className={label} htmlFor="adm-user">
              Username
            </label>
            <input id="adm-user" className={field} value={u} onChange={(e) => setU(e.target.value)} required autoComplete="username" />
          </div>
          <div>
            <label className={label} htmlFor="adm-pass">
              Password
            </label>
            <input
              id="adm-pass"
              type="password"
              className={field}
              value={p}
              onChange={(e) => setP(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            className="focus-ring w-full rounded-2xl bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wide text-bg"
          >
            Log in
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-bold text-white">Configuration</h1>
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["site", "Website"],
              ["projects", "Projects"],
              ["services", "Services"],
              ["pricing", "Pricing"],
              ["subsidy", "Subsidy"],
              ["location", "Location"],
              ["leads", "Leads"],
            ] as const
          ).map(([id, labelText]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide ${
                tab === id ? "bg-primary text-bg" : "border border-white/15 text-muted hover:text-white"
              }`}
            >
              {labelText}
            </button>
          ))}
          <div className="relative ml-auto">
            <button
              type="button"
              onClick={() => setProfileOpen((o) => !o)}
              className="flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white"
            >
              Account <span className="opacity-60">▾</span>
            </button>
            {profileOpen ? (
              <div className="absolute right-0 z-30 mt-2 min-w-[180px] rounded-2xl border border-white/15 bg-bg-elevated py-2 shadow-xl">
                <button
                  type="button"
                  className="block w-full px-4 py-2 text-left text-sm text-muted hover:bg-white/10 hover:text-white"
                  onClick={() => {
                    setProfileOpen(false);
                    setLogoutConfirm(true);
                  }}
                >
                  Log out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {logoutConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-bg-elevated p-6 shadow-2xl">
            <p className="font-display text-lg text-white">Sign out?</p>
            <p className="mt-2 text-sm text-muted">You will need to log in again to manage the site.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-full border border-white/20 px-4 py-2 text-sm text-muted hover:text-white"
                onClick={() => setLogoutConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-bg"
                onClick={() => {
                  logout();
                  setLogoutConfirm(false);
                  setProfileOpen(false);
                }}
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {err ? <p className="rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent">{err}</p> : null}

      <div className="glass-panel rounded-3xl p-6 sm:p-8">
        {tab === "site" && !siteSettings ? (
          <p className="text-sm text-muted">Loading site settings…</p>
        ) : null}
        {tab === "site" && siteSettings && (
          <form onSubmit={saveSite} className="space-y-6" aria-busy={siteSaving}>
            <div>
              <h2 className="font-display text-lg font-bold text-white">Public website & contact</h2>
              <p className="mt-2 text-sm text-muted">
                Shown across the marketing site (hero, footer, WhatsApp, quote page, contact).{" "}
                <strong className="text-white/80">Public URL</strong> should be your live domain (used for SEO metadata
                base).
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={label}>Company / brand name</label>
                <input
                  className={field}
                  value={siteSettings.name}
                  onChange={(e) => setSiteSettings({ ...siteSettings, name: e.target.value })}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>Tagline</label>
                <input
                  className={field}
                  value={siteSettings.tagline}
                  onChange={(e) => setSiteSettings({ ...siteSettings, tagline: e.target.value })}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>Short description (footer, meta)</label>
                <textarea
                  className={`${field} min-h-[100px] resize-y`}
                  value={siteSettings.description}
                  onChange={(e) => setSiteSettings({ ...siteSettings, description: e.target.value })}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>Public site URL (https://…)</label>
                <input
                  className={field}
                  type="url"
                  value={siteSettings.url}
                  onChange={(e) => setSiteSettings({ ...siteSettings, url: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className={label}>Phone (display)</label>
                <input
                  className={field}
                  value={siteSettings.phone_display}
                  onChange={(e) => setSiteSettings({ ...siteSettings, phone_display: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className={label}>Phone (tel: link, e.g. +9198…)</label>
                <input
                  className={field}
                  value={siteSettings.phone_tel}
                  onChange={(e) => setSiteSettings({ ...siteSettings, phone_tel: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className={label}>WhatsApp (digits only, e.g. 9198…)</label>
                <input
                  className={field}
                  value={siteSettings.whatsapp}
                  onChange={(e) => setSiteSettings({ ...siteSettings, whatsapp: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className={label}>Email</label>
                <input
                  className={field}
                  type="email"
                  value={siteSettings.email}
                  onChange={(e) => setSiteSettings({ ...siteSettings, email: e.target.value })}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>Business hours (display)</label>
                <input
                  className={field}
                  value={siteSettings.hours}
                  onChange={(e) => setSiteSettings({ ...siteSettings, hours: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-white">Studio address</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={label}>Line 1</label>
                  <input
                    className={field}
                    value={siteSettings.address.line1}
                    onChange={(e) =>
                      setSiteSettings({
                        ...siteSettings,
                        address: { ...siteSettings.address, line1: e.target.value },
                      })
                    }
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={label}>Line 2</label>
                  <input
                    className={field}
                    value={siteSettings.address.line2}
                    onChange={(e) =>
                      setSiteSettings({
                        ...siteSettings,
                        address: { ...siteSettings.address, line2: e.target.value },
                      })
                    }
                    required
                  />
                </div>
                <div>
                  <label className={label}>City</label>
                  <input
                    className={field}
                    value={siteSettings.address.city}
                    onChange={(e) =>
                      setSiteSettings({
                        ...siteSettings,
                        address: { ...siteSettings.address, city: e.target.value },
                      })
                    }
                    required
                  />
                </div>
                <div>
                  <label className={label}>State / region</label>
                  <input
                    className={field}
                    value={siteSettings.address.state}
                    onChange={(e) =>
                      setSiteSettings({
                        ...siteSettings,
                        address: { ...siteSettings.address, state: e.target.value },
                      })
                    }
                    required
                  />
                </div>
                <div>
                  <label className={label}>PIN / ZIP</label>
                  <input
                    className={field}
                    value={siteSettings.address.pin}
                    onChange={(e) =>
                      setSiteSettings({
                        ...siteSettings,
                        address: { ...siteSettings.address, pin: e.target.value },
                      })
                    }
                    required
                  />
                </div>
                <div>
                  <label className={label}>Country</label>
                  <input
                    className={field}
                    value={siteSettings.address.country}
                    onChange={(e) =>
                      setSiteSettings({
                        ...siteSettings,
                        address: { ...siteSettings.address, country: e.target.value },
                      })
                    }
                    required
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 pt-8">
              <h3 className="font-display text-base font-bold text-white">Homepage hero</h3>
              <p className="mt-2 text-sm text-muted">
                Leave headline empty to use the default animated title with company name.
              </p>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={label}>Hero headline (optional)</label>
                  <input
                    className={field}
                    value={siteSettings.hero_headline}
                    onChange={(e) => setSiteSettings({ ...siteSettings, hero_headline: e.target.value })}
                    placeholder="Override default title"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={label}>Hero subtitle</label>
                  <textarea
                    className={`${field} min-h-[80px]`}
                    value={siteSettings.hero_subtitle}
                    onChange={(e) => setSiteSettings({ ...siteSettings, hero_subtitle: e.target.value })}
                  />
                </div>
                <div>
                  <label className={label}>Primary CTA label</label>
                  <input
                    className={field}
                    value={siteSettings.hero_cta_primary_label}
                    onChange={(e) =>
                      setSiteSettings({ ...siteSettings, hero_cta_primary_label: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className={label}>Primary CTA link</label>
                  <input
                    className={field}
                    value={siteSettings.hero_cta_primary_href}
                    onChange={(e) =>
                      setSiteSettings({ ...siteSettings, hero_cta_primary_href: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className={label}>Secondary button label (call)</label>
                  <input
                    className={field}
                    value={siteSettings.hero_cta_secondary_label ?? ""}
                    onChange={(e) =>
                      setSiteSettings({
                        ...siteSettings,
                        hero_cta_secondary_label: e.target.value || null,
                      })
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={label}>Footnote under CTAs</label>
                  <input
                    className={field}
                    value={siteSettings.hero_footer_line}
                    onChange={(e) => setSiteSettings({ ...siteSettings, hero_footer_line: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 pt-8">
              <h3 className="font-display text-base font-bold text-white">Map & coverage</h3>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={label}>Google Maps embed URL</label>
                  <textarea
                    className={`${field} min-h-[72px] font-mono text-xs`}
                    value={siteSettings.map_embed_url}
                    onChange={(e) => setSiteSettings({ ...siteSettings, map_embed_url: e.target.value })}
                    placeholder="https://maps.google.com/maps?q=…&output=embed"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={label}>Service areas (projects / services intros)</label>
                  <textarea
                    className={`${field} min-h-[72px]`}
                    value={siteSettings.service_areas}
                    onChange={(e) => setSiteSettings({ ...siteSettings, service_areas: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 pt-8">
              <h3 className="font-display text-base font-bold text-white">Social media</h3>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <div>
                  <label className={label}>Facebook URL</label>
                  <input
                    className={field}
                    type="url"
                    value={siteSettings.social_facebook}
                    onChange={(e) => setSiteSettings({ ...siteSettings, social_facebook: e.target.value })}
                  />
                </div>
                <div>
                  <label className={label}>Instagram URL</label>
                  <input
                    className={field}
                    type="url"
                    value={siteSettings.social_instagram}
                    onChange={(e) => setSiteSettings({ ...siteSettings, social_instagram: e.target.value })}
                  />
                </div>
                <div>
                  <label className={label}>LinkedIn URL</label>
                  <input
                    className={field}
                    type="url"
                    value={siteSettings.social_linkedin}
                    onChange={(e) => setSiteSettings({ ...siteSettings, social_linkedin: e.target.value })}
                  />
                </div>
                <div>
                  <label className={label}>YouTube URL</label>
                  <input
                    className={field}
                    type="url"
                    value={siteSettings.social_youtube}
                    onChange={(e) => setSiteSettings({ ...siteSettings, social_youtube: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={siteSaving}
              className="focus-ring inline-flex min-h-[48px] min-w-[200px] items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wide text-bg disabled:cursor-not-allowed disabled:opacity-70"
            >
              {siteSaving ? (
                <>
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-bg border-t-transparent"
                    aria-hidden
                  />
                  Saving…
                </>
              ) : (
                "Save site & contact"
              )}
            </button>
          </form>
        )}
        {tab === "projects" && <CmsProjectsSection />}
        {tab === "services" && <CmsServicesSection />}
        {tab === "pricing" && !pricing ? (
          <p className="text-sm text-muted">Loading configuration…</p>
        ) : null}
        {tab === "pricing" && pricing && (
          <form onSubmit={savePricing} className="space-y-8">
            <h2 className="font-display text-lg font-bold text-white">Component & estimation settings</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className={label}>₹/W panel</label>
                <input
                  type="number"
                  step="0.01"
                  className={field}
                  value={pricing.panel.cost_per_watt}
                  onChange={(e) =>
                    setPricing({
                      ...pricing,
                      panel: { cost_per_watt: parseFloat(e.target.value) },
                    })
                  }
                />
              </div>
              <div>
                <label className={label}>₹/kW inverter</label>
                <input
                  type="number"
                  step="1"
                  className={field}
                  value={pricing.inverter.cost_per_kw}
                  onChange={(e) =>
                    setPricing({
                      ...pricing,
                      inverter: { cost_per_kw: parseFloat(e.target.value) },
                    })
                  }
                />
              </div>
              <div>
                <label className={label}>₹/kWh battery</label>
                <input
                  type="number"
                  step="1"
                  className={field}
                  value={pricing.battery.cost_per_kwh}
                  onChange={(e) =>
                    setPricing({
                      ...pricing,
                      battery: { cost_per_kwh: parseFloat(e.target.value) },
                    })
                  }
                />
              </div>
              <div>
                <label className={label}>Install base (₹)</label>
                <input
                  type="number"
                  className={field}
                  value={pricing.installation.base_amount}
                  onChange={(e) =>
                    setPricing({
                      ...pricing,
                      installation: {
                        ...pricing.installation,
                        base_amount: parseFloat(e.target.value),
                      },
                    })
                  }
                />
              </div>
              <div>
                <label className={label}>Install / kW (₹)</label>
                <input
                  type="number"
                  className={field}
                  value={pricing.installation.per_kw_amount}
                  onChange={(e) =>
                    setPricing({
                      ...pricing,
                      installation: {
                        ...pricing.installation,
                        per_kw_amount: parseFloat(e.target.value),
                      },
                    })
                  }
                />
              </div>
              <div>
                <label className={label}>Misc fixed (₹)</label>
                <input
                  type="number"
                  className={field}
                  value={pricing.misc.fixed_amount}
                  onChange={(e) =>
                    setPricing({
                      ...pricing,
                      misc: {
                        ...pricing.misc,
                        fixed_amount: parseFloat(e.target.value),
                      },
                    })
                  }
                />
              </div>
              <div>
                <label className={label}>Misc % of pre-misc</label>
                <input
                  type="number"
                  step="0.001"
                  className={field}
                  value={pricing.misc.percent_of_subtotal}
                  onChange={(e) =>
                    setPricing({
                      ...pricing,
                      misc: {
                        ...pricing.misc,
                        percent_of_subtotal: parseFloat(e.target.value),
                      },
                    })
                  }
                />
              </div>
              <div>
                <label className={label}>Default ₹/unit (bill→kWh)</label>
                <input
                  type="number"
                  step="0.1"
                  className={field}
                  value={pricing.estimation.rupees_per_unit_default}
                  onChange={(e) =>
                    setPricing({
                      ...pricing,
                      estimation: {
                        ...pricing.estimation,
                        rupees_per_unit_default: parseFloat(e.target.value),
                      },
                    })
                  }
                />
              </div>
              <div>
                <label className={label}>kWh / month per kW (sizing)</label>
                <input
                  type="number"
                  step="0.1"
                  className={field}
                  value={pricing.estimation.units_per_kw_per_month}
                  onChange={(e) =>
                    setPricing({
                      ...pricing,
                      estimation: {
                        ...pricing.estimation,
                        units_per_kw_per_month: parseFloat(e.target.value),
                      },
                    })
                  }
                />
              </div>
              <div>
                <label className={label}>Min kW</label>
                <input
                  type="number"
                  step="0.1"
                  className={field}
                  value={pricing.estimation.min_system_kw}
                  onChange={(e) =>
                    setPricing({
                      ...pricing,
                      estimation: {
                        ...pricing.estimation,
                        min_system_kw: parseFloat(e.target.value),
                      },
                    })
                  }
                />
              </div>
              <div>
                <label className={label}>Max kW</label>
                <input
                  type="number"
                  step="0.1"
                  className={field}
                  value={pricing.estimation.max_system_kw}
                  onChange={(e) =>
                    setPricing({
                      ...pricing,
                      estimation: {
                        ...pricing.estimation,
                        max_system_kw: parseFloat(e.target.value),
                      },
                    })
                  }
                />
              </div>
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-white">Roof types</h3>
              <div className="mt-4 space-y-6">
                {pricing.roof_types.map((r) => (
                  <div key={r.id} className="grid gap-4 border-t border-white/10 pt-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex items-end sm:col-span-2 lg:col-span-1">
                      <span className="font-semibold text-white">{r.roof_type}</span>
                    </div>
                    <div>
                      <label className={label}>× multiplier</label>
                      <input
                        type="number"
                        step="0.01"
                        className={field}
                        value={r.cost_multiplier}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          setPricing({
                            ...pricing,
                            roof_types: pricing.roof_types.map((x) =>
                              x.id === r.id ? { ...x, cost_multiplier: v } : x,
                            ),
                          });
                        }}
                      />
                    </div>
                    <div>
                      <label className={label}>Structure fixed</label>
                      <input
                        type="number"
                        className={field}
                        value={r.structure_fixed}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          setPricing({
                            ...pricing,
                            roof_types: pricing.roof_types.map((x) =>
                              x.id === r.id ? { ...x, structure_fixed: v } : x,
                            ),
                          });
                        }}
                      />
                    </div>
                    <div>
                      <label className={label}>Structure / kW</label>
                      <input
                        type="number"
                        className={field}
                        value={r.structure_per_kw}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          setPricing({
                            ...pricing,
                            roof_types: pricing.roof_types.map((x) =>
                              x.id === r.id ? { ...x, structure_per_kw: v } : x,
                            ),
                          });
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <button
              type="submit"
              className="focus-ring rounded-2xl bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wide text-bg"
            >
              Save
            </button>
          </form>
        )}

        {tab === "subsidy" && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-lg font-bold text-white">State subsidies</h2>
              <p className="mt-2 text-sm text-muted">
                Applied after the full system + misc pre-subsidy total. Latest active row per state is used in the public
                calculator.
              </p>
            </div>
            <form onSubmit={addSubsidy} className="grid gap-4 rounded-2xl border border-white/10 bg-black/20 p-5 sm:grid-cols-2">
              <div>
                <label className={label}>State</label>
                <select
                  className={field}
                  value={newSub.state_id}
                  onChange={(e) => setNewSub({ ...newSub, state_id: +e.target.value })}
                >
                  {states.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>Type</label>
                <select
                  className={field}
                  value={newSub.subsidy_type}
                  onChange={(e) => setNewSub({ ...newSub, subsidy_type: e.target.value })}
                >
                  <option value="fixed">Fixed (₹)</option>
                  <option value="percentage">Percentage</option>
                </select>
              </div>
              <div>
                <label className={label}>Value (₹ or %)</label>
                <input
                  type="number"
                  className={field}
                  value={newSub.value}
                  onChange={(e) => setNewSub({ ...newSub, value: +e.target.value })}
                />
              </div>
              <div>
                <label className={label}>Max cap (₹)</label>
                <input
                  type="number"
                  className={field}
                  value={newSub.max_limit ?? ""}
                  onChange={(e) =>
                    setNewSub({
                      ...newSub,
                      max_limit: e.target.value ? +e.target.value : null,
                    })
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="focus-ring rounded-2xl bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wide text-bg"
                >
                  Add record
                </button>
              </div>
            </form>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse">
                <thead>
                  <tr>
                    <th className={th}>ID</th>
                    <th className={th}>State</th>
                    <th className={th}>Type</th>
                    <th className={th}>Value</th>
                    <th className={th}>Max</th>
                  </tr>
                </thead>
                <tbody>
                  {subsidies.map((s) => (
                    <tr key={s.id}>
                      <td className={td}>{s.id}</td>
                      <td className={td}>{s.state_name}</td>
                      <td className={td}>{s.subsidy_type}</td>
                      <td className={td}>{s.value}</td>
                      <td className={td}>{s.max_limit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "location" && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-lg font-bold text-white">Location multipliers</h2>
              <p className="mt-2 text-sm text-muted">
                Multiplied against system subtotal (hardware + installation) before misc. More specific (district) beats
                state default.
              </p>
            </div>
            <form onSubmit={addLocation} className="grid gap-4 rounded-2xl border border-white/10 bg-black/20 p-5 sm:grid-cols-2">
              <div>
                <label className={label}>State</label>
                <select
                  className={field}
                  value={newLoc.state_id || ""}
                  onChange={(e) => setNewLoc({ ...newLoc, state_id: +e.target.value })}
                >
                  <option value="">—</option>
                  {states.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>× multiplier</label>
                <input
                  type="number"
                  step="0.01"
                  className={field}
                  value={newLoc.system_cost_multiplier}
                  onChange={(e) =>
                    setNewLoc({
                      ...newLoc,
                      system_cost_multiplier: +e.target.value,
                    })
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="focus-ring rounded-2xl bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wide text-bg"
                >
                  Add
                </button>
              </div>
            </form>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse">
                <thead>
                  <tr>
                    <th className={th}>ID</th>
                    <th className={th}>State</th>
                    <th className={th}>District</th>
                    <th className={th}>×</th>
                  </tr>
                </thead>
                <tbody>
                  {loc.map((x) => (
                    <tr key={x.id}>
                      <td className={td}>{x.id}</td>
                      <td className={td}>{x.state_name}</td>
                      <td className={td}>{x.district_name}</td>
                      <td className={td}>{x.system_cost_multiplier}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "leads" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-lg font-bold text-white">Leads</h2>
              <button
                type="button"
                onClick={exportCsv}
                className="focus-ring rounded-full bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wide text-bg"
              >
                Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse">
                <thead>
                  <tr>
                    <th className={th}>When</th>
                    <th className={th}>Name</th>
                    <th className={th}>Phone</th>
                    <th className={th}>State</th>
                    <th className={th}>Size</th>
                    <th className={th}>₹</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.id}>
                      <td className={td}>{new Date(l.created_at).toLocaleString()}</td>
                      <td className={td}>{l.name}</td>
                      <td className={td}>{l.phone}</td>
                      <td className={td}>{l.state}</td>
                      <td className={td}>{l.system_size}</td>
                      <td className={td}>{l.estimated_cost?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
