"use client";

import { GlowButton } from "@/components/ui/GlowButton";
import { Reveal } from "@/components/ui/Reveal";
import { useSiteConfig } from "@/components/SiteConfigProvider";

export function CtaBanner() {
  const cfg = useSiteConfig();
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
      <Reveal>
        <div className="relative overflow-hidden rounded-[2rem] border border-primary/30 bg-gradient-to-r from-bg-elevated via-bg to-bg-elevated p-10 text-center shadow-[0_0_80px_rgba(255,106,0,0.18)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,208,0,0.18),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(255,59,0,0.2),transparent_40%)]" />
          <div className="relative space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-secondary">Ready when you are</p>
            <h2 className="font-display text-3xl font-semibold text-white sm:text-4xl">
              Book a free rooftop assessment this week
            </h2>
            <p className="mx-auto max-w-2xl text-sm text-muted">
              Share your latest electricity bill — we&apos;ll model savings, subsidy eligibility, and payback before you
              sign anything.
            </p>
            <div className="flex flex-col items-center justify-center gap-3 pt-4 sm:flex-row">
              <GlowButton href="/quote" variant="primary" className="min-w-[220px] px-8 py-3">
                Start my quote
              </GlowButton>
              <GlowButton href={`tel:${cfg.phoneTel}`} variant="ghost" className="min-w-[220px] px-8 py-3">
                Talk to an engineer
              </GlowButton>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
