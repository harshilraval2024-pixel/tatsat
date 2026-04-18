import type { Metadata } from "next";
import { Manrope, Syne } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { WhatsAppFloat } from "@/components/WhatsAppFloat";
import { Providers } from "./providers";
import { site } from "@/lib/site";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  icons: {
    icon: [{ url: "/tatsat-mark.png", type: "image/png", sizes: "760x760" }],
    shortcut: "/tatsat-mark.png",
    apple: "/tatsat-mark.png",
  },
  title: {
    default: `${site.name} | ${site.tagline}`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  keywords: [
    "solar panels India",
    "Gujarat solar installation",
    "rooftop solar Ahmedabad",
    "net metering",
    "solar subsidy",
    site.name,
  ],
  openGraph: {
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
    url: site.url,
    siteName: site.name,
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark h-full ${manrope.variable} ${syne.variable}`}>
      <body className="flex min-h-full flex-col font-sans antialiased">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
        <WhatsAppFloat />
        <Providers />
      </body>
    </html>
  );
}
