// White-label branding for exported deliverables (report PDF, slide deck, image header). Stored
// locally only (localStorage) — branding never leaves the browser. A user can drop in their own
// company name, accent colour, and logo so the report reads as theirs.

export interface BrandSettings {
  /** company / author name shown in the report header & footer. */
  name: string;
  /** accent colour as #rrggbb, used for rules, headings, and the cover band. */
  accent: string;
  /** optional logo as a PNG/JPEG data URL (raster only — embeds cleanly in PDF). */
  logoDataUrl?: string;
}

const KEY = "quantia:brand";

export const DEFAULT_BRAND: BrandSettings = { name: "MyAnalyst", accent: "#3b82f6" };

export function loadBrand(): BrandSettings {
  if (typeof localStorage === "undefined") return { ...DEFAULT_BRAND };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_BRAND };
    const parsed = JSON.parse(raw) as Partial<BrandSettings>;
    return {
      name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : DEFAULT_BRAND.name,
      accent: /^#[0-9a-f]{6}$/i.test(parsed.accent ?? "") ? parsed.accent! : DEFAULT_BRAND.accent,
      logoDataUrl: typeof parsed.logoDataUrl === "string" && parsed.logoDataUrl.startsWith("data:image/") ? parsed.logoDataUrl : undefined,
    };
  } catch {
    return { ...DEFAULT_BRAND };
  }
}

export function saveBrand(b: BrandSettings): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(b));
  } catch {
    /* quota / private mode — non-fatal */
  }
}

/** Parse #rrggbb to an [r,g,b] triple (0–255), falling back to the default accent. */
export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return [59, 130, 246];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}
