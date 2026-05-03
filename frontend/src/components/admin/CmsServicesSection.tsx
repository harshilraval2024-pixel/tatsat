"use client";

import { useCallback, useEffect, useState } from "react";
import { jfetch } from "@/lib/nrgs-api";

type ServiceOut = {
  id: number;
  slug: string;
  title: string;
  description: string;
  icon_name: string;
  price_label: string | null;
  benefits: string[];
  sort_order: number;
  is_active: boolean;
};

const label = "text-xs font-semibold uppercase tracking-wide text-muted";
const field =
  "focus-ring mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white";

const ICONS = ["home", "building", "wrench", "doc"] as const;

export function CmsServicesSection() {
  const [rows, setRows] = useState<ServiceOut[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [iconName, setIconName] = useState<string>("home");
  const [priceLabel, setPriceLabel] = useState("");
  const [benefitsText, setBenefitsText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    jfetch<ServiceOut[]>("/admin/services")
      .then(setRows)
      .catch((e) => setMsg(String(e)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createService(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const benefits = benefitsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      await jfetch<ServiceOut>("/admin/services", {
        method: "POST",
        body: JSON.stringify({
          slug: slug.trim().toLowerCase().replace(/\s+/g, "-"),
          title,
          description,
          icon_name: iconName,
          price_label: priceLabel.trim() || null,
          benefits,
          sort_order: rows.length,
          is_active: true,
        }),
      });
      setSlug("");
      setTitle("");
      setDescription("");
      setPriceLabel("");
      setBenefitsText("");
      load();
      setMsg("Service created.");
    } catch (err) {
      setMsg(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this service?")) return;
    setMsg(null);
    try {
      await jfetch(`/admin/services/${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setMsg(String(e));
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-lg font-bold text-white">Solar services</h2>
        <p className="mt-2 text-sm text-muted">
          Slug becomes the URL anchor (#slug). Icons: home, building, wrench, doc — matching the public site icons.
        </p>
      </div>
      {msg ? <p className="text-sm text-secondary">{msg}</p> : null}

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className={label}>
              <th className="px-3 py-2">Slug</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Icon</th>
              <th className="px-3 py-2">Active</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/10">
                <td className="px-3 py-2 font-mono text-xs text-primary">{r.slug}</td>
                <td className="px-3 py-2 text-white">{r.title}</td>
                <td className="px-3 py-2 text-muted">{r.icon_name}</td>
                <td className="px-3 py-2">{r.is_active ? "Yes" : "No"}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="text-xs font-semibold text-accent hover:underline"
                    onClick={() => remove(r.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={createService} className="space-y-4 rounded-2xl border border-white/10 p-4">
        <p className="text-sm font-semibold text-white">Add service</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Slug (url-safe)</label>
            <input
              className={field}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="e.g. residential-solar"
              required
            />
          </div>
          <div>
            <label className={label}>Title</label>
            <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div>
            <label className={label}>Icon</label>
            <select className={field} value={iconName} onChange={(e) => setIconName(e.target.value)}>
              {ICONS.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Starting from / pricing note (optional)</label>
            <input className={field} value={priceLabel} onChange={(e) => setPriceLabel(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Description</label>
            <textarea
              className={`${field} min-h-[80px]`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Benefits (one per line)</label>
            <textarea
              className={`${field} min-h-[100px]`}
              value={benefitsText}
              onChange={(e) => setBenefitsText(e.target.value)}
              placeholder={"Line 1\nLine 2"}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-2xl bg-primary px-6 py-2 text-sm font-bold uppercase tracking-wide text-bg disabled:opacity-50"
        >
          {busy ? "Saving…" : "Create service"}
        </button>
      </form>
    </div>
  );
}
