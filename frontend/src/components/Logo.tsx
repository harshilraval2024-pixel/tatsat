import Image from "next/image";

type LogoProps = {
  className?: string;
  withWordmark?: boolean;
};

export function Logo({ className = "h-10 w-10 sm:h-11 sm:w-11", withWordmark }: LogoProps) {
  return (
    <span className="inline-flex items-center gap-3">
      <Image
        src="/tatsat-mark.png"
        alt="Tatsat NRGS"
        width={760}
        height={760}
        priority
        className={`rounded-2xl object-contain ${className}`}
      />
      {withWordmark ? (
        <span className="flex flex-col leading-tight">
          <span className="font-display text-lg font-semibold tracking-tight text-white">Tatsat NRGS</span>
          <span className="text-xs font-medium uppercase tracking-[0.22em] text-primary">Potential Power</span>
        </span>
      ) : null}
    </span>
  );
}
