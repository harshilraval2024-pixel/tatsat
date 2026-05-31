/** Deployed FastAPI on Render. Override with NEXT_PUBLIC_API_URL. */
export const DEFAULT_PRODUCTION_API_ORIGIN = "https://tatsat.onrender.com";

/** Origin used for rewrites (next.config) and direct server-side fetch. */
export function resolvePublicApiOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
    return DEFAULT_PRODUCTION_API_ORIGIN;
  }
  return "http://127.0.0.1:8000";
}
