"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { getApiBase } from "@/lib/nrgs-api";
import { jfetch, uploadAdminFile } from "@/lib/nrgs-api";
import { useConfirm } from "@/components/admin/useConfirm";

type ProjectOut = {
  id: number;
  title: string;
  description: string;
  location: string;
  system_size_kw: number;
  completion_date: string | null;
  sort_order: number;
  images: { id: number; url: string; alt: string; sort_order: number }[];
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
  /** The project being edited, or null when the form is in "add" mode. */
  const [editing, setEditing] = useState<ProjectOut | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { confirm: askConfirm, dialog: confirmDialog } = useConfirm();

  const load = useCallback(() => {
    jfetch<ProjectOut[]>("/admin/projects")
      .then(setRows)
      .catch((e) => setMsg(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setEditing(null);
    setTitle("");
    setLocation("");
    setKw("10");
    setDesc("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function startEdit(r: ProjectOut) {
    setEditing(r);
    setTitle(r.title);
    setLocation(r.location);
    setKw(String(r.system_size_kw));
    setDesc(r.description);
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    setMsg(null);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  async function saveProject(e: React.FormEvent) {
    e.preventDefault();
    const isEdit = editing !== null;
    if (
      !(await askConfirm(
        isEdit
          ? {
              title: "Save changes to this project?",
              message: `"${title.trim() || "Untitled"}" will be updated on the public Projects page.`,
              confirmLabel: "Save changes",
            }
          : {
              title: "Publish this project?",
              message: `"${title.trim() || "Untitled"}" will appear on the public Projects page.`,
              confirmLabel: "Publish project",
            },
      ))
    )
      return;
    setMsg(null);
    setBusy(true);
    try {
      let projectId: number;
      if (editing) {
        const p = await jfetch<ProjectOut>(`/admin/projects/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify({
            title,
            description: desc,
            location,
            system_size_kw: parseFloat(kw) || 0,
          }),
        });
        projectId = p.id;
      } else {
        const p = await jfetch<ProjectOut>("/admin/projects", {
          method: "POST",
          body: JSON.stringify({
            title,
            description: desc,
            location,
            system_size_kw: parseFloat(kw) || 0,
            sort_order: rows.length,
          }),
        });
        projectId = p.id;
      }
      if (file) {
        // New image first; only then drop the old cover, so a failed upload loses nothing.
        const up = await uploadAdminFile(file);
        await jfetch<ProjectOut>(`/admin/projects/${projectId}/images`, {
          method: "POST",
          body: JSON.stringify({ path: up.path, alt: title, sort_order: -1 }),
        });
        for (const im of editing?.images ?? []) {
          await jfetch(`/admin/projects/${projectId}/images/${im.id}`, { method: "DELETE" });
        }
      }
      resetForm();
      load();
      toast.success(isEdit ? "Project updated." : "Project saved.");
      setMsg(isEdit ? "Project updated." : "Project saved.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    if (
      !(await askConfirm({
        title: "Delete this project?",
        message: "The project and its images will be permanently removed. This cannot be undone.",
        confirmLabel: "Delete project",
        danger: true,
      }))
    )
      return;
    setMsg(null);
    try {
      await jfetch(`/admin/projects/${id}`, { method: "DELETE" });
      if (editing?.id === id) resetForm();
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  const editingCover = editing?.images[0]?.url;

  return (
    <div className="space-y-8">
      {confirmDialog}
      <div>
        <h2 className="font-display text-lg font-bold text-white">Project showcase</h2>
        <p className="mt-2 text-sm text-muted">
          Projects appear on the public /projects page. Use Edit to change a project&apos;s details or replace its
          cover image.
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
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="border-t border-white/10">
                <td className="px-3 py-4 text-muted" colSpan={5}>
                  No projects yet. Add one below.
                </td>
              </tr>
            ) : null}
            {rows.map((r) => {
              const cover = r.images[0]?.url;
              const active = editing?.id === r.id;
              return (
                <tr key={r.id} className={`border-t border-white/10 ${active ? "bg-primary/5" : ""}`}>
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

      <form ref={formRef} onSubmit={saveProject} className="space-y-4 rounded-2xl border border-white/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-white">
            {editing ? `Edit project — ${editing.title}` : "Add project"}
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
            <label className={label}>{editing ? "Replace cover image (optional)" : "Cover image (optional)"}</label>
            {editing ? (
              <div className="mt-2 flex items-center gap-3">
                <div className="relative h-12 w-16 overflow-hidden rounded-lg bg-black/40">
                  {editingCover ? (
                    <Image src={mediaSrc(editingCover)} alt="" fill className="object-cover" sizes="64px" unoptimized />
                  ) : null}
                </div>
                <span className="text-xs text-muted">
                  {editingCover ? "Current cover. Choose a file to replace it." : "No cover yet."}
                </span>
              </div>
            ) : null}
            <input
              ref={fileRef}
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
          {busy ? "Saving…" : editing ? "Save changes" : "Create project"}
        </button>
      </form>
    </div>
  );
}
