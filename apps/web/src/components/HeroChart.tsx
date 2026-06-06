// Decorative, self-drawing line/area chart for the hero — signals "data analysis" at a glance.
// Pure SVG + CSS animation (no JS), respects prefers-reduced-motion via globals.css.

const PTS = [
  [20, 150], [70, 120], [120, 132], [170, 92], [220, 104],
  [270, 64], [320, 78], [370, 44], [420, 56], [470, 24],
];

export function HeroChart({ className = "" }: { className?: string }) {
  const line = PTS.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");
  const area = `${line} L 470 180 L 20 180 Z`;
  return (
    <svg viewBox="0 0 490 200" className={className} role="img" aria-label="Animated trend chart" fill="none">
      <defs>
        <linearGradient id="heroArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#818cf8" stopOpacity="0.45" />
          <stop offset="1" stopColor="#818cf8" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="heroStroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="0.5" stopColor="#818cf8" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>

      {/* soft gridlines */}
      {[40, 80, 120, 160].map((y) => (
        <line key={y} x1="20" y1={y} x2="470" y2={y} stroke="#1e293b" strokeWidth="1" strokeDasharray="4 6" />
      ))}

      <path d={area} fill="url(#heroArea)" opacity="0.9" />
      <path d={line} stroke="url(#heroStroke)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="hero-line" />

      {/* pulsing nodes */}
      {PTS.filter((_, i) => i % 3 === 0 || i === PTS.length - 1).map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="4.5" fill="#0b0f1a" stroke="#a78bfa" strokeWidth="2.5" className="hero-node" style={{ animationDelay: `${i * 0.4}s` }} />
      ))}

      {/* floating accent dots */}
      <circle cx="60" cy="40" r="3" fill="#22d3ee" className="hero-dot" />
      <circle cx="430" cy="150" r="2.5" fill="#a78bfa" className="hero-dot" style={{ animationDelay: "1.5s" }} />
      <circle cx="250" cy="30" r="2" fill="#818cf8" className="hero-dot" style={{ animationDelay: "2.5s" }} />
    </svg>
  );
}
