"use client";

import { useEffect, useRef } from "react";

// Wraps an element so it gently follows the pointer when hovered (a "magnetic" pull), then springs
// back on leave. Pure CSS-transition smoothing + a transform write on move — no libraries. The wrapper
// is display:inline-block so it can hug a button/link. Respects prefers-reduced-motion (no-op).
export function Magnetic({
  children,
  strength = 0.35,
  className = "",
}: {
  children: React.ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useRef(false);

  useEffect(() => {
    reduce.current = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }, []);

  function onMove(e: React.PointerEvent) {
    const el = ref.current;
    if (!el || reduce.current) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - (r.left + r.width / 2)) * strength;
    const y = (e.clientY - (r.top + r.height / 2)) * strength;
    el.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
  }

  function onLeave() {
    const el = ref.current;
    if (el) el.style.transform = "";
  }

  return (
    <span
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`inline-block transition-transform duration-300 ease-out will-change-transform ${className}`}
    >
      {children}
    </span>
  );
}
