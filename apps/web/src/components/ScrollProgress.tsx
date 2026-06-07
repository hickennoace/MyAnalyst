"use client";

import { useEffect, useState } from "react";

// A thin gradient bar pinned to the top of the viewport that fills as you scroll the page. Uses a
// scaleX transform (no layout/paint thrash) and coalesces scroll events through requestAnimationFrame.
export function ScrollProgress() {
  const [p, setP] = useState(0);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      setP(max > 0 ? Math.min(1, el.scrollTop / max) : 0);
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return <div className="scroll-progress" style={{ transform: `scaleX(${p})` }} aria-hidden />;
}
