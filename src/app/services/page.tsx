import type { Metadata } from "next";
import { servicesDetail } from "@/lib/site";
import { ServiceIcon, type ServiceIconName } from "@/components/ServiceIcon";
import { GlowButton } from "@/components/ui/GlowButton";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Services",
  description: `Residential, commercial, maintenance, and consultation services from ${site.name} — engineered for Indian rooftops and subsidy pathways.`,
};

export default function ServicesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Capabilities"
        title="Solar services with end-to-end accountability"
        subtitle="Pick a track below — each includes structured commissioning, monitoring handoff, and clear documentation for audits."
      />

      <div className="space-y-10">
        {servicesDetail.map((svc, idx) => (
          <Reveal key={svc.id} delay={idx * 70}>
            <section
              id={svc.id}
              className="glass-panel scroll-mt-28 rounded-[2rem] p-8 transition hover:border-secondary/40"
            >
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/25 to-accent/30 ring-1 ring-primary/30">
                    <ServiceIcon name={svc.icon as ServiceIconName} />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl font-semibold text-white">{svc.title}</h2>
                    <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">{svc.description}</p>
                  </div>
                </div>
                <GlowButton href="/quote" variant="primary" className="shrink-0 self-start">
                  Book this service
                </GlowButton>
              </div>
              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {svc.benefits.map((b) => (
                  <div key={b} className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/90">
                    <span className="mr-2 text-primary">▹</span>
                    {b}
                  </div>
                ))}
              </div>
            </section>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
