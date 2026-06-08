"use client";

import { motion, useReducedMotion } from "framer-motion";

// Reveals its children with a physics-based fade-up the first time they scroll into view.
// Framer Motion handles the IntersectionObserver (whileInView + viewport once) and a spring settle;
// reduced-motion users get the content immediately with no transform.
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  /** Stagger offset in milliseconds (kept for API compatibility with the old component). */
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ type: "spring", stiffness: 120, damping: 20, delay: delay / 1000 }}
    >
      {children}
    </motion.div>
  );
}
