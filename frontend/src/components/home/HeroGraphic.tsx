import { RingMark } from "@/components/ui/RingMark";

/**
 * Decorative hero artwork for the Solar Light theme: a slowly counter-rotating,
 * segmented "power ring" mandala (echoing the Tatsat mark), flowing circuit lines
 * with pulsing nodes, and drifting sun particles. Purely visual (aria-hidden).
 */

const PARTICLES = [
  { l: "9%", t: "62%", s: 10, d: "0s" },
  { l: "18%", t: "20%", s: 7, d: "-3s" },
  { l: "30%", t: "78%", s: 6, d: "-6s" },
  { l: "47%", t: "12%", s: 8, d: "-2s" },
  { l: "62%", t: "86%", s: 9, d: "-8s" },
  { l: "78%", t: "10%", s: 6, d: "-5s" },
  { l: "88%", t: "70%", s: 11, d: "-1s" },
  { l: "94%", t: "34%", s: 7, d: "-9s" },
];

const LINES = [
  { side: "left-0", top: "27%", w: "22%", delay: "0s" },
  { side: "left-0", top: "48%", w: "14%", delay: "-1.4s" },
  { side: "right-0", top: "36%", w: "20%", delay: "-2.2s" },
  { side: "right-0", top: "62%", w: "26%", delay: "-0.8s" },
];

export function HeroGraphic() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
      {/* warm sun glow */}
      <div className="absolute -right-24 top-4 h-[640px] w-[640px] rounded-full bg-[radial-gradient(circle,rgba(255,208,0,0.30),rgba(255,138,0,0.10)_45%,transparent_70%)] blur-2xl" />

      {/* logo-style segmented ring mandala */}
      <RingMark className="absolute -right-32 top-[54%] h-[520px] w-[520px] -translate-y-1/2 opacity-35 sm:-right-12 sm:h-[680px] sm:w-[680px] sm:opacity-70 lg:-right-[7%]" />

      {/* flowing circuit lines with pulsing nodes */}
      {LINES.map((ln, i) => (
        <div
          key={i}
          className={`absolute ${ln.side} hidden items-center sm:flex ${ln.side === "right-0" ? "flex-row-reverse" : ""}`}
          style={{ top: ln.top, width: ln.w }}
        >
          <div className="circuit-line flex-1" style={{ animationDelay: ln.delay }} />
          <span className="circuit-node" style={{ animationDelay: ln.delay }} />
        </div>
      ))}

      {/* drifting sun particles */}
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="sun-particle opacity-70"
          style={{ left: p.l, top: p.t, width: p.s, height: p.s, animationDelay: p.d }}
        />
      ))}
    </div>
  );
}
