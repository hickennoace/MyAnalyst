// MyAnalyst logomark - an inline, coral SVG so it stays razor-sharp at every size,
// recolors with the brand, and costs no network request. A glossy coral app-tile
// holds a rising trend line with an up-right arrow and data points, echoing the
// hero's animated line chart. `className` controls the size (square).
//
// Gradient/clip ids are shared across instances on purpose: every mark is identical
// and gradients use objectBoundingBox units, so a single definition renders correctly
// at any size - keeping this a hook-free server component.
export function BrandMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="MyAnalyst logo"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="bmFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff7a4d" />
          <stop offset="0.5" stopColor="#ff5740" />
          <stop offset="1" stopColor="#f0271b" />
        </linearGradient>
        <linearGradient id="bmGloss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <clipPath id="bmClip">
          <rect x="0" y="0" width="48" height="48" rx="11.5" ry="11.5" />
        </clipPath>
      </defs>

      {/* Tile + top sheen */}
      <g clipPath="url(#bmClip)">
        <rect x="0" y="0" width="48" height="48" fill="url(#bmFill)" />
        <rect x="0" y="0" width="48" height="48" fill="url(#bmGloss)" />
        {/* Soft area under the trend line */}
        <path d="M11 31.5 L19 25.5 L25 28.5 L33 18 L38.5 13.5 L38.5 34 L11 34 Z" fill="#ffffff" fillOpacity="0.13" />
      </g>

      {/* Crisp inner hairline for definition on light surfaces */}
      <rect x="0.75" y="0.75" width="46.5" height="46.5" rx="10.9" ry="10.9" fill="none" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="1" />

      {/* Rising trend line */}
      <path
        d="M11 31.5 L19 25.5 L25 28.5 L33 18 L38.5 13.5"
        fill="none"
        stroke="#ffffff"
        strokeWidth="3.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Up-right arrowhead */}
      <path
        d="M32.5 13.5 L38.5 13.5 L38.5 19.5"
        fill="none"
        stroke="#ffffff"
        strokeWidth="3.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Data points */}
      <circle cx="19" cy="25.5" r="1.85" fill="#ffffff" />
      <circle cx="25" cy="28.5" r="1.85" fill="#ffffff" />
      <circle cx="33" cy="18" r="1.85" fill="#ffffff" />
    </svg>
  );
}
