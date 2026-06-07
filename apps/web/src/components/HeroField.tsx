"use client";

import { useEffect, useRef } from "react";

// A lightweight, dependency-free animated "data network": drifting nodes connected by lines that
// react to the pointer (a gentle parallax wake). Pure Canvas 2D — no Three.js, no libraries.
//
// Performance guardrails:
//   • particle count scales with area but is hard-capped (cheap O(n²) link pass at n ≤ ~80)
//   • device-pixel-ratio clamped to 2
//   • the rAF loop pauses when the tab is hidden or the hero scrolls out of view
//   • prefers-reduced-motion → one static frame, no loop
//   • pointer-events: none, so it never interferes with the UI on top

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hot: boolean; // brighter, pulsing "data" nodes
}

const LINK_DIST = 132;
const ACCENT = [99, 102, 241]; // indigo — reads well on both light and dark hero surfaces

export function HeroField({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const c = canvas.getContext("2d", { alpha: true });
    if (!c) return;

    const reduce = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let w = 0;
    let h = 0;
    let nodes: Node[] = [];
    const pointer = { x: -9999, y: -9999, active: false };

    const rgba = (a: number) => `rgba(${ACCENT[0]}, ${ACCENT[1]}, ${ACCENT[2]}, ${a})`;

    function build() {
      const rect = canvas!.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      c!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const target = Math.min(80, Math.max(22, Math.floor((w * h) / 16000)));
      nodes = Array.from({ length: target }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.6 + 1,
        hot: Math.random() < 0.18,
      }));
    }

    function draw(t: number) {
      c!.clearRect(0, 0, w, h);

      for (const n of nodes) {
        // drift
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -20) n.x = w + 20;
        if (n.x > w + 20) n.x = -20;
        if (n.y < -20) n.y = h + 20;
        if (n.y > h + 20) n.y = -20;

        // pointer parallax wake — gently push nearby nodes outward
        if (pointer.active) {
          const dx = n.x - pointer.x;
          const dy = n.y - pointer.y;
          const d2 = dx * dx + dy * dy;
          const R = 150;
          if (d2 < R * R && d2 > 0.01) {
            const dist = Math.sqrt(d2);
            const f = (1 - dist / R) * 0.9;
            const inv = 1 / dist;
            n.x += dx * inv * f;
            n.y += dy * inv * f;
          }
        }
      }

      // links
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d < LINK_DIST) {
            c!.strokeStyle = rgba((1 - d / LINK_DIST) * 0.5);
            c!.lineWidth = 1;
            c!.beginPath();
            c!.moveTo(a.x, a.y);
            c!.lineTo(b.x, b.y);
            c!.stroke();
          }
        }
      }

      // nodes
      for (const n of nodes) {
        const pulse = n.hot ? 0.6 + 0.4 * Math.sin(t / 600 + n.x) : 1;
        c!.fillStyle = rgba((n.hot ? 0.95 : 0.6) * pulse);
        c!.beginPath();
        c!.arc(n.x, n.y, n.hot ? n.r * 1.6 : n.r, 0, Math.PI * 2);
        c!.fill();
        if (n.hot) {
          c!.fillStyle = rgba(0.12 * pulse);
          c!.beginPath();
          c!.arc(n.x, n.y, n.r * 6, 0, Math.PI * 2);
          c!.fill();
        }
      }
    }

    let raf = 0;
    let running = false;
    const loop = (t: number) => {
      draw(t);
      raf = requestAnimationFrame(loop);
    };
    function start() {
      if (running || reduce) return;
      running = true;
      raf = requestAnimationFrame(loop);
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    build();
    if (reduce) {
      draw(0); // single static frame
    } else {
      start();
    }

    // pause when off-screen
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { threshold: 0 });
    io.observe(canvas);

    const onVis = () => (document.hidden ? stop() : start());
    const onMove = (e: PointerEvent) => {
      const rect = canvas!.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
    };
    const onLeave = () => (pointer.active = false);
    let resizeT = 0;
    const onResize = () => {
      clearTimeout(resizeT);
      resizeT = window.setTimeout(build, 150);
    };

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerout", onLeave);
    window.addEventListener("resize", onResize);

    return () => {
      stop();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerout", onLeave);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden />;
}
