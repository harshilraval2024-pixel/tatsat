import type { Metadata } from "next";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getSiteConfig } from "@/lib/get-site-config";

export async function generateMetadata(): Promise<Metadata> {
  const cfg = await getSiteConfig();
  return {
    title: "About us",
    description: `Learn about ${cfg.name} — mission, vision, and how we deliver rooftop solar across India with a Gujarat-first operations hub.`,
  };
}

export default async function AboutPage() {
  const cfg = await getSiteConfig();
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Our story"
        title="Engineering-first solar, grounded in Indian realities"
        subtitle={`${cfg.name} exists to make high-yield rooftop solar boringly reliable — from subsidy paperwork to monsoon-ready cable routing.`}
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <Reveal>
          <article className="glass-panel rounded-3xl p-8">
            <h2 className="font-display text-2xl font-semibold text-white">Company intro</h2>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Born out of Vadodara&apos;s industrial belt, we started as a small commissioning crew helping factories
              fix underperforming arrays. Today we design and deploy residential, commercial, and institutional systems
              across Western India — with the same obsession for string-level performance.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Our studio near L &amp; T Circle on New VIP Road anchors project management, procurement QA, and customer
              success — while field teams operate with standardised checklists so every rooftop feels predictably premium.
            </p>
          </article>
        </Reveal>
        <Reveal delay={90}>
          <article className="glass-panel rounded-3xl p-8">
            <h2 className="font-display text-2xl font-semibold text-white">Mission & vision</h2>
            <p className="mt-4 text-sm font-semibold text-primary">Mission</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Accelerate India&apos;s distributed solar adoption by pairing transparent economics with workmanship that
              survives heat, dust, and DISCOM timelines.
            </p>
            <p className="mt-4 text-sm font-semibold text-secondary">Vision</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              A grid where every viable rooftop — homes, MSMEs, schools — can export clean electrons without fearing
              hidden costs or warranty dead-ends.
            </p>
          </article>
        </Reveal>
      </div>

      <Reveal className="mt-10">
        <article className="glass-panel rounded-3xl p-8">
          <h2 className="font-display text-2xl font-semibold text-white">Clean energy for India</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            India&apos;s solar story is not only about utility-scale parks — it is about millions of rooftops that can
            shave peak demand, defer costly transmission upgrades, and give families predictable bills. We focus on
            Gujarat and neighbouring states because proximity lets us respond quickly when inverters throw faults during
            a May heatwave.
          </p>
          <ul className="mt-6 grid gap-3 text-sm text-muted sm:grid-cols-2">
            <li className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">Net metering expertise with PGVCL, MGVCL, UGVCL, DGVCL workflows</li>
            <li className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">Subsidy documentation packs ready for portal submissions</li>
            <li className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">Safety culture aligned to CEA rooftop guidelines</li>
            <li className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">Monitoring partners for fleet-level visibility</li>
          </ul>
        </article>
      </Reveal>
    </div>
  );
}
