// Animated line-chart centerpiece for the cinematic hero - a self-drawing coral
// trend line over a glowing area fill, with data points that pop in along the
// curve, a pulsing leading point, a sweeping highlight, and a tracer dot that
// races along the line. Pure SVG + CSS (animations live in globals.css under the
// `.cine` scope) so it stays crisp at any size, needs no JS, and settles still
// under prefers-reduced-motion.

// Plot geometry (SVG user units).
const X0 = 54;
const X1 = 420;
const TOP = 72;
const BOTTOM = 300;
const SPAN = BOTTOM - TOP;

// Normalised series (0 = baseline, 1 = top) - an upward trend with a realistic dip.
const SERIES = [0.16, 0.44, 0.30, 0.68, 0.52, 0.9, 0.74];

const PTS: [number, number][] = SERIES.map((v, i) => [
  X0 + (i / (SERIES.length - 1)) * (X1 - X0),
  BOTTOM - v * SPAN,
]);

// Catmull-Rom → cubic-bezier smoothing so the line reads as a smooth curve.
function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return "";
  const d = [`M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d.push(`C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`);
  }
  return d.join(" ");
}

const LINE = smoothPath(PTS);
const AREA = `${LINE} L ${X1} ${BOTTOM} L ${X0} ${BOTTOM} Z`;

// Faint horizontal gridlines across the plot.
const GRID = [0.2, 0.4, 0.6, 0.8].map((g) => BOTTOM - g * SPAN);

export function DataCore({ className = "" }: { className?: string }) {
  return (
    <div className={`cine-core ${className}`} aria-hidden>
      <svg viewBox="0 0 460 360" className="cine-core-svg" role="img" aria-label="Animated line-chart visualization">
        <defs>
          <linearGradient id="cLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ff8a4c" />
            <stop offset="0.5" stopColor="#ff5740" />
            <stop offset="1" stopColor="#ff2d2d" />
          </linearGradient>
          <linearGradient id="cArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff5740" stopOpacity="0.42" />
            <stop offset="1" stopColor="#ff5740" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="cFloor" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ff4326" stopOpacity="0.4" />
            <stop offset="1" stopColor="#ff4326" stopOpacity="0" />
          </radialGradient>
          <filter id="cGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Baseline glow anchoring the chart */}
        <ellipse cx="237" cy={BOTTOM + 6} rx="205" ry="30" fill="url(#cFloor)" className="cine-floor" />

        {/* Faint plot grid */}
        <g className="cine-grid-lines">
          {GRID.map((y, i) => (
            <line key={i} x1={X0} x2={X1} y1={y} y2={y} stroke="rgba(220,70,40,0.14)" strokeWidth="1" strokeDasharray="2 7" />
          ))}
          <line x1={X0} x2={X1} y1={BOTTOM} y2={BOTTOM} stroke="rgba(220,60,40,0.4)" strokeWidth="1.2" />
          <line x1={X0} x2={X0} y1={TOP - 6} y2={BOTTOM} stroke="rgba(220,60,40,0.28)" strokeWidth="1.2" />
        </g>

        {/* Area fill under the line (fades in as the line draws) */}
        <path d={AREA} fill="url(#cArea)" className="cine-area" />

        {/* The self-drawing trend line */}
        <path
          d={LINE}
          pathLength={1}
          fill="none"
          stroke="url(#cLine)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="cine-line"
          filter="url(#cGlow)"
        />

        {/* Tracer dot racing along the line */}
        <g className="cine-tracer">
          <circle r="5.5" fill="#fff2e6" stroke="#ff3b30" strokeWidth="1.5">
            <animateMotion dur="3.2s" repeatCount="indefinite" rotate="0" path={LINE} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
          </circle>
        </g>

        {/* Data points pop in along the curve; the last one keeps pulsing */}
        {PTS.map(([x, y], i) => {
          const last = i === PTS.length - 1;
          return (
            <g key={i}>
              <circle
                cx={x}
                cy={y}
                r={last ? 5 : 3.6}
                fill={last ? "#ff3b30" : "#fff2e6"}
                stroke="#ff5740"
                strokeWidth="1.6"
                className={`cine-dot${last ? " cine-dot-lead" : ""}`}
                style={{ ["--dot-delay" as string]: `${0.9 + i * 0.18}s` }}
              />
            </g>
          );
        })}

        {/* Sweeping highlight line */}
        <line x1={X0} x2={X0} y1={TOP - 8} y2={BOTTOM} stroke="rgba(255,140,90,0.5)" strokeWidth="1.5" className="cine-sweep" />
      </svg>
    </div>
  );
}
