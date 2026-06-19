# MyAnalyst — Design & Animation Roadmap

This file is the working roadmap for rolling the **cinematic motion language**
(the hero "warp" animation) across the **entire** MyAnalyst web app, on a single
**bright** theme. It is the source of truth for the visual direction; update it as
phases land.

Web app lives in `apps/web` (Next.js 15, Tailwind v4, npm). All visual work below
is in `apps/web/src`.

---

## North star

> One bright, energetic, **warm coral/ember** identity, with the cinematic warp
> animation (racing light-streaks + glowing data core + perspective speed-grid +
> rise-in reveals) as a consistent motion language from the landing hero all the
> way through the analyzer and shared dashboards.

- **Single theme.** No light/dark toggle. The whole site is bright.
- **Warm coral/ember accent** everywhere: `#ff5740` primary, `#ff3b30` deep,
  `#ff8a4c` ember, peach/cream surfaces. (Data **chart series** keep their
  multi-color functional palette — red ≠ "bad" in a chart, so charts are exempt.)
- **Motion is the brand.** Every page should carry at least one element of the
  warp language; intensity scales down from hero → sections → app chrome so it
  never fights legibility or the data.

## Motion vocabulary (the reusable pieces)

| Piece | Source | Where it lives | Reuse plan |
|---|---|---|---|
| Warp light-streaks (Canvas) | `components/SpeedStreaks.tsx` | hero | bright variant; reuse faint behind CTA + app headers |
| Animated **line chart** (SVG) | `components/DataCore.tsx` | hero | self-drawing coral line + area + popping points + tracer; reuse smaller in CTA / empty states |
| Perspective speed-grid (CSS) | `.cine-grid` in `globals.css` | hero | faint global `.lp-warp` backdrop |
| Pulsing bloom (CSS) | `.cine-glow` | hero | section + panel accents |
| Rise-in reveal | `.cine-rise` / `components/Reveal.tsx` | hero / sections | already site-wide; keep |
| Coral CTA + glow | `.cine-cta` / `.lp-cta` | buttons | unify all CTAs |

> Note: the hero centerpiece is an **animated line chart** (self-drawing trend
> line, fading area fill, sequentially-popping data points, a pulsing leading
> point, an SVG `animateMotion` tracer dot, and a one-shot sweep). It replaced
> the earlier bar-chart core. Animations live under `.cine-line/area/dot/tracer/
> sweep` in `globals.css` and all settle still under reduced-motion.

## Color tokens (single source — `globals.css`)

- `.lp` (landing surface): `--accent: #ff5740`, `--accent-hover: #ff3b30`,
  `--accent-soft: #fff0ea`. Bright white/cream surfaces.
- `.cine` (hero band): **bright luminous** cream→peach→coral background, **dark**
  warm ink (`--c-ink`), coral/ember glows.
- App core tokens (`:root[data-theme="light"]`): warm-tinted bright surfaces.
  `data-theme="light"` is hardcoded in `layout.tsx` (the toggle/init are removed)
  so `isLight()` in `chart-theme.ts` always returns true.

---

## Phases

### ✅ Phase 1 — Foundation: single bright warm theme + hero (this pass)
- [x] Remove light/dark toggle: delete `ThemeToggle`, the inline `THEME_INIT`
      script, `localStorage` theme, and toggle CSS. Hardcode `data-theme="light"`.
- [x] Unify `.lp` to the warm coral palette and brighten surfaces.
- [x] Convert the hero `.cine` band from near-black to a **bright luminous**
      warm band (dark warm ink on cream/peach/coral); retune `cine-grid`,
      `cine-glow`, `cine::before`, `cine-card`, `cine-ghost` for a light backdrop.
- [x] Adapt `SpeedStreaks` to render saturated coral comets on a bright field
      (light fade + source-over, not white additive bloom that washes out).
- [x] Site-wide motion seeds: faint global warp backdrop (`.lp-warp`), a
      cinematic warm CTA band, and warm hover-glows on cards/buttons.

### Phase 2 — Sections inherit the language
- [ ] Features grid: warm icon tiles, coral hover-glow, optional per-card scan
      line on hover. Stagger reveals already present.
- [ ] "How it works" steps: connect with an animated coral trend line (reuse the
      `cine-trend` self-drawing stroke between step cards).
- [ ] Privacy/AI split + final CTA: promote the CTA to a full mini-hero band with
      a small `DataCore` and faint streaks.
- [ ] Ticker: warm fade masks; pause on hover.

### ✅ Phase 3 — App chrome (analyzer + shared view + privacy)
- [x] Warmed `.app-bg` / `.app-aurora` / `.glow` washes + the light-mode overrides
      to coral; warmed the core app surface tokens (`--color-bg` etc.) to bright cream.
- [x] Warmed the brand tokens (`--color-brand`, `.brand-mark`, `.card-hover`,
      `.text-gradient`, `stepPulse`) and the focus ring / skip link.
- [x] Swept **every** `blue-*` Tailwind accent → coral `#ff5740` across all 33
      app components (Uploader, dashboard cards, QueryBox, editors, etc.), with a
      darker `#ff3b30` hover. ECharts series palette left multi-color (red≠bad).
- [ ] (Follow-up) Warm, animated app page headers (BrandMark + coral underline sweep).
- [ ] (Follow-up) Pipeline/loading state could reuse warp streaks/speed-grid.
- [ ] (Follow-up) Replace the blue `logo.png` brand asset with a coral version
      (it's a raster image, so CSS can't recolor it).

### ✅ Performance (this pass)
- [x] **Removed framer-motion from all source** — the big win. `Reveal` now uses a
      tiny IntersectionObserver + CSS (`.reveal`/`.reveal-in`); `Magnetic` sets a CSS
      transform with a CSS-transition settle; the analyzer's `motion.div`/`motion.button`
      became plain elements with `.fade-up` / `.btn-press`. Deleted the unused
      `Motion.tsx` + `Tilt.tsx`. No route imports framer-motion now, so Next no longer
      bundles it on any page. (It's still declared in `package.json` to keep
      `package-lock.json` consistent for Vercel `npm ci`; safe to `npm uninstall` later.)

### Phase 4 — Remaining polish & a11y
- [ ] Lighthouse pass (CLS from reveals, paint cost of blurs/filters).
- [ ] One shared, parameterized streak/grid component instead of per-section copies.
- [ ] Visual QA on the PNG/PDF dashboard export (animations must settle to a
      static, correct frame — `fill: both`, no mid-flight capture).

## Guardrails / non-goals

- **Don't recolor chart data series** to coral — keep `PALETTE` in
  `chart-theme.ts` functional and multi-hue.
- **Never** let motion block input (`pointer-events: none` on all decoration).
- **Always** honor `prefers-reduced-motion`.
- Keep the hero/section blurs and Canvas cheap — this is a data tool, not a demo.

## Build / verify

```sh
cd apps/web
corepack pnpm exec next build          # type-check + prod build
corepack pnpm exec next dev            # local dev
```
Deploy is via Vercel Git integration on push to `main` (Root Directory = `apps/web`).
