"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { navLinks } from "@/lib/site";
import { Logo } from "@/components/Logo";
import { GlowButton } from "@/components/ui/GlowButton";
import { useAdminSession } from "@/lib/use-admin-session";
import { useSiteConfig } from "@/components/SiteConfigProvider";

const linkBase =
  "rounded-full px-3 py-2 text-sm font-medium transition-colors duration-200 hover:text-primary";
const linkActive = "text-primary";
const linkIdle = "text-muted";

const staffPillBase =
  "rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors duration-200";

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const adminSession = useAdminSession();
  const siteCfg = useSiteConfig();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(false));
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors duration-300 ${
        scrolled
          ? "border-white/10 bg-bg/85 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl"
          : "border-transparent bg-gradient-to-b from-bg via-bg/92 to-transparent"
      }`}
    >
      {/* Large screens: balanced grid — logo | centered nav | actions */}
      <div className="relative mx-auto hidden max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-3 sm:px-6 lg:grid lg:px-8">
        <div className="flex min-w-0 justify-self-start">
          <Link href="/" className="focus-ring flex items-center gap-2 rounded-full">
            <Logo className="h-10 w-10 sm:h-11 sm:w-11" withWordmark />
          </Link>
        </div>

        <nav className="flex max-w-[min(100%,42rem)] flex-wrap items-center justify-center gap-x-0.5 gap-y-1 justify-self-center">
          {navLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`${linkBase} ${active ? linkActive : linkIdle}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex min-w-0 flex-shrink-0 items-center justify-end gap-2.5 sm:gap-3 justify-self-end">
          <Link
            href="/admin"
            aria-current={pathname === "/admin" ? "page" : undefined}
            className={`${staffPillBase} ${
              pathname === "/admin"
                ? "border-primary/60 bg-primary/10 text-primary"
                : adminSession
                  ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300/90 hover:border-emerald-400/50"
                  : "border-white/15 text-muted hover:border-primary/40 hover:text-primary"
            }`}
          >
            {adminSession ? "Dashboard" : "Staff"}
          </Link>
          <GlowButton
            href="/quote"
            variant="outline"
            className="shrink-0 border-primary/45 bg-primary/[0.07] px-5 py-2.5 text-sm font-semibold leading-none text-primary shadow-none ring-1 ring-inset ring-primary/25 transition hover:border-primary/70 hover:bg-primary/15 hover:text-white hover:shadow-[0_0_28px_rgba(255,106,0,0.22)] hover:ring-primary/40"
          >
            Get a quote
          </GlowButton>
        </div>
      </div>

      {/* Small / medium: logo + menu (phone is in drawer + footer, not in top bar) */}
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:hidden lg:px-8">
        <Link href="/" className="focus-ring flex min-w-0 items-center gap-2 rounded-full">
          <Logo className="h-10 w-10 shrink-0 sm:h-11 sm:w-11" withWordmark />
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition-colors hover:border-primary/30 hover:bg-white/10"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
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
      </div>

      {open ? (
        <div className="border-t border-white/10 bg-bg/95 px-4 py-5 backdrop-blur-xl lg:hidden">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Explore</p>
          <nav className="flex flex-col gap-0.5">
            {navLinks.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${
                    active ? "bg-primary/10 text-primary" : "text-white hover:bg-white/5"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="my-5 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Team</p>
          <Link
            href="/admin"
            className={`flex items-center justify-between rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${
              pathname === "/admin" ? "bg-primary/10 text-primary" : "text-white hover:bg-white/5"
            }`}
          >
            <span>{adminSession ? "Dashboard" : "Staff login"}</span>
            <span className="text-xs font-normal text-muted">{adminSession ? "Signed in" : "Internal"}</span>
          </Link>

          <GlowButton
            href="/quote"
            variant="primary"
            className="mt-5 w-full justify-center py-3.5 text-base font-semibold tracking-tight"
          >
            Get a quote
          </GlowButton>
          <a
            href={`tel:${siteCfg.phoneTel}`}
            className="mt-3 block rounded-xl border border-white/10 py-3 text-center text-sm font-semibold text-primary transition-colors hover:bg-white/5"
          >
            {siteCfg.phoneDisplay}
          </a>
        </div>
      ) : null}
    </header>
  );
}
