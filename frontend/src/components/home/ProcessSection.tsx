import { processSteps } from "@/lib/site";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function ProcessSection() {
  return (
    <section id="process" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="How it works"
        title="From first call to electrons on the grid"
        subtitle="A clear cadence so procurement, finance, and facilities teams always know what happens next."
      />
      <div className="relative grid gap-6 md:grid-cols-4">
        <div className="pointer-events-none absolute left-4 right-4 top-10 hidden h-px bg-gradient-to-r from-primary/0 via-primary/60 to-accent/0 md:block" />
        {processSteps.map((step, idx) => (
          <Reveal key={step.title} delay={idx * 90}>
            <article className="relative rounded-3xl border border-white/10 bg-bg-elevated/70 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-sm font-bold text-black">
                {idx + 1}
              </div>
              <p className="mt-4 font-display text-lg font-semibold text-white">{step.title}</p>
              <p className="mt-2 text-sm text-muted">{step.copy}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
