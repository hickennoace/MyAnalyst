"use client";

import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "framer-motion";

// Wraps an element with a spring-smoothed 3D tilt that tracks the pointer, plus a soft highlight that
// follows the cursor (via the --mx/--my CSS vars the panel styles read). Framer Motion springs make the
// tilt feel weighted instead of instant. Respects prefers-reduced-motion (stays flat).
export function Tilt({
  children,
  max = 7,
  className = "",
}: {
  children: React.ReactNode;
  max?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  // -0.5..0.5 pointer position, spring-smoothed, mapped to rotation degrees.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 150, damping: 18, mass: 0.5 });
  const sy = useSpring(py, { stiffness: 150, damping: 18, mass: 0.5 });
  const rotateY = useTransform(sx, (v) => v * max);
  const rotateX = useTransform(sy, (v) => -v * max);

  function onMove(e: React.PointerEvent) {
    const el = ref.current;
    if (!el || reduce) return;
    const r = el.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;
    px.set(nx);
    py.set(ny);
    el.style.setProperty("--mx", `${((nx + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${((ny + 0.5) * 100).toFixed(1)}%`);
  }

  function onLeave() {
    px.set(0);
    py.set(0);
  }

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ rotateX, rotateY, transformPerspective: 1000 }}
      className={`will-change-transform ${className}`}
    >
      {children}
    </motion.div>
  );
}
