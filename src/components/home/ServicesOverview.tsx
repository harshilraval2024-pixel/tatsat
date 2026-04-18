import Link from "next/link";
import { serviceCards } from "@/lib/site";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function ServicesOverview() {
  return (
    <section id="services" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="What we deliver"
        title="Solar services tuned for Indian rooftops"
        subtitle="Every engagement includes monitoring setup guidance and a clear path to net metering."
      />
      <div className="grid gap-5 md:grid-cols-2">
        {serviceCards.map((card, idx) => (
          <Reveal key={card.title} delay={idx * 80}>
            <Link
              href={card.href}
              className="group glass-panel relative block rounded-3xl p-6 transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_0_40px_rgba(255,106,0,0.18)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-display text-xl font-semibold text-white group-hover:text-primary">{card.title}</h3>
                  <p className="mt-3 text-sm text-muted">{card.blurb}</p>
                </div>
                <span className="rounded-full border border-primary/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                  Explore
                </span>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
