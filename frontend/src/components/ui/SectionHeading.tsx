import { Reveal } from "./Reveal";

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
};

export function SectionHeading({ eyebrow, title, subtitle, align = "left" }: SectionHeadingProps) {
  const alignCls = align === "center" ? "text-center mx-auto" : "";

  return (
    <Reveal className={`mb-10 max-w-2xl space-y-3 ${alignCls}`}>
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-secondary">{eyebrow}</p>
      ) : null}
      <h2 className="font-display text-3xl font-semibold text-white sm:text-4xl">{title}</h2>
      {subtitle ? <p className="text-base text-muted">{subtitle}</p> : null}
    </Reveal>
  );
}
