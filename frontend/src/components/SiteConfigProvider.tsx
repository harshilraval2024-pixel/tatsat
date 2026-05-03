"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  getDefaultSiteConfig,
  mergeSiteConfigFromApi,
  type SiteConfig,
} from "@/lib/site-config";
import { getApiBase } from "@/lib/nrgs-api";

const SiteConfigContext = createContext<SiteConfig>(getDefaultSiteConfig());

export function SiteConfigProvider({
  initial,
  children,
}: {
  initial: SiteConfig;
  children: ReactNode;
}) {
  const [cfg, setCfg] = useState(initial);

  useEffect(() => {
    const refresh = () => {
      const base = getApiBase();
      fetch(`${base}/site-settings`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) setCfg(mergeSiteConfigFromApi(data));
        })
        .catch(() => {});
    };
    window.addEventListener("nrgs-site-config-updated", refresh);
    return () => window.removeEventListener("nrgs-site-config-updated", refresh);
  }, []);

  return <SiteConfigContext.Provider value={cfg}>{children}</SiteConfigContext.Provider>;
}

export function useSiteConfig(): SiteConfig {
  return useContext(SiteConfigContext);
}
