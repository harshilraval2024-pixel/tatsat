import type { Metadata } from "next";
import Image from "next/image";
import { projects as fallbackProjects } from "@/lib/site";
import { fetchProjectsPublic } from "@/lib/cms-public";
import { absoluteMediaUrl } from "@/lib/nrgs-api-server";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getSiteConfig } from "@/lib/get-site-config";

export async function generateMetadata(): Promise<Metadata> {
  const cfg = await getSiteConfig();
  return {
    title: "Projects",
    description: `Selected rooftop solar installations by ${cfg.name} across Gujarat and Western India — real locations, real kW sizes.`,
  };
}

export default async function ProjectsPage() {
  const cfg = await getSiteConfig();
  const apiProjects = await fetchProjectsPublic();
  const items =
    apiProjects.length > 0
      ? apiProjects.map((p) => ({
          title: p.title,
          location: p.location,
          sizeKw: p.system_size_kw,
          image: p.images[0]?.url ? absoluteMediaUrl(p.images[0].url) : "",
          description: p.description,
        }))
      : fallbackProjects.map((p) => ({
          title: p.title,
          location: p.location,
          sizeKw: p.sizeKw,
          image: p.image,
          description: "",
        }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Portfolio"
        title="Installations that keep performing after the photo op"
        subtitle={
          cfg.serviceAreas?.trim() ||
          "Representative projects — imagery may be illustrative of delivered quality."
        }
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p, idx) => (
          <Reveal key={`${p.title}-${idx}`} delay={idx * 60}>
            <article className="group overflow-hidden rounded-3xl border border-white/10 bg-bg-elevated/80 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_0_40px_rgba(255,106,0,0.2)]">
              <div className="relative aspect-[4/3] overflow-hidden">
                {p.image ? (
                  <Image
                    src={p.image}
                    alt={p.title}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 bg-black/50" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3">
                  <p className="font-display text-lg font-semibold text-white">{p.title}</p>
                  <p className="text-xs text-primary">{p.location}</p>
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-4 text-sm">
                <span className="text-muted">System size</span>
                <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">{p.sizeKw} kW</span>
              </div>
              {p.description ? (
                <p className="border-t border-white/5 px-4 pb-4 text-xs leading-relaxed text-muted">{p.description}</p>
              ) : null}
            </article>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
