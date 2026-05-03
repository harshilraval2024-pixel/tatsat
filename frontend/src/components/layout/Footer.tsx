import Link from "next/link";
import { navLinks } from "@/lib/site";
import { Logo } from "@/components/Logo";
import { getSiteConfig } from "@/lib/get-site-config";

export async function Footer() {
  const cfg = await getSiteConfig();
  return (
    <footer className="mt-20 border-t border-white/10 bg-bg-elevated/80">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.2fr_1fr_1fr] lg:px-8">
        <div className="space-y-4">
          <Logo className="h-12 w-12" withWordmark />
          <p className="max-w-sm text-sm text-muted">{cfg.description}</p>
          <p className="text-xs uppercase tracking-[0.22em] text-secondary">{cfg.tagline}</p>
          {(cfg.social.facebook || cfg.social.instagram || cfg.social.linkedin || cfg.social.youtube) && (
            <div className="flex flex-wrap gap-3 text-xs">
              {cfg.social.facebook ? (
                <a href={cfg.social.facebook} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Facebook
                </a>
              ) : null}
              {cfg.social.instagram ? (
                <a href={cfg.social.instagram} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Instagram
                </a>
              ) : null}
              {cfg.social.linkedin ? (
                <a href={cfg.social.linkedin} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  LinkedIn
                </a>
              ) : null}
              {cfg.social.youtube ? (
                <a href={cfg.social.youtube} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  YouTube
                </a>
              ) : null}
            </div>
          )}
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
              <a href={`tel:${cfg.phoneTel}`} className="hover:text-primary">
                {cfg.phoneDisplay}
              </a>
            </li>
            <li>
              <span className="block text-xs uppercase tracking-wide text-white/60">Email</span>
              <a href={`mailto:${cfg.email}`} className="hover:text-primary">
                {cfg.email}
              </a>
            </li>
            <li>
              <span className="block text-xs uppercase tracking-wide text-white/60">Studio</span>
              <span>
                {cfg.address.line1}, {cfg.address.line2}
                <br />
                {cfg.address.city}, {cfg.address.state} {cfg.address.pin}
              </span>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/5 py-6 text-center text-xs text-muted">
        © {new Date().getFullYear()} {cfg.name}. Crafted for high-yield solar in India.
      </div>
    </footer>
  );
}
