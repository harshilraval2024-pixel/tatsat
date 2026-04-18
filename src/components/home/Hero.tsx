import Link from "next/link";
import { site } from "@/lib/site";
import { GlowButton } from "@/components/ui/GlowButton";
import { Reveal } from "@/components/ui/Reveal";

export function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pb-20 pt-10 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-10%] h-[520px] w-[520px] -translate-x-1/2 rounded-full border border-primary/15 bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_62%)] animate-pulse-ring" />
        <div className="absolute left-1/2 top-[8%] h-[420px] w-[420px] -translate-x-1/2 rounded-full border border-secondary/25 animate-spin-slow" />
        <div className="absolute left-1/2 top-[12%] h-[320px] w-[320px] -translate-x-1/2 rounded-full border border-accent/30 animate-spin-slow-reverse" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-bg to-transparent" />
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-col items-center text-center">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-secondary">{site.tagline}</p>
        </Reveal>
        <Reveal className="mt-4 max-w-4xl" delay={80}>
          <h1 className="font-display text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
            Power your future with{" "}
            <span className="text-gradient-brand drop-shadow-[0_0_28px_rgba(255,106,0,0.35)]">{site.name}</span>
          </h1>
        </Reveal>
        <Reveal className="mt-5 max-w-2xl text-base text-muted sm:text-lg" delay={140}>
          Solar solutions for homes & businesses — engineered for India&apos;s heat, dust, and subsidy timelines.
        </Reveal>
        <Reveal className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center" delay={200}>
          <GlowButton href="/quote" variant="primary" className="min-w-[200px] px-8 py-3 text-sm">
            Get free quote
          </GlowButton>
          <GlowButton href={`tel:${site.phoneTel}`} variant="outline" className="min-w-[200px] px-8 py-3 text-sm">
            Call now
          </GlowButton>
        </Reveal>
        <Reveal className="mt-4 text-xs text-muted" delay={240}>
          Serving Ahmedabad, Gandhinagar, Vadodara, Surat & nearby districts ·{" "}
          <Link href="/projects" className="text-primary hover:underline">
            View live projects
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
