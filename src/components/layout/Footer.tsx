import Link from "next/link";
import { navLinks, site } from "@/lib/site";
import { Logo } from "@/components/Logo";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-white/10 bg-bg-elevated/80">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.2fr_1fr_1fr] lg:px-8">
        <div className="space-y-4">
          <Logo className="h-12 w-12" withWordmark />
          <p className="max-w-sm text-sm text-muted">{site.description}</p>
          <p className="text-xs uppercase tracking-[0.22em] text-secondary">{site.tagline}</p>
        </div>

        <div>
          <p className="font-display text-sm font-semibold text-white">Explore</p>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            {navLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-primary">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="font-display text-sm font-semibold text-white">Contact</p>
          <ul className="mt-4 space-y-3 text-sm text-muted">
            <li>
              <span className="block text-xs uppercase tracking-wide text-white/60">Phone</span>
              <a href={`tel:${site.phoneTel}`} className="hover:text-primary">
                {site.phoneDisplay}
              </a>
            </li>
            <li>
              <span className="block text-xs uppercase tracking-wide text-white/60">Email</span>
              <a href={`mailto:${site.email}`} className="hover:text-primary">
                {site.email}
              </a>
            </li>
            <li>
              <span className="block text-xs uppercase tracking-wide text-white/60">Studio</span>
              <span>
                {site.address.line1}, {site.address.line2}
                <br />
                {site.address.city}, {site.address.state} {site.address.pin}
              </span>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/5 py-6 text-center text-xs text-muted">
        © {new Date().getFullYear()} {site.name}. Crafted for high-yield solar in India.
      </div>
    </footer>
  );
}
