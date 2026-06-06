import type { jsPDF as JsPdf } from "jspdf";
import { chartBg } from "./chart-theme";

// Client-side dashboard export. Snapshots the rendered dashboard DOM (ECharts canvases included)
// to a PNG, and composes a paginated PDF from that image. No server, no upload — same privacy
// posture as the rest of the app. The heavy libraries (html-to-image, jspdf) are dynamically
// imported on first use so they stay out of the analyzer's initial bundle.

function safeName(name: string): string {
  return (name.replace(/\.[^.]+$/, "") || "quantia-dashboard").replace(/[^a-z0-9-_]+/gi, "_");
}

async function snapshot(node: HTMLElement): Promise<string> {
  const { toPng } = await import("html-to-image");
  // backgroundColor matches the active theme so transparent gaps don't render wrong.
  // pixelRatio 2 → crisp output on retina / when zoomed into the PDF.
  return toPng(node, { backgroundColor: chartBg(), pixelRatio: 2, cacheBust: true });
}

function triggerDownload(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function exportPng(node: HTMLElement, datasetName: string): Promise<void> {
  const dataUrl = await snapshot(node);
  triggerDownload(dataUrl, `${safeName(datasetName)}.png`);
}

export async function exportPdf(node: HTMLElement, datasetName: string): Promise<void> {
  const dataUrl = await snapshot(node);
  const img = await loadImage(dataUrl);
  const { jsPDF } = await import("jspdf");

  const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgH = (img.height / img.width) * pageW; // scale image to page width

  // Paginate: slide the full-height image up one page at a time.
  let heightLeft = imgH;
  let position = 0;
  paintBg(pdf, pageW, pageH);
  pdf.addImage(dataUrl, "PNG", 0, position, pageW, imgH);
  heightLeft -= pageH;
  while (heightLeft > 0) {
    position -= pageH;
    pdf.addPage();
    paintBg(pdf, pageW, pageH);
    pdf.addImage(dataUrl, "PNG", 0, position, pageW, imgH);
    heightLeft -= pageH;
  }
  pdf.save(`${safeName(datasetName)}.pdf`);
}

function paintBg(pdf: JsPdf, w: number, h: number) {
  if (chartBg() === "#ffffff") pdf.setFillColor(255, 255, 255);
  else pdf.setFillColor(10, 14, 22);
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
