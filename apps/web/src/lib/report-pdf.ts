import type { jsPDF as JsPdf } from "jspdf";
import type { ActionItem, DashboardSpec, Insight, Kpi } from "./types";
import { buildMethodology, fingerprint } from "./methodology";
import { DEFAULT_BRAND, hexToRgb, type BrandSettings } from "./brand";

// Text-first deliverables, composed directly with jsPDF's text APIs (not a DOM screenshot): a paginated,
// selectable, branded consultant report (portrait) and a slide deck (landscape). Pure client-side; the
// heavy jspdf import is dynamic so it stays out of the analyzer bundle. Reads white-label brand settings.

const INK: [number, number, number] = [30, 41, 59];
const SUB: [number, number, number] = [100, 116, 139];
const FAINT: [number, number, number] = [148, 163, 184];

interface Ctx {
  pdf: JsPdf;
  W: number;
  H: number;
  margin: number;
  y: number;
  accent: [number, number, number];
  brand: BrandSettings;
  pageNo: number;
}

function fmtValue(v: number | string, unit?: string): string {
  const s = typeof v === "number" ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(v) : v;
  return unit ? `${s} ${unit}` : s;
}

function safeName(name: string): string {
  return (name.replace(/\.[^.]+$/, "") || "myanalyst-report").replace(/[^a-z0-9-_]+/gi, "_");
}

function footer(c: Ctx) {
  c.pdf.setFont("helvetica", "normal").setFontSize(8).setTextColor(...FAINT);
  c.pdf.text(`${c.brand.name} · MyAnalyst`, c.margin, c.H - 14);
  c.pdf.text(String(c.pageNo), c.W - c.margin, c.H - 14, { align: "right" });
}

function newPage(c: Ctx) {
  footer(c);
  c.pdf.addPage();
  c.pageNo++;
  c.y = c.margin;
}

/** Ensure `space` px remain on the page; break if not. */
function ensure(c: Ctx, space: number) {
  if (c.y + space > c.H - 28) newPage(c);
}

function heading(c: Ctx, text: string) {
  ensure(c, 40);
  c.y += 6;
  c.pdf.setFont("helvetica", "bold").setFontSize(13).setTextColor(...INK);
  c.pdf.text(text, c.margin, c.y);
  c.y += 6;
  c.pdf.setDrawColor(...c.accent).setLineWidth(1.5);
  c.pdf.line(c.margin, c.y, c.margin + 38, c.y);
  c.y += 12;
}

function paragraph(c: Ctx, text: string, opts: { size?: number; color?: [number, number, number]; gap?: number } = {}) {
  const size = opts.size ?? 10;
  const color = opts.color ?? SUB;
  c.pdf.setFont("helvetica", "normal").setFontSize(size).setTextColor(...color);
  const lines = c.pdf.splitTextToSize(text, c.W - c.margin * 2) as string[];
  const lineH = size * 1.45;
  for (const line of lines) {
    ensure(c, lineH);
    c.pdf.text(line, c.margin, c.y);
    c.y += lineH;
  }
  c.y += opts.gap ?? 4;
}

function bullet(c: Ctx, text: string, badge?: string) {
  const size = 10;
  c.pdf.setFont("helvetica", "normal").setFontSize(size).setTextColor(...INK);
  const indent = 14;
  const lines = c.pdf.splitTextToSize(text, c.W - c.margin * 2 - indent) as string[];
  const lineH = size * 1.45;
  ensure(c, lineH * lines.length + 2);
  c.pdf.setFillColor(...c.accent);
  c.pdf.circle(c.margin + 3, c.y - 3, 1.4, "F");
  lines.forEach((line, i) => {
    c.pdf.text(line, c.margin + indent, c.y);
    if (i === 0 && badge) {
      const tw = c.pdf.getTextWidth(line);
      c.pdf.setFont("helvetica", "bold").setFontSize(7).setTextColor(...c.accent);
      c.pdf.text(badge.toUpperCase(), c.margin + indent + tw + 6, c.y);
      c.pdf.setFont("helvetica", "normal").setFontSize(size).setTextColor(...INK);
    }
    c.y += lineH;
  });
  c.y += 4;
}

function drawLogo(c: Ctx, x: number, y: number, size: number) {
  if (!c.brand.logoDataUrl) return false;
  try {
    const fmt = c.brand.logoDataUrl.includes("image/png") ? "PNG" : "JPEG";
    c.pdf.addImage(c.brand.logoDataUrl, fmt, x, y, size, size);
    return true;
  } catch {
    return false;
  }
}

function cover(c: Ctx, spec: DashboardSpec, subtitle: string) {
  // accent band
  c.pdf.setFillColor(...c.accent);
  c.pdf.rect(0, 0, c.W, 6, "F");
  c.y = c.margin + 60;
  const hasLogo = drawLogo(c, c.margin, c.y - 28, 34);
  c.pdf.setFont("helvetica", "bold").setFontSize(11).setTextColor(...c.accent);
  c.pdf.text(c.brand.name.toUpperCase(), c.margin + (hasLogo ? 44 : 0), c.y - 6);

  c.y += 40;
  c.pdf.setFont("helvetica", "bold").setFontSize(28).setTextColor(...INK);
  const title = c.pdf.splitTextToSize(spec.datasetName.replace(/\.[^.]+$/, ""), c.W - c.margin * 2) as string[];
  for (const line of title) { c.pdf.text(line, c.margin, c.y); c.y += 32; }

  c.pdf.setFont("helvetica", "normal").setFontSize(12).setTextColor(...SUB);
  c.pdf.text("Analysis report", c.margin, c.y + 6);
  c.y += 28;
  c.pdf.setFontSize(10).setTextColor(...FAINT);
  c.pdf.text(subtitle, c.margin, c.y);
  c.y += 16;
  c.pdf.text(`Generated ${new Date(spec.generatedAt).toLocaleDateString()} · fingerprint ${fingerprint(spec)}`, c.margin, c.y);
}

function writeBody(c: Ctx, spec: DashboardSpec) {
  newPage(c);

  if (spec.story?.summary) {
    heading(c, "Executive summary");
    paragraph(c, spec.story.summary, { color: INK, size: 11 });
  }

  if (spec.kpis.length) {
    heading(c, "Key metrics");
    for (const k of spec.kpis.slice(0, 8) as Kpi[]) {
      bullet(c, `${k.name}: ${fmtValue(k.value, k.unit)}${k.howComputed ? ` — ${k.howComputed}` : ""}`);
    }
  }

  if (spec.actions?.length) {
    heading(c, "Recommended actions");
    for (const a of spec.actions as ActionItem[]) {
      bullet(c, `${a.title} — ${a.detail}`, a.impact);
    }
  }

  if (spec.insights.length) {
    heading(c, "What the data is telling you");
    for (const i of spec.insights.filter((x: Insight) => x.kind !== "summary").slice(0, 8)) {
      bullet(c, i.text, i.confidence);
    }
  }

  if (spec.contributions?.length) {
    heading(c, "What drove the change");
    for (const ca of spec.contributions) {
      const top = ca.segments.slice(0, 4).map((s) => `${s.name} ${s.delta >= 0 ? "+" : "−"}${Math.abs(Math.round(s.delta))}`).join(", ");
      bullet(c, `${ca.metric} by ${ca.dimension} (${ca.prevLabel} → ${ca.latestLabel}): ${top}.`);
    }
  }

  heading(c, "How this was computed");
  for (const sec of buildMethodology(spec)) {
    c.pdf.setFont("helvetica", "bold").setFontSize(10).setTextColor(...INK);
    ensure(c, 18);
    c.pdf.text(sec.heading, c.margin, c.y);
    c.y += 14;
    for (const item of sec.items) paragraph(c, `•  ${item}`, { size: 9, gap: 2 });
    c.y += 4;
  }
}

function makeCtx(pdf: JsPdf, brand: BrandSettings): Ctx {
  return {
    pdf,
    W: pdf.internal.pageSize.getWidth(),
    H: pdf.internal.pageSize.getHeight(),
    margin: 40,
    y: 40,
    accent: hexToRgb(brand.accent),
    brand,
    pageNo: 1,
  };
}

/** Portrait, text-first, paginated consultant report. */
export async function exportReportPdf(spec: DashboardSpec, brand: BrandSettings = DEFAULT_BRAND): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: "a4" });
  const c = makeCtx(pdf, brand);
  const subtitle = `${spec.rowCount.toLocaleString()} rows · ${spec.profiles.length} columns · ${spec.domain.domain}`;
  cover(c, spec, subtitle);
  writeBody(c, spec);
  footer(c);
  pdf.save(`${safeName(spec.datasetName)}.report.pdf`);
}

// ── Slide deck (landscape) ──────────────────────────────────────────────────────

function slide(c: Ctx, title: string): number {
  if (c.pageNo > 1 || c.y > c.margin) {
    footer(c);
    c.pdf.addPage();
    c.pageNo++;
  }
  c.pdf.setFillColor(...c.accent);
  c.pdf.rect(0, 0, c.W, 5, "F");
  c.y = c.margin + 10;
  drawLogo(c, c.W - c.margin - 24, c.margin - 10, 24);
  c.pdf.setFont("helvetica", "bold").setFontSize(20).setTextColor(...INK);
  c.pdf.text(title, c.margin, c.y);
  c.y += 12;
  c.pdf.setDrawColor(...c.accent).setLineWidth(2);
  c.pdf.line(c.margin, c.y, c.margin + 60, c.y);
  c.y += 24;
  return c.y;
}

/** Landscape slide deck: cover, key findings, actions, metrics — a presentable readout. */
export async function exportDeckPdf(spec: DashboardSpec, brand: BrandSettings = DEFAULT_BRAND): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: "a4" });
  const c = makeCtx(pdf, brand);

  // Cover slide
  c.pdf.setFillColor(...c.accent);
  c.pdf.rect(0, 0, c.W, c.H, "F");
  drawLogo(c, c.margin, c.margin, 40);
  c.pdf.setFont("helvetica", "bold").setFontSize(34).setTextColor(255, 255, 255);
  const title = c.pdf.splitTextToSize(spec.datasetName.replace(/\.[^.]+$/, ""), c.W - c.margin * 2) as string[];
  let ty = c.H / 2 - 10;
  for (const line of title) { c.pdf.text(line, c.margin, ty); ty += 38; }
  c.pdf.setFont("helvetica", "normal").setFontSize(14).setTextColor(255, 255, 255);
  c.pdf.text(`${brand.name} · ${spec.rowCount.toLocaleString()} rows · ${spec.domain.domain}`, c.margin, ty + 6);

  const bulletSlide = (title: string, items: string[], badges?: (string | undefined)[]) => {
    if (!items.length) return;
    slide(c, title);
    c.pdf.setFont("helvetica", "normal").setFontSize(13).setTextColor(...INK);
    items.slice(0, 6).forEach((t, i) => {
      const lines = c.pdf.splitTextToSize(t, c.W - c.margin * 2 - 16) as string[];
      c.pdf.setFillColor(...c.accent);
      c.pdf.circle(c.margin + 4, c.y - 4, 2, "F");
      lines.forEach((line) => { c.pdf.text(line, c.margin + 16, c.y); c.y += 19; });
      if (badges?.[i]) {
        c.pdf.setFont("helvetica", "bold").setFontSize(8).setTextColor(...c.accent);
        c.pdf.text(badges[i]!.toUpperCase(), c.margin + 16, c.y - 4);
        c.pdf.setFont("helvetica", "normal").setFontSize(13).setTextColor(...INK);
      }
      c.y += 8;
    });
  };

  if (spec.story?.summary) bulletSlide("Overview", [spec.story.summary]);
  bulletSlide("Key metrics", spec.kpis.slice(0, 6).map((k) => `${k.name}: ${fmtValue(k.value, k.unit)}`));
  bulletSlide(
    "Recommended actions",
    (spec.actions ?? []).map((a) => `${a.title} — ${a.detail}`),
    (spec.actions ?? []).map((a) => a.impact)
  );
  bulletSlide("What the data is telling you", spec.insights.filter((i) => i.kind !== "summary").slice(0, 6).map((i) => i.text));

  // Closing disclaimer slide
  slide(c, "Notes");
  paragraph(c, buildMethodology(spec).find((s) => s.heading === "Assumptions & limitations")?.items.slice(-1)[0] ?? "", { color: SUB, size: 11 });
  footer(c);

  pdf.save(`${safeName(spec.datasetName)}.deck.pdf`);
}
