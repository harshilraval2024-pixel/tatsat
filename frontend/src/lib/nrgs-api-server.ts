/** Server-side API base (SSR / Route Handlers). Rewrites do not apply here. */

import { DEFAULT_PRODUCTION_API_ORIGIN } from "@/lib/api-origin";

export function getApiBaseServer(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") return DEFAULT_PRODUCTION_API_ORIGIN;
  return "http://127.0.0.1:8000";
}

export function absoluteMediaUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return "";
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;
  const base = getApiBaseServer();
  return pathOrUrl.startsWith("/") ? `${base}${pathOrUrl}` : `${base}/${pathOrUrl}`;
}
