import { whyChoose } from "@/lib/site";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function WhyChooseUs() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Why teams pick us"
        title="Built for trust on subsidy timelines"
        subtitle="We combine disciplined engineering with paperwork stamina — the rare pairing rooftop solar in India actually needs."
      />
      <div className="grid gap-5 lg:grid-cols-2">
        {whyChoose.map((item, idx) => (
          <Reveal key={item.title} delay={idx * 70}>
            <article className="glass-panel h-full rounded-3xl p-6 transition hover:border-secondary/50">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/25 to-accent/30 text-lg">
                  ⚡
                </span>
                <h3 className="font-display text-lg font-semibold text-white">{item.title}</h3>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted">{item.copy}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
