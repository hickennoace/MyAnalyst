"use client";

import { useEffect, useRef } from "react";

// Cinematic "warp-speed" light streaks for the hero - thin glowing trails that
// race outward from a vanishing point. Tuned for the BRIGHT luminous band: warm
// coral→ember comets drawn with normal (source-over) blending over a transparent
// canvas, so they read as saturated streaks on the light backdrop instead of the
// additive white bloom that only worked on a near-black scene.
//
// Performance guardrails (mirrors HeroField):
//   • streak count is fixed + small; one O(n) pass per frame
//   • device-pixel-ratio clamped to 2
//   • rAF loop pauses when the tab is hidden or the hero scrolls out of view
//   • prefers-reduced-motion → a single static frame, no loop
//   • pointer-events: none, so it never blocks the UI on top

interface Streak {
  ang: number; // direction from the vanishing point (radians)
  r: number; // current distance from the vanishing point
  speed: number; // px/frame growth
  len: number; // trail length factor
  hue: number; // 0 = deep crimson … 1 = warm ember
  w: number; // line width
}

// Deep coral → ember palette - kept saturated/dark enough to read on the bright
// peach band. (Lower hues = deeper red, higher = orange ember.)
function color(hue: number, a: number) {
  const r = Math.round(214 + hue * 41); // 214 → 255
  const g = Math.round(26 + hue * 102); // 26 → 128
  const b = Math.round(14 + hue * 30); // 14 → 44
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function SpeedStreaks({ className = "" }: { className?: string }) {
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
    // Vanishing point sits where the data core lives (upper-right of the scene).
    let vx = 0;
    let vy = 0;
    let streaks: Streak[] = [];

    function reset(s: Streak, atStart: boolean) {
      s.ang = Math.random() * Math.PI * 2;
      s.r = atStart ? Math.random() * Math.max(w, h) * 0.7 : Math.random() * 40 + 6;
      s.speed = Math.random() * 3.2 + 1.4;
      s.len = Math.random() * 26 + 14;
      s.hue = Math.random();
      s.w = Math.random() * 1.6 + 0.5;
    }

    function build() {
      const rect = canvas!.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      c!.setTransform(dpr, 0, 0, dpr, 0, 0);
      vx = w * 0.66;
      vy = h * 0.42;

      const target = Math.min(90, Math.max(28, Math.floor((w * h) / 14000)));
      streaks = Array.from({ length: target }, () => {
        const s = { ang: 0, r: 0, speed: 0, len: 0, hue: 0, w: 0 } as Streak;
        reset(s, true);
        return s;
      });
    }

    const maxR = () => Math.hypot(Math.max(vx, w - vx), Math.max(vy, h - vy)) + 60;

    function draw() {
      // Transparent canvas over the bright band - clear each frame and redraw the
      // comets fresh (their own gradient tail provides the motion trail), so the
      // band's glow stays visible through the gaps.
      c!.clearRect(0, 0, w, h);
      c!.globalCompositeOperation = "source-over";
      c!.lineCap = "round";
      const limit = maxR();
      for (const s of streaks) {
        s.r += s.speed * (1 + s.r / 240); // accelerate as it nears the camera
        if (s.r > limit) reset(s, false);

        const cos = Math.cos(s.ang);
        const sin = Math.sin(s.ang);
        const x1 = vx + cos * s.r;
        const y1 = vy + sin * s.r;
        const tail = Math.max(0, s.r - s.len * (0.6 + s.r / 200));
        const x2 = vx + cos * tail;
        const y2 = vy + sin * tail;

        const a = Math.min(0.5, (s.r / limit) * 0.6);
        const grad = c!.createLinearGradient(x2, y2, x1, y1);
        grad.addColorStop(0, color(s.hue, 0));
        grad.addColorStop(1, color(s.hue, a));
        c!.strokeStyle = grad;
        c!.lineWidth = s.w * (1 + s.r / 360);
        c!.beginPath();
        c!.moveTo(x2, y2);
        c!.lineTo(x1, y1);
        c!.stroke();
      }
    }

    let raf = 0;
    let running = false;
    const loop = () => {
      draw();
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
      // One static, settled frame: draw streaks mid-flight once.
      c!.globalCompositeOperation = "source-over";
      c!.lineCap = "round";
      for (const s of streaks) {
        const cos = Math.cos(s.ang);
        const sin = Math.sin(s.ang);
        c!.strokeStyle = color(s.hue, 0.35);
        c!.lineWidth = s.w;
        c!.beginPath();
        c!.moveTo(vx + cos * (s.r - s.len), vy + sin * (s.r - s.len));
        c!.lineTo(vx + cos * s.r, vy + sin * s.r);
        c!.stroke();
      }
    } else {
      start();
    }

    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { threshold: 0 });
    io.observe(canvas);
    const onVis = () => (document.hidden ? stop() : start());
    let resizeT = 0;
    const onResize = () => {
      clearTimeout(resizeT);
      resizeT = window.setTimeout(build, 150);
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("resize", onResize);

    return () => {
      stop();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden />;
}
