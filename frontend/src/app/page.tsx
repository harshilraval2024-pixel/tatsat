import { Hero } from "@/components/home/Hero";
import { KeyStats } from "@/components/home/KeyStats";
import { ServicesOverview } from "@/components/home/ServicesOverview";
import { WhyChooseUs } from "@/components/home/WhyChooseUs";
import { ProcessSection } from "@/components/home/ProcessSection";
import { Testimonials } from "@/components/home/Testimonials";
import { CtaBanner } from "@/components/home/CtaBanner";
import { QuoteForm } from "@/components/forms/QuoteForm";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";

export default function HomePage() {
  return (
    <>
      <Hero />
      <KeyStats />
      <ServicesOverview />
      <WhyChooseUs />
      <ProcessSection />
      <Testimonials />
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <SectionHeading
          align="center"
          eyebrow="Fast response"
          title="Tell us about your roof — we reply same day"
          subtitle="Upload your bill so we can model savings accurately for your DISCOM slab."
        />
        <Reveal>
          <QuoteForm />
        </Reveal>
      </section>
      <CtaBanner />
    </>
  );
}
