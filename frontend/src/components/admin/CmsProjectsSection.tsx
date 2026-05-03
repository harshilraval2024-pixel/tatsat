"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { getApiBase } from "@/lib/nrgs-api";
import { jfetch, uploadAdminFile } from "@/lib/nrgs-api";

type ProjectOut = {
  id: number;
  title: string;
  description: string;
  location: string;
  system_size_kw: number;
  completion_date: string | null;
  sort_order: number;
  images: { url: string; alt: string; sort_order: number }[];
};

const label = "text-xs font-semibold uppercase tracking-wide text-muted";
const field =
  "focus-ring mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white";

function mediaSrc(path: string): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const base = getApiBase().replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  if (base.startsWith("http")) return `${base}${p}`;
  if (typeof window !== "undefined") return `${window.location.origin}${base}${p}`;
  return p;
}

export function CmsProjectsSection() {
  const [rows, setRows] = useState<ProjectOut[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [kw, setKw] = useState("10");
  const [desc, setDesc] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    jfetch<ProjectOut[]>("/admin/projects")
      .then(setRows)
      .catch((e) => setMsg(String(e)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const p = await jfetch<ProjectOut>("/admin/projects", {
        method: "POST",
        body: JSON.stringify({
          title,
          description: desc,
          location,
          system_size_kw: parseFloat(kw) || 0,
          sort_order: rows.length,
        }),
        auth: true,
      });
      if (file) {
        const up = await uploadAdminFile(file);
        await jfetch<ProjectOut>(`/admin/projects/${p.id}/images`, {
          method: "POST",
          body: JSON.stringify({ path: up.path, alt: title, sort_order: 0 }),
        });
      }
      setTitle("");
      setLocation("");
      setKw("10");
      setDesc("");
      setFile(null);
      load();
      setMsg("Project saved.");
    } catch (err) {
      setMsg(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this project and its images?")) return;
    setMsg(null);
    try {
      await jfetch(`/admin/projects/${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setMsg(String(e));
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-lg font-bold text-white">Project showcase</h2>
        <p className="mt-2 text-sm text-muted">
          Projects appear on the public /projects page. Upload a cover image after creating a row, or paste external URLs via API.
        </p>
      </div>
      {msg ? <p className="text-sm text-secondary">{msg}</p> : null}

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className={label}>
              <th className="px-3 py-2">Cover</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Location</th>
              <th className="px-3 py-2">kW</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const cover = r.images[0]?.url;
              return (
                <tr key={r.id} className="border-t border-white/10">
                  <td className="px-3 py-2">
                    <div className="relative h-12 w-16 overflow-hidden rounded-lg bg-black/40">
                      {cover ? (
                        <Image src={mediaSrc(cover)} alt="" fill className="object-cover" sizes="64px" unoptimized />
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-white">{r.title}</td>
                  <td className="px-3 py-2 text-muted">{r.location}</td>
                  <td className="px-3 py-2">{r.system_size_kw}</td>
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
              );
            })}
          </tbody>
        </table>
      </div>

      <form onSubmit={createProject} className="space-y-4 rounded-2xl border border-white/10 p-4">
        <p className="text-sm font-semibold text-white">Add project</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Title</label>
            <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div>
            <label className={label}>Location</label>
            <input className={field} value={location} onChange={(e) => setLocation(e.target.value)} required />
          </div>
          <div>
            <label className={label}>System size (kW)</label>
            <input className={field} type="number" step="0.01" value={kw} onChange={(e) => setKw(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Description</label>
            <textarea className={`${field} min-h-[80px]`} value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Cover image (optional)</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="mt-2 text-sm text-muted"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-2xl bg-primary px-6 py-2 text-sm font-bold uppercase tracking-wide text-bg disabled:opacity-50"
        >
          {busy ? "Saving…" : "Create project"}
        </button>
      </form>
    </div>
  );
}
