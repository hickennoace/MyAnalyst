// Shared "not financial / investment advice" disclaimer. MyAnalyst surfaces statistics and
// forecasts that can look like guidance, so we make it explicit wherever analysis is shown:
// `banner` sits inside the dashboard (and is kept in PNG/PDF exports), `line` goes in footers.

export const DISCLAIMER_TEXT =
  "MyAnalyst is not financial or investment advice. These figures, forecasts, and insights are generated automatically from your data and may be incomplete or wrong — verify everything with a qualified professional before acting on it.";

export function Disclaimer({ variant = "banner" }: { variant?: "banner" | "line" }) {
  if (variant === "line") {
    return <>{DISCLAIMER_TEXT}</>;
  }
  return (
    <div className="card flex gap-3 border-amber-500/30 bg-amber-500/[0.06] p-4">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-0.5 h-5 w-5 shrink-0 text-amber-400"
        aria-hidden
      >
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
      <p className="text-xs leading-relaxed text-amber-200/90">
        <span className="font-semibold text-amber-200">Not financial or investment advice.</span>{" "}
        These figures, forecasts, and insights are generated automatically from your data and may be
        incomplete or wrong — verify everything with a qualified professional before acting on it.
      </p>
    </div>
  );
}
