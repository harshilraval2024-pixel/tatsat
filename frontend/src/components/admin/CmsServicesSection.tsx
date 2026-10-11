"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { jfetch } from "@/lib/nrgs-api";
import { useConfirm } from "@/components/admin/useConfirm";

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
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);
  /** The service being edited, or null when the form is in "add" mode. */
  const [editing, setEditing] = useState<ServiceOut | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const { confirm: askConfirm, dialog: confirmDialog } = useConfirm();

  const load = useCallback(() => {
    jfetch<ServiceOut[]>("/admin/services")
      .then(setRows)
      .catch((e) => setMsg(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setEditing(null);
    setSlug("");
    setTitle("");
    setDescription("");
    setIconName("home");
    setPriceLabel("");
    setBenefitsText("");
    setIsActive(true);
  }

  function startEdit(r: ServiceOut) {
    setEditing(r);
    setSlug(r.slug);
    setTitle(r.title);
    setDescription(r.description);
    setIconName(r.icon_name || "home");
    setPriceLabel(r.price_label ?? "");
    setBenefitsText(r.benefits.join("\n"));
    setIsActive(r.is_active);
    setMsg(null);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  async function saveService(e: React.FormEvent) {
    e.preventDefault();
    const isEdit = editing !== null;
    if (
      !(await askConfirm(
        isEdit
          ? {
              title: "Save changes to this service?",
              message: `"${title.trim() || "Untitled"}" will be updated on the public Services page.`,
              confirmLabel: "Save changes",
            }
          : {
              title: "Publish this service?",
              message: `"${title.trim() || "Untitled"}" will appear on the public Services page.`,
              confirmLabel: "Publish service",
            },
      ))
    )
      return;
    setMsg(null);
    setBusy(true);
    try {
      const benefits = benefitsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const payload = {
        slug: slug.trim().toLowerCase().replace(/\s+/g, "-"),
        title,
        description,
        icon_name: iconName,
        price_label: priceLabel.trim() || null,
        benefits,
        is_active: isActive,
      };
      if (editing) {
        await jfetch<ServiceOut>(`/admin/services/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await jfetch<ServiceOut>("/admin/services", {
          method: "POST",
          body: JSON.stringify({ ...payload, sort_order: rows.length }),
        });
      }
      resetForm();
      load();
      toast.success(isEdit ? "Service updated." : "Service created.");
      setMsg(isEdit ? "Service updated." : "Service created.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    if (
      !(await askConfirm({
        title: "Delete this service?",
        message: "The service will be permanently removed from the website. This cannot be undone.",
        confirmLabel: "Delete service",
        danger: true,
      }))
    )
      return;
    setMsg(null);
    try {
      await jfetch(`/admin/services/${id}`, { method: "DELETE" });
      if (editing?.id === id) resetForm();
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="space-y-8">
      {confirmDialog}
      <div>
        <h2 className="font-display text-lg font-bold text-white">Solar services</h2>
        <p className="mt-2 text-sm text-muted">
          Slug becomes the URL anchor (#slug). Icons: home, building, wrench, doc — matching the public site icons.
          Untick &quot;Show on website&quot; to hide a service without deleting it.
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
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="border-t border-white/10">
                <td className="px-3 py-4 text-muted" colSpan={5}>
                  No services yet. Add one below.
                </td>
              </tr>
            ) : null}
            {rows.map((r) => {
              const active = editing?.id === r.id;
              return (
                <tr key={r.id} className={`border-t border-white/10 ${active ? "bg-primary/5" : ""}`}>
                  <td className="px-3 py-2 font-mono text-xs text-primary">{r.slug}</td>
                  <td className="px-3 py-2 text-white">{r.title}</td>
                  <td className="px-3 py-2 text-muted">{r.icon_name}</td>
                  <td className="px-3 py-2">{r.is_active ? "Yes" : "No"}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="rounded-full border border-primary/50 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
                        onClick={() => startEdit(r)}
                      >
                        {active ? "Editing…" : "Edit"}
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-accent/50 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10"
                        onClick={() => remove(r.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <form ref={formRef} onSubmit={saveService} className="space-y-4 rounded-2xl border border-white/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-white">
            {editing ? `Edit service — ${editing.title}` : "Add service"}
          </p>
          {editing ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-muted hover:text-white"
            >
              Cancel edit
            </button>
          ) : null}
        </div>
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
          <label className="flex items-center gap-2 text-sm text-muted sm:col-span-2">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Show on website
          </label>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-2xl bg-primary px-6 py-2 text-sm font-bold uppercase tracking-wide text-bg disabled:opacity-50"
        >
          {busy ? "Saving…" : editing ? "Save changes" : "Create service"}
        </button>
      </form>
    </div>
  );
}
