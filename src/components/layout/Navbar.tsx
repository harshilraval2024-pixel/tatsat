"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { navLinks, site } from "@/lib/site";
import { Logo } from "@/components/Logo";
import { GlowButton } from "@/components/ui/GlowButton";

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors ${
        scrolled
          ? "border-white/10 bg-bg/80 backdrop-blur-xl"
          : "border-transparent bg-gradient-to-b from-bg via-bg/90 to-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 focus-ring rounded-full">
          <Logo className="h-10 w-10 sm:h-11 sm:w-11" withWordmark />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3 py-2 text-sm font-medium transition hover:text-primary ${
                  active ? "text-primary" : "text-muted"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <a
            href={`tel:${site.phoneTel}`}
            className="text-sm font-semibold text-white/90 hover:text-primary"
          >
            {site.phoneDisplay}
          </a>
          <GlowButton href="/quote" variant="primary" className="px-5 py-2 text-xs uppercase tracking-wide">
            Get free quote
          </GlowButton>
        </div>

        <button
          type="button"
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white md:hidden"
          aria-expanded={open}
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="sr-only">Menu</span>
          <span
            className={`absolute block h-0.5 w-5 rounded-full bg-white transition ${open ? "translate-y-0 rotate-45" : "-translate-y-2"}`}
          />
          <span className={`absolute block h-0.5 w-5 rounded-full bg-white transition ${open ? "opacity-0" : "opacity-100"}`} />
          <span
            className={`absolute block h-0.5 w-5 rounded-full bg-white transition ${open ? "translate-y-0 -rotate-45" : "translate-y-2"}`}
          />
        </button>
      </div>

      {open ? (
        <div className="border-t border-white/10 bg-bg/95 px-4 py-4 backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-xl px-3 py-3 text-sm font-semibold text-white hover:bg-white/5"
              >
                {link.label}
              </Link>
            ))}
            <GlowButton href="/quote" variant="primary" className="mt-3 w-full justify-center">
              Get free quote
            </GlowButton>
            <a href={`tel:${site.phoneTel}`} className="mt-2 text-center text-sm font-semibold text-primary">
              Call {site.phoneDisplay}
            </a>
          </div>
        </div>
      ) : null}
    </header>
  );
}
