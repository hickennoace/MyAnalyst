import type { Caveat, ColumnProfile, Kpi } from "./types";

// Caveat propagation: surface the data-quality scorecard's findings *where the analysis is read*, so a
// polished number never quietly hides a garbage-in problem. We flag columns that are materially
// incomplete or degenerate, then let cards mark any figure derived from a flagged column.

/** Columns worth a "read with care" flag: materially missing, or degenerate (one value). */
export function buildCaveats(profiles: ColumnProfile[]): Caveat[] {
  const out: Caveat[] = [];
  for (const p of profiles) {
    if (p.role === "identifier") continue;
    const missingPct = Math.round((1 - p.fillRate) * 100);
    if (p.fillRate < 0.7) out.push({ column: p.name, reason: `${missingPct}% of values are missing`, severity: "bad" });
    else if (p.fillRate < 0.9) out.push({ column: p.name, reason: `${missingPct}% of values are missing`, severity: "warn" });
    else if (p.distinctCount <= 1) out.push({ column: p.name, reason: "only one distinct value", severity: "warn" });
  }
  return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "bad" ? -1 : 1)).slice(0, 6);
}

/** The caveat (if any) affecting a KPI — matched by the column name appearing in its name/computation. */
export function caveatForKpi(kpi: Kpi, caveats: Caveat[]): Caveat | undefined {
  const hay = `${kpi.name} ${kpi.howComputed}`.toLowerCase();
  // Prefer the most severe match, then the longest column name (most specific).
  return caveats
    .filter((c) => hay.includes(c.column.toLowerCase()))
    .sort((a, b) => (a.severity === b.severity ? b.column.length - a.column.length : a.severity === "bad" ? -1 : 1))[0];
}
