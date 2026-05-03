import type { Metadata } from "next";
import { ContactForm } from "@/components/forms/ContactForm";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";
import { getSiteConfig } from "@/lib/get-site-config";

export async function generateMetadata(): Promise<Metadata> {
  const cfg = await getSiteConfig();
  return {
    title: "Contact",
    description: `Contact ${cfg.name} for solar installation in Gujarat — studio address, phone, email, and map.`,
  };
}

const defaultMapSrc =
  "https://maps.google.com/maps?q=C-22+Dhanlaxmi+Society+New+Vip+Road+Karelibaug+Vadodara+390018&z=15&ie=UTF8&iwloc=&output=embed";

export default async function ContactPage() {
  const cfg = await getSiteConfig();
  const mapSrc = cfg.mapEmbedUrl?.trim() || defaultMapSrc;
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Visit / call"
        title="We’re easy to reach from Gift City to Surat"
        subtitle="Walk-ins by appointment — bring recent bills and roof photos if you can."
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <Reveal>
          <div className="glass-panel space-y-6 rounded-3xl p-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Address</p>
              <p className="mt-2 text-sm text-white">
                {cfg.address.line1}
                <br />
                {cfg.address.line2}
                <br />
                {cfg.address.city}, {cfg.address.state} {cfg.address.pin}
                <br />
                {cfg.address.country}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Phone</p>
                <a className="mt-2 block text-sm font-semibold text-primary hover:underline" href={`tel:${cfg.phoneTel}`}>
                  {cfg.phoneDisplay}
                </a>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Email</p>
                <a className="mt-2 block text-sm font-semibold text-primary hover:underline" href={`mailto:${cfg.email}`}>
                  {cfg.email}
                </a>
              </div>
            </div>
            <p className="text-xs text-muted">{cfg.hours}</p>
          </div>
        </Reveal>

        <Reveal delay={80}>
          <ContactForm />
        </Reveal>
      </div>

      <Reveal className="mt-10">
        <div className="overflow-hidden rounded-3xl border border-white/10 shadow-[0_0_60px_rgba(255,106,0,0.12)]">
          <iframe
            title={`${cfg.name} on Google Maps`}
            src={mapSrc}
            className="h-[320px] w-full bg-black sm:h-[380px]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      </Reveal>
    </div>
  );
}
