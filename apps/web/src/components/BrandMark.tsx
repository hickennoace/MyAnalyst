// Lumora logomark — a rounded gradient tile with three ascending data bars and a
// spark, fusing "analytics" with the brand's light/clarity theme. Self-contained
// (own gradient + colors), so it looks right on both light and dark surfaces.
export function BrandMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} role="img" aria-label="Lumora logo">
      <defs>
        <linearGradient id="lumora-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="0.55" stopColor="#7c3aed" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="8.5" fill="url(#lumora-grad)" />
      <g fill="#ffffff">
        <rect x="7.6" y="18" width="3.4" height="6.6" rx="1.3" opacity="0.85" />
        <rect x="13" y="13.4" width="3.4" height="11.2" rx="1.3" opacity="0.93" />
        <rect x="18.4" y="9.4" width="3.4" height="15.2" rx="1.3" />
        {/* insight spark above the tallest bar */}
        <path d="M24 5.4 L24.9 7.5 L27 8.4 L24.9 9.3 L24 11.4 L23.1 9.3 L21 8.4 L23.1 7.5 Z" />
      </g>
    </svg>
  );
}
