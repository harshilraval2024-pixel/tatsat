import { cache } from "react";
import {
  getDefaultSiteConfig,
  mergeSiteConfigFromApi,
  type SiteConfig,
} from "@/lib/site-config";

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
}

/** Server-only: cached per request; merges `/site-settings` with static defaults. */
export const getSiteConfig = cache(async (): Promise<SiteConfig> => {
  try {
    const res = await fetch(`${apiBase()}/site-settings`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) {
      return getDefaultSiteConfig();
    }
    const data = (await res.json()) as Record<string, unknown>;
    return mergeSiteConfigFromApi(data as Parameters<typeof mergeSiteConfigFromApi>[0]);
  } catch {
    return getDefaultSiteConfig();
  }
});
