"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Renders children into <body>, escaping any ancestor that establishes a containing block for
// `position: fixed` (a transform/filter/animation on a parent - e.g. the page-transition wrapper - makes
// a "fixed" overlay anchor to that parent instead of the viewport, so modals drift to the page middle
// when scrolled). Portaling to body guarantees overlays center on the user's current viewport.
export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
