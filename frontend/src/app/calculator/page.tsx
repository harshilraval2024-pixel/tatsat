import type { Metadata } from "next";
import { SolarCalculatorForm } from "@/components/calculator/SolarCalculatorForm";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";
import { getSiteConfig } from "@/lib/get-site-config";

export async function generateMetadata(): Promise<Metadata> {
  const cfg = await getSiteConfig();
  return {
    title: "Solar cost calculator",
    description: `Estimate rooftop system size and indicative pricing for your state — ${cfg.name}.`,
  };
}

export default function CalculatorPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <SectionHeading
        align="center"
        eyebrow="Instant estimate"
        title="Solar calculator"
        subtitle="Enter your bill or monthly units, state, and roof type. We model indicative system size, subsidy, and payable cost using live rules from our API."
      />
      <Reveal>
        <SolarCalculatorForm />
      </Reveal>
    </div>
  );
}
