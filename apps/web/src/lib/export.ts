import type { jsPDF as JsPdf } from "jspdf";
import { chartBg } from "./chart-theme";
import { DEFAULT_BRAND, type BrandSettings } from "./brand";

// Client-side dashboard export. Snapshots the rendered dashboard DOM (ECharts canvases included)
// to a PNG, and composes a paginated PDF from that image. No server, no upload — same privacy
// posture as the rest of the app. The heavy libraries (html-to-image, jspdf) are dynamically
// imported on first use so they stay out of the analyzer's initial bundle.
//
// Two things keep the output clean: (1) interactive sections marked [data-export-exclude]
// (the query box, chart builder, raw data table) are hidden during capture, and a branded
// report header is added; (2) the PDF paginates on real block boundaries — page breaks land in
// the gaps between cards/sections, so nothing is ever sliced in half.

const PIXEL_RATIO = 2; // crisp output on retina / when zoomed into the PDF

function safeName(name: string): string {
  return (name.replace(/\.[^.]+$/, "") || "myanalyst-dashboard").replace(/[^a-z0-9-_]+/gi, "_");
}

function isDark(): boolean {
  return chartBg() !== "#ffffff";
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

/**
 * Hide interactive sections and prepend a branded report header, so the captured image reads as a
 * polished report rather than a screenshot of a live app. Returns a function that undoes everything.
 */
function prepareCapture(node: HTMLElement, title: string, meta: string, brand: BrandSettings = DEFAULT_BRAND): () => void {
  const dark = isDark();
  const fg = dark ? "#e2e8f0" : "#0f172a";
  const sub = dark ? "#94a3b8" : "#64748b";
  const line = dark ? "rgba(148,163,184,0.22)" : "rgba(15,23,42,0.12)";
  const font = "ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif";
  const accent = /^#[0-9a-f]{6}$/i.test(brand.accent) ? brand.accent : "#3b82f6";

  // Hide the interactive sections (Ask / Build / Browse / Scenario / the tab bar).
  const hidden: { el: HTMLElement; prev: string }[] = [];
  node.querySelectorAll<HTMLElement>("[data-export-exclude]").forEach((el) => {
    hidden.push({ el, prev: el.style.display });
    el.style.display = "none";
  });

  // Un-clip every inactive tab panel so the report includes all sections (on screen only the active tab
  // is shown). Panels are clipped (height:0) rather than display:none, so their charts are already sized
  // correctly — revealing is just removing the clip.
  const revealed: { el: HTMLElement; height: string; overflow: string; opacity: string; inert: boolean }[] = [];
  node.querySelectorAll<HTMLElement>('[data-tab-panel][data-active="false"]').forEach((el) => {
    revealed.push({ el, height: el.style.height, overflow: el.style.overflow, opacity: el.style.opacity, inert: el.inert });
    el.style.height = "auto";
    el.style.overflow = "visible";
    el.style.opacity = "1";
    el.inert = false;
  });

  // A custom logo when branded; otherwise the inline MyAnalyst logomark (self-contained for html-to-image).
  const logo = brand.logoDataUrl
    ? `<img src="${brand.logoDataUrl}" alt="${escapeHtml(brand.name)}" style="width:30px;height:30px;border-radius:7px;object-fit:contain;" />`
    : `<svg viewBox="0 0 32 32" width="30" height="30" role="img" aria-label="${escapeHtml(brand.name)}">
      <defs><linearGradient id="exp-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${accent}"/><stop offset="1" stop-color="#22d3ee"/>
      </linearGradient></defs>
      <rect x="1" y="1" width="30" height="30" rx="8.5" fill="url(#exp-grad)"/>
      <g fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 6 L24 25.5"/><path d="M8 25.5 L11.5 19 L14 21 L16 6"/>
      </g>
      <g fill="#fff"><circle cx="16" cy="6" r="2"/></g>
    </svg>`;

  const header = document.createElement("div");
  header.style.cssText = `display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:14px;margin-bottom:20px;border-bottom:2px solid ${accent};`;
  const by = brand.name !== DEFAULT_BRAND.name ? `${escapeHtml(brand.name)} · MyAnalyst` : "MyAnalyst";
  header.innerHTML = `
    <div style="display:flex;align-items:center;gap:11px;">
      ${logo}
      <div style="line-height:1.25;">
        <div style="font:600 16px ${font};color:${fg};">${escapeHtml(title)}</div>
        <div style="font:400 12px ${font};color:${sub};margin-top:2px;">${escapeHtml(meta)}</div>
      </div>
    </div>
    <div style="text-align:right;line-height:1.25;">
      <div style="font:600 13px ${font};color:${fg};">${by}</div>
      <div style="font:400 11px ${font};color:${sub};margin-top:2px;">Generated ${new Date().toLocaleDateString()}</div>
    </div>`;
  node.insertBefore(header, node.firstChild);

  return () => {
    header.remove();
    for (const { el, prev } of hidden) el.style.display = prev;
    for (const r of revealed) {
      r.el.style.height = r.height;
      r.el.style.overflow = r.overflow;
      r.el.style.opacity = r.opacity;
      r.el.inert = r.inert;
    }
  };
}

/** Vertical positions (in captured-image pixels) where a page break can safely land — the bottom
 *  edge of each top-level block. Measured while the node is in capture state. */
function blockBoundaries(node: HTMLElement): number[] {
  const top = node.getBoundingClientRect().top;
  const bounds: number[] = [];
  for (const child of Array.from(node.children)) {
    const r = (child as HTMLElement).getBoundingClientRect();
    if (r.height < 1) continue; // skip hidden / collapsed blocks
    bounds.push((r.bottom - top) * PIXEL_RATIO);
  }
  return bounds;
}

async function snapshot(node: HTMLElement): Promise<string> {
  const { toPng } = await import("html-to-image");
  // backgroundColor matches the active theme so transparent gaps don't render wrong.
  return toPng(node, { backgroundColor: chartBg(), pixelRatio: PIXEL_RATIO, cacheBust: true });
}

function triggerDownload(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Give revealed tab panels (and their freshly-resized ECharts canvases) a couple of frames to repaint
// before we snapshot, so the exported report isn't missing charts from non-active tabs.
const settle = () => new Promise((r) => setTimeout(r, 90));

export async function exportPng(node: HTMLElement, datasetName: string, meta = "", brand?: BrandSettings): Promise<void> {
  const restore = prepareCapture(node, datasetName, meta, brand);
  try {
    await settle();
    const dataUrl = await snapshot(node);
    triggerDownload(dataUrl, `${safeName(datasetName)}.png`);
  } finally {
    restore();
  }
}

export async function exportPdf(node: HTMLElement, datasetName: string, meta = "", brand?: BrandSettings): Promise<void> {
  const restore = prepareCapture(node, datasetName, meta, brand);
  let dataUrl: string;
  let boundaries: number[];
  try {
    await settle();
    boundaries = blockBoundaries(node);
    dataUrl = await snapshot(node);
  } finally {
    restore();
  }

  const img = await loadImage(dataUrl);
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  const margin = 28;
  const footerH = 18;
  const contentW = pageW - margin * 2;
  const scale = contentW / img.width; // image px → pdf px
  const pageImgPx = Math.floor((pageH - margin * 2 - footerH) / scale); // image px that fit one page's content area

  // Greedy pagination: each page takes as much as fits while ending on a block boundary.
  const cuts: number[] = [];
  let start = 0;
  while (start < img.height - 1) {
    const limit = start + pageImgPx;
    if (limit >= img.height) {
      cuts.push(img.height);
      break;
    }
    // Furthest boundary that fits on this page (and makes progress past `start`).
    let end = -1;
    for (const b of boundaries) {
      if (b > start + 4 && b <= limit && b > end) end = b;
    }
    if (end < 0) end = limit; // a single block taller than a page — hard cut as a fallback
    cuts.push(end);
    start = end;
  }

  const dark = isDark();
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  let prev = 0;
  for (let i = 0; i < cuts.length; i++) {
    const sliceTop = prev;
    const sliceH = cuts[i] - prev;
    prev = cuts[i];
    if (sliceH < 1) continue;

    canvas.width = img.width;
    canvas.height = sliceH;
    ctx.fillStyle = chartBg();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, sliceTop, img.width, sliceH, 0, 0, img.width, sliceH);

    if (i > 0) pdf.addPage();
    paintBg(pdf, pageW, pageH);
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, margin, contentW, sliceH * scale);

    // Footer: page number, centered.
    pdf.setFontSize(8);
    pdf.setTextColor(dark ? 148 : 100, dark ? 163 : 116, dark ? 184 : 139);
    pdf.text(`${i + 1} / ${cuts.length}`, pageW / 2, pageH - margin / 2, { align: "center" });
  }

  pdf.save(`${safeName(datasetName)}.pdf`);
}

function paintBg(pdf: JsPdf, w: number, h: number) {
  if (isDark()) pdf.setFillColor(10, 14, 22);
  else pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, w, h, "F");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
