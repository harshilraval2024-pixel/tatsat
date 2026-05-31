/** Server-side API base (SSR / Route Handlers). Rewrites do not apply here. */

import { resolvePublicApiOrigin } from "@/lib/api-origin";

export function getApiBaseServer(): string {
  return resolvePublicApiOrigin();
}

export function absoluteMediaUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return "";
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;
  const base = getApiBaseServer();
  return pathOrUrl.startsWith("/") ? `${base}${pathOrUrl}` : `${base}/${pathOrUrl}`;
}
