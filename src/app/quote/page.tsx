import type { Metadata } from "next";
import { QuoteForm } from "@/components/forms/QuoteForm";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Get a free quote",
  description: `Request a rooftop solar quote from ${site.name}. Upload your electricity bill for accurate savings modelling across Gujarat and India.`,
};

export default function QuotePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <SectionHeading
        align="center"
        eyebrow="Lead desk"
        title="Free quote — response within 24 hours"
        subtitle="We prioritise WhatsApp for speed, but our engineers will always call to validate technical assumptions."
      />
      <Reveal>
        <QuoteForm />
      </Reveal>
      <div className="mt-8 rounded-3xl border border-white/10 bg-bg-elevated/70 p-6 text-center text-sm text-muted">
        Prefer voice? Call{" "}
        <a className="font-semibold text-primary hover:underline" href={`tel:${site.phoneTel}`}>
          {site.phoneDisplay}
        </a>{" "}
        · {site.hours}
      </div>
    </div>
  );
}
