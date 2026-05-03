import { getApiBaseServer } from "@/lib/nrgs-api-server";

export type CmsProjectImage = {
  url: string;
  alt: string;
  sort_order: number;
};

export type CmsProject = {
  id: number;
  title: string;
  description: string;
  location: string;
  system_size_kw: number;
  completion_date: string | null;
  sort_order: number;
  images: CmsProjectImage[];
};

export type CmsService = {
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

export async function fetchProjectsPublic(): Promise<CmsProject[]> {
  try {
    const res = await fetch(`${getApiBaseServer()}/projects`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return (await res.json()) as CmsProject[];
  } catch {
    return [];
  }
}

export async function fetchServicesPublic(): Promise<CmsService[]> {
  try {
    const res = await fetch(`${getApiBaseServer()}/services`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return (await res.json()) as CmsService[];
  } catch {
    return [];
  }
}
