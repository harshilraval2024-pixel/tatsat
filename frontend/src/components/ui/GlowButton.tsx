import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "ghost" | "outline";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold tracking-wide transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50";

const styles: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-primary via-secondary to-accent text-black shadow-[0_0_32px_rgba(255,106,0,0.35)] hover:brightness-110 active:scale-[0.99]",
  ghost: "bg-white/5 text-white ring-1 ring-white/10 hover:bg-white/10 hover:ring-primary/40",
  outline:
    "border border-primary/50 bg-transparent text-primary hover:bg-primary/10 hover:shadow-[0_0_24px_rgba(255,208,0,0.25)]",
};

type GlowButtonAsLink = {
  variant?: Variant;
  href: string;
  children: ReactNode;
  className?: string;
};

type GlowButtonAsButton = {
  variant?: Variant;
  href?: undefined;
  children: ReactNode;
  className?: string;
} & Omit<ComponentProps<"button">, "className">;

export type GlowButtonProps = GlowButtonAsLink | GlowButtonAsButton;

export function GlowButton(props: GlowButtonProps) {
  const { variant = "primary", children, className = "" } = props;
  const cls = `${base} ${styles[variant]} ${className}`;

  if ("href" in props && props.href) {
    return (
      <Link href={props.href} className={cls}>
        {children}
      </Link>
    );
  }

  const { type = "button", ...buttonRest } = props as GlowButtonAsButton;
  return (
    <button type={type} className={cls} {...buttonRest}>
      {children}
    </button>
  );
}
