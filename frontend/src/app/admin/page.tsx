import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";
import { getSiteConfig } from "@/lib/get-site-config";

export async function generateMetadata(): Promise<Metadata> {
  const cfg = await getSiteConfig();
  return {
    title: "Staff dashboard",
    robots: { index: false, follow: false },
    description: `Internal pricing and leads — ${cfg.name}.`,
  };
}

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <SectionHeading
        align="center"
        eyebrow="Internal"
        title="Staff dashboard"
        subtitle="Sign in to adjust site contact details, pricing, subsidies, location multipliers, and export leads. JWT is stored in this browser only."
      />
      <Reveal>
        <AdminDashboard />
      </Reveal>
    </div>
  );
}
