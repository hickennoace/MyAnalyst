"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";

// Orchestrated entrance primitives built on Framer Motion. `Stagger` is a container whose `StaggerItem`
// children cascade in (spring settle); `Float` adds a gentle, premium idle bob. All respect
// prefers-reduced-motion (render statically, no transform, no infinite loops).

const container: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.04 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 130, damping: 18 } },
};

/**
 * Container that cascades its `StaggerItem` children. `mount` animates immediately on load (good for
 * above-the-fold heroes); otherwise it triggers when scrolled into view.
 */
export function Stagger({
  children,
  className = "",
  mount = false,
  amount = 0.2,
}: {
  children: React.ReactNode;
  className?: string;
  mount?: boolean;
  amount?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      variants={container}
      initial="hidden"
      {...(mount ? { animate: "visible" } : { whileInView: "visible", viewport: { once: true, amount } })}
    >
      {children}
    </motion.div>
  );
}

/** A single cascading child inside a `Stagger`. */
export function StaggerItem({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={item}>
      {children}
    </motion.div>
  );
}

/** A gentle, slow idle bob — used to give the hero panel a sense of weightless life. */
export function Float({
  children,
  className = "",
  distance = 8,
  duration = 6,
}: {
  children: React.ReactNode;
  className?: string;
  distance?: number;
  duration?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      animate={{ y: [0, -distance, 0] }}
      transition={{ duration, ease: "easeInOut", repeat: Infinity }}
    >
      {children}
    </motion.div>
  );
}
