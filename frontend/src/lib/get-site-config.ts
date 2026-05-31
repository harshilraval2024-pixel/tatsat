import { cache } from "react";
import { getApiBaseServer } from "@/lib/nrgs-api-server";
import {
  getDefaultSiteConfig,
  mergeSiteConfigFromApi,
  type SiteConfig,
} from "@/lib/site-config";

/** Server-only: cached per request; merges `/site-settings` with static defaults. */
export const getSiteConfig = cache(async (): Promise<SiteConfig> => {
  try {
    const res = await fetch(`${getApiBaseServer()}/site-settings`, {
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
