"use client";

// App Router template: unlike layout.tsx, this remounts on every navigation, so
// its enter animation replays each time you move between pages (e.g. clicking
// "Open the app"). Keeps things lightweight - pure CSS, respects reduced motion.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-transition">{children}</div>;
}
