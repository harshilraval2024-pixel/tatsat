import { keyStats } from "@/lib/site";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function KeyStats() {
  return (
    <section id="stats" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Proof in performance"
        title="Numbers that keep teams sleeping easy at night"
        subtitle="From bungalows to industrial rooftops, we obsess over yield, safety, and subsidy velocity."
      />
      <div className="grid gap-5 md:grid-cols-3">
        {keyStats.map((stat, idx) => (
          <Reveal key={stat.label} delay={idx * 90}>
            <div className="glass-panel glow-border relative overflow-hidden rounded-3xl p-6">
              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-secondary/20 blur-3xl" />
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">{stat.label}</p>
              <p className="mt-3 font-display text-4xl font-semibold text-white">{stat.value}</p>
              <p className="mt-2 text-sm text-muted">{stat.hint}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
