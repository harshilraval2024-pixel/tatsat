import type { Metadata } from "next";
import { Manrope, Syne } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { WhatsAppFloat } from "@/components/WhatsAppFloat";
import { Providers } from "./providers";
import { site } from "@/lib/site";
import { getSiteConfig } from "@/lib/get-site-config";
import { SiteConfigProvider } from "@/components/SiteConfigProvider";
import { siteConfigProviderKey } from "@/lib/site-config";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
});

function safeMetadataBase(url: string): URL {
  try {
    const u = new URL(url);
    if (u.protocol === "http:" || u.protocol === "https:") return u;
  } catch {
    /* fall through */
  }
  return new URL(site.url);
}

export async function generateMetadata(): Promise<Metadata> {
  const cfg = await getSiteConfig();
  const base = safeMetadataBase(cfg.url);
  return {
    metadataBase: base,
    icons: {
      icon: [{ url: "/tatsat-mark.png", type: "image/png", sizes: "760x760" }],
      shortcut: "/tatsat-mark.png",
      apple: "/tatsat-mark.png",
    },
    title: {
      default: `${cfg.name} | ${cfg.tagline}`,
      template: `%s | ${cfg.name}`,
    },
    description: cfg.description,
    keywords: [
      "solar panels India",
      "Gujarat solar installation",
      "rooftop solar Ahmedabad",
      "net metering",
      "solar subsidy",
      cfg.name,
    ],
    openGraph: {
      title: `${cfg.name} — ${cfg.tagline}`,
      description: cfg.description,
      url: cfg.url,
      siteName: cfg.name,
      locale: "en_IN",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${cfg.name} — ${cfg.tagline}`,
      description: cfg.description,
    },
    robots: { index: true, follow: true },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cfg = await getSiteConfig();
  return (
    <html lang="en" className={`dark h-full ${manrope.variable} ${syne.variable}`}>
      <body className="flex min-h-full flex-col font-sans antialiased">
        <SiteConfigProvider key={siteConfigProviderKey(cfg)} initial={cfg}>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
          <WhatsAppFloat />
          <Providers />
        </SiteConfigProvider>
      </body>
    </html>
  );
}
