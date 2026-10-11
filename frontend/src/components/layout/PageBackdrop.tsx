import { RingMark } from "@/components/ui/RingMark";

/** Fixed, faint logo-style rings behind every page (both themes). */
export function PageBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-20 overflow-hidden" aria-hidden>
      <RingMark
        core={false}
        className="absolute -right-[22%] -top-[18%] h-[820px] w-[820px] opacity-[0.10] sm:-right-[10%] sm:h-[980px] sm:w-[980px]"
      />
      <RingMark
        core={false}
        className="absolute -bottom-[26%] -left-[24%] h-[760px] w-[760px] opacity-[0.08] sm:-left-[12%] sm:h-[880px] sm:w-[880px]"
      />
    </div>
  );
}
