import { testimonials } from "@/lib/site";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function Testimonials() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Voices from Gujarat"
        title="What our customers say"
        subtitle="Real projects, real DISCOM desks, real heatwaves survived."
      />
      <div className="grid gap-5 lg:grid-cols-3">
        {testimonials.map((t, idx) => (
          <Reveal key={t.name} delay={idx * 80}>
            <figure className="glass-panel flex h-full flex-col rounded-3xl p-6">
              <blockquote className="flex-1 text-sm leading-relaxed text-white/90">&ldquo;{t.quote}&rdquo;</blockquote>
              <figcaption className="mt-6 border-t border-white/10 pt-4 text-sm">
                <p className="font-semibold text-primary">{t.name}</p>
                <p className="text-xs text-muted">{t.role}</p>
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
