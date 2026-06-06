"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// Counts a KPI value up from zero on mount (e.g. "$333,810", "133.3%", "5,305"), preserving any
// currency prefix and %/unit suffix. Non-numeric values render instantly. Respects reduced-motion.

function parse(value: string | number): { prefix: string; num: number; suffix: string; decimals: number } | null {
  const s = String(value);
  const m = s.match(/^([^\d-]*)(-?[\d,]*\.?\d+)(.*)$/);
  if (!m) return null;
  const numStr = m[2].replace(/,/g, "");
  const num = Number(numStr);
  if (!Number.isFinite(num)) return null;
  const decimals = (numStr.split(".")[1] || "").length;
  return { prefix: m[1], num, suffix: m[3], decimals };
}

export function AnimatedValue({ value }: { value: string | number }) {
  const parsed = useMemo(() => parse(value), [value]);
  const [display, setDisplay] = useState<string>(() => (parsed ? format(parsed, 0) : String(value)));
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!parsed) {
      setDisplay(String(value));
      return;
    }
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDisplay(format(parsed, parsed.num));
      return;
    }
    const start = performance.now();
    const duration = 900;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(format(parsed, parsed.num * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [parsed, value]);

  return <>{display}</>;
}

function format(p: { prefix: string; suffix: string; decimals: number }, n: number): string {
  return (
    p.prefix +
    new Intl.NumberFormat("en-US", { minimumFractionDigits: p.decimals, maximumFractionDigits: p.decimals }).format(n) +
    p.suffix
  );
}
