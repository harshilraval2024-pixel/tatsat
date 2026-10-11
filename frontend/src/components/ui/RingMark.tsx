/**
 * Segmented "power ring" artwork modelled on the Tatsat logo: concentric bands of
 * broken arcs in yellow / orange / deep red around a solid golden core.
 * Each band rotates at its own pace and direction. Decorative only (aria-hidden).
 */

const Y = "#ffd21f";
const O = "#ff8a00";
const D = "#f2530a";
const R = "#c21a0a";

type Seg = [start: number, sweep: number, color: string];
type Band = { r: number; w: number; dur: number; rev?: boolean; segs: Seg[] };

// Angles in degrees (0 = 3 o'clock, clockwise). Gaps between segments are intentional.
const BANDS: Band[] = [
  {
    r: 276, w: 6, dur: 120, rev: true,
    segs: [[10, 62, Y], [88, 40, O], [140, 84, Y], [240, 30, D], [286, 58, O]],
  },
  {
    r: 252, w: 18, dur: 84,
    segs: [[0, 78, Y], [92, 46, O], [150, 60, D], [222, 40, Y], [276, 70, O]],
  },
  {
    r: 226, w: 8, dur: 64, rev: true,
    segs: [[20, 56, R], [92, 70, Y], [176, 38, O], [232, 66, Y], [310, 36, R]],
  },
  {
    r: 204, w: 20, dur: 52,
    segs: [[6, 50, O], [70, 82, Y], [168, 44, D], [226, 76, O], [316, 30, Y]],
  },
  {
    r: 176, w: 7, dur: 40, rev: true,
    segs: [[0, 90, Y], [104, 48, R], [168, 74, O], [256, 40, Y], [310, 36, D]],
  },
  {
    r: 154, w: 14, dur: 34,
    segs: [[30, 64, D], [110, 70, Y], [196, 54, O], [264, 82, Y]],
  },
  {
    r: 128, w: 6, dur: 28, rev: true,
    segs: [[0, 100, Y], [120, 80, O], [220, 110, Y]],
  },
];

function pt(r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [300 + r * Math.cos(a), 300 + r * Math.sin(a)];
}

function arc(r: number, start: number, sweep: number): string {
  const [x1, y1] = pt(r, start);
  const [x2, y2] = pt(r, start + sweep);
  const large = sweep > 180 ? 1 : 0;
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

export function RingMark({
  className = "",
  core = true,
  animate = true,
}: {
  className?: string;
  /** Draw the golden centre disc with the brand lightning "T". */
  core?: boolean;
  animate?: boolean;
}) {
  return (
    <svg viewBox="0 0 600 600" className={className} aria-hidden>
      <defs>
        <radialGradient id="ring-core" cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor="#ffe455" />
          <stop offset="0.7" stopColor="#ffc400" />
          <stop offset="1" stopColor="#ffa800" />
        </radialGradient>
      </defs>

      {BANDS.map((b, i) => (
        <g
          key={i}
          className={animate ? "hero-ring" : undefined}
          style={
            animate
              ? {
                  animation: `spin-slow ${b.dur}s linear infinite${b.rev ? " reverse" : ""}`,
                  transformOrigin: "300px 300px",
                  transformBox: "view-box",
                }
              : undefined
          }
        >
          {b.segs.map(([s, sw, c], j) => (
            <path key={j} d={arc(b.r, s, sw)} stroke={c} strokeWidth={b.w} fill="none" strokeLinecap="butt" />
          ))}
        </g>
      ))}

      {core ? (
        <g>
          <circle cx="300" cy="300" r="104" fill="none" stroke="#c21a0a" strokeWidth="3" strokeOpacity="0.55" />
          <circle cx="300" cy="300" r="96" fill="url(#ring-core)" />
          {/* lightning "T" mark */}
          <path
            d="M246 252h112l-12 28h-28l26 20-60 64 12-48-28-14 14-48z"
            fill="#fff"
          />
        </g>
      ) : null}
    </svg>
  );
}
