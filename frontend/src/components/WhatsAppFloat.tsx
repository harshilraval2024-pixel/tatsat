"use client";

import { useSiteConfig } from "@/components/SiteConfigProvider";

export function WhatsAppFloat() {
  const cfg = useSiteConfig();
  const href = `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(
    `Hi ${cfg.name}, I’d like a free solar quote for my property in `,
  )}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-2xl shadow-[0_0_40px_rgba(37,211,102,0.45)] ring-2 ring-white/20 transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#25D366]"
      aria-label="Chat on WhatsApp"
    >
      <span aria-hidden>💬</span>
    </a>
  );
}
