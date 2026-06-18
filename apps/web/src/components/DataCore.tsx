// Animated data-analysis centerpiece for the cinematic hero — a glowing 3D-ish
// bar-chart "core" on a reflective platform, ringed by orbiting data nodes, with
// a sweeping scan line and a self-drawing trend curve. This is the data-themed
// stand-in for the hero subject (the car) in the reference design.
//
// Pure SVG + CSS (animations live in globals.css under the `.cine` scope) so it
// stays crisp at any size, needs no JS, and goes still under prefers-reduced-motion.

const BARS = [
  { h: 96, hue: 0.15 },
  { h: 150, hue: 0.35 },
  { h: 124, hue: 0.25 },
  { h: 196, hue: 0.6 },
  { h: 168, hue: 0.45 },
  { h: 224, hue: 0.85 },
  { h: 142, hue: 0.3 },
];

// Orbiting nodes laid out on an ellipse (rx, ry) around the core center.
const ORBIT = Array.from({ length: 9 }, (_, i) => {
  const a = (i / 9) * Math.PI * 2;
  return { x: Math.cos(a) * 178, y: Math.sin(a) * 52, big: i % 3 === 0 };
});

// Self-drawing trend curve threaded across the bar tops.
const TREND = "M 96 250 C 140 232, 168 196, 196 206 S 250 150, 286 120 S 330 168, 360 138";

export function DataCore({ className = "" }: { className?: string }) {
  const baseY = 300; // platform line
  const x0 = 96; // first bar x
  const gap = 44; // bar pitch
  const bw = 30; // bar width

  return (
    <div className={`cine-core ${className}`} aria-hidden>
      <svg viewBox="0 0 460 400" className="cine-core-svg" role="img" aria-label="Animated data analysis visualization">
        <defs>
          <linearGradient id="cBar" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#b31d1d" />
            <stop offset="0.55" stopColor="#ff3b30" />
            <stop offset="1" stopColor="#ff8a4c" />
          </linearGradient>
          <linearGradient id="cBarSoft" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff7a45" stopOpacity="0.5" />
            <stop offset="1" stopColor="#ff3b30" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="cFloor" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ff4326" stopOpacity="0.45" />
            <stop offset="1" stopColor="#ff4326" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="cTrend" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ffb37a" />
            <stop offset="1" stopColor="#ff2d2d" />
          </linearGradient>
          <filter id="cGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Platform glow + reflective base */}
        <ellipse cx="230" cy={baseY} rx="210" ry="40" fill="url(#cFloor)" className="cine-floor" />
        <ellipse cx="230" cy={baseY} rx="186" ry="30" fill="none" stroke="rgba(255,90,60,0.35)" strokeWidth="1" />

        {/* Orbiting data ring (outer, slow) */}
        <g className="cine-orbit">
          <ellipse cx="230" cy={baseY - 64} rx="178" ry="52" fill="none" stroke="rgba(255,80,60,0.22)" strokeWidth="1" />
          {ORBIT.map((n, i) => (
            <circle
              key={i}
              cx={230 + n.x}
              cy={baseY - 64 + n.y}
              r={n.big ? 4 : 2.4}
              fill={n.big ? "#ffb37a" : "#ff5a3c"}
              className="cine-orbit-node"
            />
          ))}
        </g>

        {/* Reflection of the bars (mirrored + faded) */}
        <g className="cine-reflection">
          {BARS.map((b, i) => (
            <rect
              key={`r${i}`}
              x={x0 + i * gap}
              y={baseY}
              width={bw}
              height={b.h}
              rx="5"
              fill="url(#cBarSoft)"
              className="cine-bar"
              style={{ animationDelay: `${0.15 + i * 0.08}s`, ["--pulse-delay" as string]: `${1.1 + i * 0.08}s` }}
            />
          ))}
        </g>

        {/* The bars */}
        <g filter="url(#cGlow)">
          {BARS.map((b, i) => (
            <g key={i}>
              <rect
                x={x0 + i * gap}
                y={baseY - b.h}
                width={bw}
                height={b.h}
                rx="5"
                fill="url(#cBar)"
                className="cine-bar"
                style={{ animationDelay: `${0.15 + i * 0.08}s`, ["--pulse-delay" as string]: `${1.1 + i * 0.08}s` }}
              />
              {/* bright cap */}
              <rect
                x={x0 + i * gap}
                y={baseY - b.h}
                width={bw}
                height="4"
                rx="2"
                fill="#ffd9b0"
                className="cine-bar"
                style={{ animationDelay: `${0.15 + i * 0.08}s`, ["--pulse-delay" as string]: `${1.1 + i * 0.08}s` }}
              />
            </g>
          ))}
        </g>

        {/* Self-drawing trend curve over the tops */}
        <path d={TREND} fill="none" stroke="url(#cTrend)" strokeWidth="2.5" strokeLinecap="round" className="cine-trend" filter="url(#cGlow)" />

        {/* Inner counter-rotating ring */}
        <g className="cine-orbit-inner">
          <ellipse cx="230" cy={baseY - 40} rx="120" ry="34" fill="none" stroke="rgba(255,140,90,0.18)" strokeWidth="1" strokeDasharray="2 9" />
        </g>

        {/* Sweeping scan line */}
        <line x1="78" x2="382" y1="0" y2="0" stroke="rgba(255,160,110,0.7)" strokeWidth="1.5" className="cine-scan" />
      </svg>
    </div>
  );
}
