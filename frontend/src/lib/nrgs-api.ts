/** API client for Tatsat NRGS FastAPI. JWT is stored in localStorage (see security note in README or .env.example). */

import { DEFAULT_PRODUCTION_API_ORIGIN, resolvePublicApiOrigin } from "@/lib/api-origin";

export const ADMIN_JWT_KEY = "nrgs_admin_jwt";

export { DEFAULT_PRODUCTION_API_ORIGIN };

/**
 * Browser (no NEXT_PUBLIC_API_URL): same-origin `/nrgs-api/*` → proxied to FastAPI (no CORS).
 * Server / SSR: direct API origin (rewrites do not apply server-side).
 */
export function getApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (raw) {
    return raw.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    return "/nrgs-api";
  }
  return resolvePublicApiOrigin();
}

function apiUrl(path: string): string {
  const base = getApiBase();
  return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
}

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ADMIN_JWT_KEY);
}

export function setAdminToken(t: string) {
  localStorage.setItem(ADMIN_JWT_KEY, t);
}

export function clearAdminToken() {
  localStorage.removeItem(ADMIN_JWT_KEY);
}

/** Call after login/logout so Navbar can update without full reload. */
export function notifyAdminAuthChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("nrgs-admin-auth"));
}

/** Call after saving site branding/contact so the public shell refetches `/site-settings`. */
export function notifySiteConfigUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("nrgs-site-config-updated"));
}

export async function jfetch<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = true, ...rest } = options;
  const h: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (auth) {
    const t = getAdminToken();
    if (t) h.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(apiUrl(path), {
    ...rest,
    headers: { ...h, ...rest.headers },
  });
  if (res.status === 401) {
    clearAdminToken();
    notifyAdminAuthChanged();
    throw new Error("Session expired. Log in again.");
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j: { detail?: string | { msg: string }[] } = await res.json();
      if (typeof j.detail === "string") msg = j.detail;
      else if (Array.isArray(j.detail)) msg = j.detail.map((x) => x.msg).join(", ");
    } catch {
      if (res.status === 502 || res.status === 504) {
        msg =
          "Cannot reach the API. Start the FastAPI server (e.g. uvicorn on port 8000) or check NEXT_PUBLIC_API_URL.";
      } else if (res.status === 500) {
        msg =
          "Server error (is PostgreSQL running and migrations + seed applied in `backend`?)";
      }
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type");
  if (ct?.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as T;
}

export function downloadWithAuth(path: string): Promise<Response> {
  const t = getAdminToken();
  return fetch(apiUrl(path), {
    headers: t ? { Authorization: `Bearer ${t}` } : {},
  });
}

export async function uploadAdminFile(file: File): Promise<{ path: string }> {
  const t = getAdminToken();
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(apiUrl("/admin/upload"), {
    method: "POST",
    headers: t ? { Authorization: `Bearer ${t}` } : {},
    body: fd,
  });
  if (res.status === 401) {
    clearAdminToken();
    notifyAdminAuthChanged();
    throw new Error("Session expired. Log in again.");
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j: { detail?: string } = await res.json();
      if (typeof j.detail === "string") msg = j.detail;
    } catch {
      /* noop */
    }
    throw new Error(msg);
  }
  return (await res.json()) as { path: string };
}
