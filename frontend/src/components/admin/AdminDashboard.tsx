"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
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
import { useConfirm } from "@/components/admin/useConfirm";
import { defaultContactContent, mergeContact, type ContactContent } from "@/lib/site-config";

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
  theme: "dark" | "light";
  contact: ContactContent;
};

type SiteSectionId = "brand" | "address" | "hero" | "theme" | "contact" | "map" | "social";

/** Each section is its own form and only writes these fields. */
const SITE_SECTIONS: Record<SiteSectionId, { keys: (keyof SiteSettingsApi)[]; title: string; message: string; button: string }> = {
  brand: {
    keys: ["name", "tagline", "description", "url", "phone_display", "phone_tel", "whatsapp", "email", "hours"],
    title: "Save company & contact details?",
    message: "Name, phone, WhatsApp number, email and hours change across the whole website.",
    button: "Save company & contact",
  },
  address: {
    keys: ["address"],
    title: "Save the studio address?",
    message: "The address shown on the Contact page and in the footer will be updated.",
    button: "Save address",
  },
  hero: {
    keys: [
      "hero_headline",
      "hero_subtitle",
      "hero_cta_primary_label",
      "hero_cta_primary_href",
      "hero_cta_secondary_label",
      "hero_footer_line",
    ],
    title: "Publish homepage hero changes?",
    message: "The headline, subtitle and buttons on the home page will be updated.",
    button: "Save homepage hero",
  },
  theme: {
    keys: ["theme"],
    title: "Change the website theme?",
    message: "Every page will switch to the selected theme for all visitors.",
    button: "Save theme",
  },
  contact: {
    keys: ["contact"],
    title: "Save the contact page & WhatsApp card?",
    message: "The Contact page text and WhatsApp topics will be updated for visitors.",
    button: "Save contact page",
  },
  map: {
    keys: ["map_embed_url", "service_areas"],
    title: "Save map & coverage?",
    message: "The map on the Contact page and the service-areas text will be updated.",
    button: "Save map & coverage",
  },
  social: {
    keys: ["social_facebook", "social_instagram", "social_linkedin", "social_youtube"],
    title: "Save social media links?",
    message: "The social links in the website footer will be updated.",
    button: "Save social links",
  },
};

function SectionSave({ busy, dirty, label }: { busy: boolean; dirty: boolean; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-5">
      <button
        type="submit"
        disabled={busy || !dirty}
        className="focus-ring inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-bg disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-bg border-t-transparent" aria-hidden />
            Saving…
          </>
        ) : (
          label
        )}
      </button>
      <span className={`text-xs ${dirty ? "text-primary" : "text-muted"}`}>
        {dirty ? "Unsaved changes" : "All changes saved"}
      </span>
    </div>
  );
}

function sectionCard(extra = "") {
  return `space-y-6 rounded-3xl border border-white/10 bg-black/10 p-5 sm:p-6 ${extra}`;
}

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
    theme: raw.theme === "light" ? "light" : "dark",
    contact: mergeContact(raw.contact as Partial<ContactContent> | undefined),
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
  const [siteSaved, setSiteSaved] = useState<SiteSettingsApi | null>(null);
  const [pricingSaved, setPricingSaved] = useState<Pricing | null>(null);
  const [pricingSaving, setPricingSaving] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const { confirm: askConfirm, dialog: confirmDialog } = useConfirm();

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
      .then((p) => {
        setPricing(p);
        setPricingSaved(p);
      })
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
      const mapped = mapSiteSettingsFromApi(raw);
      setSiteSettings(mapped);
      setSiteSaved(mapped);
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
      setErr(q instanceof Error ? q.message : String(q));
    }
  }

  type PricingGroup = "components" | "installation" | "misc" | "estimation" | "roof";
  const PRICING_GROUPS: Record<PricingGroup, { keys: (keyof Pricing)[]; title: string; message: string; button: string }> = {
    components: {
      keys: ["panel", "inverter", "battery"],
      title: "Save component prices?",
      message: "Panel, inverter and battery prices apply immediately to every estimate.",
      button: "Save component prices",
    },
    installation: {
      keys: ["installation"],
      title: "Save installation pricing?",
      message: "Installation charges apply immediately to every estimate.",
      button: "Save installation pricing",
    },
    misc: {
      keys: ["misc"],
      title: "Save miscellaneous costs?",
      message: "Miscellaneous charges apply immediately to every estimate.",
      button: "Save miscellaneous costs",
    },
    estimation: {
      keys: ["estimation"],
      title: "Save estimation settings?",
      message: "System-size rules and the default ₹/unit change every estimate.",
      button: "Save estimation settings",
    },
    roof: {
      keys: ["roof_types"],
      title: "Save roof type pricing?",
      message: "Roof multipliers and structure costs apply immediately to every estimate.",
      button: "Save roof pricing",
    },
  };

  function pricingGroupDirty(g: PricingGroup): boolean {
    if (!pricing || !pricingSaved) return false;
    return PRICING_GROUPS[g].keys.some(
      (k) => JSON.stringify(pricing[k]) !== JSON.stringify(pricingSaved[k]),
    );
  }

  async function savePricingGroup(e: React.FormEvent, g: PricingGroup) {
    e.preventDefault();
    if (!pricing || pricingSaving) return;
    const grp = PRICING_GROUPS[g];
    if (!(await askConfirm({ title: grp.title, message: grp.message, confirmLabel: grp.button }))) return;
    setErr(null);
    setPricingSaving(true);
    try {
      // The API merges per-group, so only this group's values are sent.
      const body: Record<string, unknown> = {};
      for (const k of grp.keys) body[k] = pricing[k];
      const next = await jfetch<Pricing>("/admin/pricing", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setPricingSaved(next);
      setPricing((cur) => {
        if (!cur) return next;
        const merged: Record<string, unknown> = { ...cur };
        for (const k of grp.keys) merged[k] = next[k];
        return merged as Pricing;
      });
      toast.success("Saved.");
    } catch (q) {
      setErr(String(q));
    } finally {
      setPricingSaving(false);
    }
  }

  async function addSubsidy(e: React.FormEvent) {
    e.preventDefault();
    if (
      !(await askConfirm({
        title: "Add this subsidy?",
        message: "It will change the subsidy applied to customer estimates for that state.",
        confirmLabel: "Add subsidy",
      }))
    )
      return;
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

  const [editSub, setEditSub] = useState<SubRow | null>(null);
  const [editLoc, setEditLoc] = useState<LocRow | null>(null);

  async function saveSubsidyEdit() {
    if (!editSub) return;
    if (
      !(await askConfirm({
        title: "Save this subsidy?",
        message: `${editSub.state_name}: the new rule applies to customer estimates immediately.`,
        confirmLabel: "Save subsidy",
      }))
    )
      return;
    setErr(null);
    try {
      const rows = await jfetch<SubRow[]>(`/admin/subsidy/${editSub.id}`, {
        method: "PUT",
        body: JSON.stringify({
          subsidy_type: editSub.subsidy_type,
          value: editSub.value,
          max_limit: editSub.max_limit,
          is_active: editSub.is_active,
        }),
      });
      setSubsidies(rows);
      setEditSub(null);
      toast.success("Subsidy updated.");
    } catch (q) {
      setErr(q instanceof Error ? q.message : String(q));
    }
  }

  async function deleteSubsidy(s: SubRow) {
    if (
      !(await askConfirm({
        title: "Delete this subsidy?",
        message: `${s.state_name} (${s.subsidy_type} ${s.value}) will be removed permanently. This cannot be undone.`,
        confirmLabel: "Delete subsidy",
        danger: true,
      }))
    )
      return;
    setErr(null);
    try {
      setSubsidies(await jfetch<SubRow[]>(`/admin/subsidy/${s.id}`, { method: "DELETE" }));
      if (editSub?.id === s.id) setEditSub(null);
      toast.success("Subsidy deleted.");
    } catch (q) {
      setErr(q instanceof Error ? q.message : String(q));
    }
  }

  async function saveLocationEdit() {
    if (!editLoc) return;
    if (
      !(await askConfirm({
        title: "Save this multiplier?",
        message: `${editLoc.district_name || editLoc.state_name || "Location"}: the new multiplier applies to estimates immediately.`,
        confirmLabel: "Save multiplier",
      }))
    )
      return;
    setErr(null);
    try {
      const rows = await jfetch<LocRow[]>(`/admin/location-pricing/${editLoc.id}`, {
        method: "PUT",
        body: JSON.stringify({
          system_cost_multiplier: editLoc.system_cost_multiplier,
          is_active: editLoc.is_active,
        }),
      });
      setLoc(rows);
      setEditLoc(null);
      toast.success("Multiplier updated.");
    } catch (q) {
      setErr(q instanceof Error ? q.message : String(q));
    }
  }

  async function deleteLocation(x: LocRow) {
    if (
      !(await askConfirm({
        title: "Delete this multiplier?",
        message: `${x.district_name || x.state_name || "Location"} (\u00d7${x.system_cost_multiplier}) will be removed permanently. This cannot be undone.`,
        confirmLabel: "Delete multiplier",
        danger: true,
      }))
    )
      return;
    setErr(null);
    try {
      setLoc(await jfetch<LocRow[]>(`/admin/location-pricing/${x.id}`, { method: "DELETE" }));
      if (editLoc?.id === x.id) setEditLoc(null);
      toast.success("Multiplier deleted.");
    } catch (q) {
      setErr(q instanceof Error ? q.message : String(q));
    }
  }

  async function addLocation(e: React.FormEvent) {
    e.preventDefault();
    if (!newLoc.state_id) {
      setErr("Pick a state");
      return;
    }
    if (
      !(await askConfirm({
        title: "Add this location pricing?",
        message: "It will change the system cost multiplier used in estimates for that location.",
        confirmLabel: "Add location pricing",
      }))
    )
      return;
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

  function siteSectionDirty(id: SiteSectionId): boolean {
    if (!siteSettings || !siteSaved) return false;
    return SITE_SECTIONS[id].keys.some(
      (k) => JSON.stringify(siteSettings[k]) !== JSON.stringify(siteSaved[k]),
    );
  }

  async function saveSiteSection(e: React.FormEvent, id: SiteSectionId) {
    e.preventDefault();
    if (!siteSettings || !siteSaved || siteSaving) return;
    const sec = SITE_SECTIONS[id];
    if (!(await askConfirm({ title: sec.title, message: sec.message, confirmLabel: sec.button }))) return;
    setErr(null);
    setSiteSaving(true);
    try {
      // The API replaces the whole record, so send the last-saved values for every
      // other section and only this section's edits — other drafts are never published.
      const payload: Record<string, unknown> = { ...siteSaved };
      for (const k of sec.keys) payload[k] = siteSettings[k];
      const resp = await jfetch<Record<string, unknown>>("/admin/site-settings", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const mapped = mapSiteSettingsFromApi(resp);
      setSiteSaved(mapped);
      setSiteSettings((cur) => {
        if (!cur) return mapped;
        const next: Record<string, unknown> = { ...cur };
        for (const k of sec.keys) next[k] = mapped[k];
        return next as SiteSettingsApi;
      });
      notifySiteConfigUpdated();
      toast.success("Saved.");
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

      {confirmDialog}

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
          <div className="space-y-6">
          <form
            onSubmit={(e) => saveSiteSection(e, "brand")}
            className={sectionCard()}
            aria-busy={siteSaving}
          >
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
            <SectionSave busy={siteSaving} dirty={siteSectionDirty("brand")} label={SITE_SECTIONS.brand.button} />
          </form>

          <form
            onSubmit={(e) => saveSiteSection(e, "address")}
            className={sectionCard()}
            aria-busy={siteSaving}
          >
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
            <SectionSave busy={siteSaving} dirty={siteSectionDirty("address")} label={SITE_SECTIONS.address.button} />
          </form>

          <form
            onSubmit={(e) => saveSiteSection(e, "hero")}
            className={sectionCard()}
            aria-busy={siteSaving}
          >
            <div className="">
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
            <SectionSave busy={siteSaving} dirty={siteSectionDirty("hero")} label={SITE_SECTIONS.hero.button} />
          </form>

          <form
            onSubmit={(e) => saveSiteSection(e, "theme")}
            className={sectionCard()}
            aria-busy={siteSaving}
          >
            <div className="">
              <h3 className="font-display text-base font-bold text-white">Website theme</h3>
              <p className="mt-1 text-sm text-muted">
                Choose how the public website looks to visitors. Applies to every page after you save.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2" role="radiogroup" aria-label="Website theme">
                {(
                  [
                    {
                      id: "light",
                      name: "Solar Light",
                      desc: "Bright, warm and clean with animated ring graphics.",
                      swatch: "linear-gradient(135deg,#fffdf8 0%,#ffe9a8 55%,#ff9a2e 100%)",
                    },
                    {
                      id: "dark",
                      name: "Dark Power",
                      desc: "The original dark look with glowing orange accents.",
                      swatch: "linear-gradient(135deg,#030304 0%,#3a1c00 55%,#ff6a00 100%)",
                    },
                  ] as const
                ).map((t) => {
                  const on = siteSettings.theme === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setSiteSettings({ ...siteSettings, theme: t.id })}
                      className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition ${
                        on ? "border-primary bg-primary/10 shadow-[0_0_0_1px_var(--primary)]" : "border-white/15 hover:border-primary/50"
                      }`}
                    >
                      <span
                        className="h-14 w-14 shrink-0 rounded-xl border border-white/20"
                        style={{ background: t.swatch }}
                        aria-hidden
                      />
                      <span>
                        <span className="block font-display text-sm font-bold text-white">
                          {t.name}
                          {on ? <span className="ml-2 text-xs font-semibold text-primary">Selected</span> : null}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted">{t.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <SectionSave busy={siteSaving} dirty={siteSectionDirty("theme")} label={SITE_SECTIONS.theme.button} />
          </form>

          <form
            onSubmit={(e) => saveSiteSection(e, "contact")}
            className={sectionCard()}
            aria-busy={siteSaving}
          >
            <div className="">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-bold text-white">Contact page &amp; WhatsApp card</h3>
                  <p className="mt-1 text-sm text-muted">
                    Everything visitors read on the Contact page and in the WhatsApp card. The WhatsApp number, phone,
                    email, hours and address come from the fields above.
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-muted transition hover:text-white"
                  onClick={() =>
                    setSiteSettings({
                      ...siteSettings,
                      contact: { ...defaultContactContent, topics: [...defaultContactContent.topics] },
                    })
                  }
                >
                  Reset to defaults
                </button>
              </div>

              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                {(
                  [
                    ["page_eyebrow", "Page small heading", 80],
                    ["page_title", "Page title", 200],
                    ["card_title", "Card title", 120],
                    ["topics_label", "Topic list label", 80],
                    ["name_label", "Name field label", 80],
                    ["name_placeholder", "Name field placeholder", 80],
                    ["note_label", "Note field label", 80],
                    ["note_placeholder", "Note field placeholder", 120],
                    ["button_label", "WhatsApp button text", 60],
                    ["call_prompt", "Call prompt text (blank to hide)", 80],
                    ["call_text", "Call link text — {phone} = number (blank to hide)", 80],
                    ["email_text", "Email link text (blank to hide)", 80],
                  ] as const
                ).map(([key, text, max]) => (
                  <div key={key}>
                    <label className={label}>{text}</label>
                    <input
                      className={field}
                      value={siteSettings.contact[key]}
                      maxLength={max}
                      onChange={(e) =>
                        setSiteSettings({
                          ...siteSettings,
                          contact: { ...siteSettings.contact, [key]: e.target.value },
                        })
                      }
                    />
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <label className={label}>Page sub-heading</label>
                  <input
                    className={field}
                    value={siteSettings.contact.page_subtitle}
                    maxLength={400}
                    onChange={(e) =>
                      setSiteSettings({
                        ...siteSettings,
                        contact: { ...siteSettings.contact, page_subtitle: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={label}>Card description</label>
                  <textarea
                    className={`${field} min-h-[72px]`}
                    value={siteSettings.contact.card_subtitle}
                    maxLength={300}
                    onChange={(e) =>
                      setSiteSettings({
                        ...siteSettings,
                        contact: { ...siteSettings.contact, card_subtitle: e.target.value },
                      })
                    }
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className={label}>Topic buttons (up to 8)</label>
                  <div className="mt-2 space-y-2">
                    {siteSettings.contact.topics.map((t, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          className="focus-ring w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white"
                          value={t}
                          maxLength={60}
                          onChange={(e) => {
                            const topics = [...siteSettings.contact.topics];
                            topics[i] = e.target.value;
                            setSiteSettings({ ...siteSettings, contact: { ...siteSettings.contact, topics } });
                          }}
                        />
                        <button
                          type="button"
                          disabled={siteSettings.contact.topics.length <= 1}
                          className="rounded-full border border-white/20 px-3 text-xs font-semibold text-muted transition hover:text-white disabled:opacity-40"
                          onClick={() => {
                            const topics = siteSettings.contact.topics.filter((_, j) => j !== i);
                            setSiteSettings({ ...siteSettings, contact: { ...siteSettings.contact, topics } });
                          }}
                          aria-label={`Remove topic ${i + 1}`}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    {siteSettings.contact.topics.length < 8 ? (
                      <button
                        type="button"
                        className="rounded-full border border-primary/50 px-4 py-2 text-xs font-semibold text-primary transition hover:bg-primary/10"
                        onClick={() =>
                          setSiteSettings({
                            ...siteSettings,
                            contact: { ...siteSettings.contact, topics: [...siteSettings.contact.topics, ""] },
                          })
                        }
                      >
                        + Add topic
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className={label}>
                    WhatsApp message — use {"{business}"} {"{name}"} {"{topic}"} {"{note}"}
                  </label>
                  <textarea
                    className={`${field} min-h-[110px] font-mono text-xs`}
                    value={siteSettings.contact.message_template}
                    maxLength={600}
                    onChange={(e) =>
                      setSiteSettings({
                        ...siteSettings,
                        contact: { ...siteSettings.contact, message_template: e.target.value },
                      })
                    }
                  />
                  <p className="mt-1 text-xs text-muted">
                    A line is skipped automatically when its value is empty (for example, when the visitor leaves the name
                    blank).
                  </p>
                </div>
              </div>
            </div>
            <SectionSave busy={siteSaving} dirty={siteSectionDirty("contact")} label={SITE_SECTIONS.contact.button} />
          </form>

          <form
            onSubmit={(e) => saveSiteSection(e, "map")}
            className={sectionCard()}
            aria-busy={siteSaving}
          >
            <div className="">
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
            <SectionSave busy={siteSaving} dirty={siteSectionDirty("map")} label={SITE_SECTIONS.map.button} />
          </form>

          <form
            onSubmit={(e) => saveSiteSection(e, "social")}
            className={sectionCard()}
            aria-busy={siteSaving}
          >
            <div className="">
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
            <SectionSave busy={siteSaving} dirty={siteSectionDirty("social")} label={SITE_SECTIONS.social.button} />
          </form>
          </div>
        )}
        {tab === "projects" && <CmsProjectsSection />}
        {tab === "services" && <CmsServicesSection />}
        {tab === "pricing" && !pricing ? (
          <p className="text-sm text-muted">Loading configuration…</p>
        ) : null}
        {tab === "pricing" && pricing && (
          <div className="space-y-6">
            <h2 className="font-display text-lg font-bold text-white">Component & estimation settings</h2>
          <form
            onSubmit={(e) => savePricingGroup(e, "components")}
            className={sectionCard()}
            aria-busy={pricingSaving}
          >
            <div>
              <h3 className="font-display text-base font-bold text-white">Component prices</h3>
              <p className="mt-1 text-sm text-muted">Panel, inverter and battery unit prices.</p>
            </div>
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
            </div>
            <SectionSave busy={pricingSaving} dirty={pricingGroupDirty("components")} label={PRICING_GROUPS.components.button} />
          </form>
          <form
            onSubmit={(e) => savePricingGroup(e, "installation")}
            className={sectionCard()}
            aria-busy={pricingSaving}
          >
            <div>
              <h3 className="font-display text-base font-bold text-white">Installation</h3>
              <p className="mt-1 text-sm text-muted">Base installation charge and per-kW charge.</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
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
            </div>
            <SectionSave busy={pricingSaving} dirty={pricingGroupDirty("installation")} label={PRICING_GROUPS.installation.button} />
          </form>
          <form
            onSubmit={(e) => savePricingGroup(e, "misc")}
            className={sectionCard()}
            aria-busy={pricingSaving}
          >
            <div>
              <h3 className="font-display text-base font-bold text-white">Miscellaneous</h3>
              <p className="mt-1 text-sm text-muted">Fixed extras and a percentage of the subtotal.</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
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
            </div>
            <SectionSave busy={pricingSaving} dirty={pricingGroupDirty("misc")} label={PRICING_GROUPS.misc.button} />
          </form>
          <form
            onSubmit={(e) => savePricingGroup(e, "estimation")}
            className={sectionCard()}
            aria-busy={pricingSaving}
          >
            <div>
              <h3 className="font-display text-base font-bold text-white">Estimation rules</h3>
              <p className="mt-1 text-sm text-muted">Default ₹/unit and the allowed system-size range.</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
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
            <SectionSave busy={pricingSaving} dirty={pricingGroupDirty("estimation")} label={PRICING_GROUPS.estimation.button} />
          </form>
          <form
            onSubmit={(e) => savePricingGroup(e, "roof")}
            className={sectionCard()}
            aria-busy={pricingSaving}
          >
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
            <SectionSave busy={pricingSaving} dirty={pricingGroupDirty("roof")} label={PRICING_GROUPS.roof.button} />
          </form>
          </div>
        )}

        {tab === "subsidy" && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-lg font-bold text-white">State subsidies</h2>
              <p className="mt-2 text-sm text-muted">
                Applied after the full system + misc pre-subsidy total. If a state has several active rows, the newest
                one is used in the public calculator. Edit a row to change or switch it off, or delete it.
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
                    <th className={th}>Active</th>
                    <th className={th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subsidies.length === 0 ? (
                    <tr>
                      <td className={td} colSpan={7}>
                        No subsidies yet. Add one above.
                      </td>
                    </tr>
                  ) : null}
                  {subsidies.map((s) =>
                    editSub?.id === s.id ? (
                      <tr key={s.id} className="bg-primary/5">
                        <td className={td}>{s.id}</td>
                        <td className={td}>{s.state_name}</td>
                        <td className={td}>
                          <select
                            aria-label="Subsidy type"
                            className="focus-ring rounded-xl border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white"
                            value={editSub.subsidy_type}
                            onChange={(e) => setEditSub({ ...editSub, subsidy_type: e.target.value })}
                          >
                            <option value="fixed">fixed</option>
                            <option value="percentage">percentage</option>
                          </select>
                        </td>
                        <td className={td}>
                          <input
                            aria-label="Subsidy value"
                            type="number"
                            className="focus-ring w-24 rounded-xl border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white"
                            value={editSub.value}
                            onChange={(e) => setEditSub({ ...editSub, value: +e.target.value })}
                          />
                        </td>
                        <td className={td}>
                          <input
                            aria-label="Subsidy max cap"
                            type="number"
                            className="focus-ring w-28 rounded-xl border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white"
                            value={editSub.max_limit ?? ""}
                            onChange={(e) =>
                              setEditSub({ ...editSub, max_limit: e.target.value ? +e.target.value : null })
                            }
                          />
                        </td>
                        <td className={td}>
                          <input
                            aria-label="Subsidy active"
                            type="checkbox"
                            checked={editSub.is_active}
                            onChange={(e) => setEditSub({ ...editSub, is_active: e.target.checked })}
                          />
                        </td>
                        <td className={td}>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={saveSubsidyEdit}
                              className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-bg"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditSub(null)}
                              className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-muted hover:text-white"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={s.id}>
                        <td className={td}>{s.id}</td>
                        <td className={td}>{s.state_name}</td>
                        <td className={td}>{s.subsidy_type}</td>
                        <td className={td}>{s.value}</td>
                        <td className={td}>{s.max_limit}</td>
                        <td className={td}>{s.is_active ? "Yes" : "No"}</td>
                        <td className={td}>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setEditSub({ ...s })}
                              className="rounded-full border border-primary/50 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteSubsidy(s)}
                              className="rounded-full border border-accent/50 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
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
                    <th className={th}>Active</th>
                    <th className={th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loc.length === 0 ? (
                    <tr>
                      <td className={td} colSpan={6}>
                        No location multipliers yet (1.0 is used). Add one above.
                      </td>
                    </tr>
                  ) : null}
                  {loc.map((x) =>
                    editLoc?.id === x.id ? (
                      <tr key={x.id} className="bg-primary/5">
                        <td className={td}>{x.id}</td>
                        <td className={td}>{x.state_name}</td>
                        <td className={td}>{x.district_name}</td>
                        <td className={td}>
                          <input
                            aria-label="Multiplier"
                            type="number"
                            step="0.01"
                            className="focus-ring w-24 rounded-xl border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white"
                            value={editLoc.system_cost_multiplier}
                            onChange={(e) => setEditLoc({ ...editLoc, system_cost_multiplier: +e.target.value })}
                          />
                        </td>
                        <td className={td}>
                          <input
                            aria-label="Multiplier active"
                            type="checkbox"
                            checked={editLoc.is_active}
                            onChange={(e) => setEditLoc({ ...editLoc, is_active: e.target.checked })}
                          />
                        </td>
                        <td className={td}>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={saveLocationEdit}
                              className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-bg"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditLoc(null)}
                              className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-muted hover:text-white"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={x.id}>
                        <td className={td}>{x.id}</td>
                        <td className={td}>{x.state_name}</td>
                        <td className={td}>{x.district_name}</td>
                        <td className={td}>{x.system_cost_multiplier}</td>
                        <td className={td}>{x.is_active ? "Yes" : "No"}</td>
                        <td className={td}>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setEditLoc({ ...x })}
                              className="rounded-full border border-primary/50 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteLocation(x)}
                              className="rounded-full border border-accent/50 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
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
