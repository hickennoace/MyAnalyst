// MyAnalyst logomark — an "A" (for Analyst) whose left side is a rising data line that climbs through
// its data points to a glowing insight node at the apex; a faint threshold crossbar ties the legs.
// Self-contained (own gradient + colors), so it looks right on both light and dark surfaces.
export function BrandMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} role="img" aria-label="MyAnalyst logo">
      <defs>
        <linearGradient id="myanalyst-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="0.55" stopColor="#7c3aed" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="8.5" fill="url(#myanalyst-grad)" />
      <g fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        {/* right leg of the A */}
        <path d="M16 6 L24 25.5" />
        {/* left side: a rising data line that climbs to the apex */}
        <path d="M8 25.5 L11.5 19 L14 21 L16 6" />
        {/* threshold crossbar */}
        <path d="M11.6 18.6 H20.6" strokeWidth="1.8" opacity="0.55" />
      </g>
      <g fill="#ffffff">
        {/* insight node at the apex */}
        <circle cx="16" cy="6" r="4" opacity="0.18" />
        <circle cx="16" cy="6" r="2" />
        {/* data points along the rising line */}
        <circle cx="8" cy="25.5" r="1" opacity="0.9" />
        <circle cx="11.5" cy="19" r="1.15" opacity="0.9" />
        <circle cx="14" cy="21" r="1" opacity="0.9" />
      </g>
    </svg>
  );
}
