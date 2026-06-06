// End-to-end smoke test of the analysis engine on the sample dataset.
// Run: npx tsx scripts/smoke.mts
import { sampleTable } from "../src/lib/sample";
import { analyze } from "../src/lib/analyze";

const table = sampleTable();
const spec = await analyze(table);

console.log("=== DATASET ===");
console.log(`${spec.datasetName} — ${spec.rowCount} rows (after cleaning), ${spec.profiles.length} columns`);

console.log("\n=== CLEANING REPORT ===");
const c = spec.cleaning;
console.log(`rows ${c.rowsBefore} → ${c.rowsAfter}  (dupes ${c.duplicatesRemoved}, totals ${c.totalRowsRemoved}, empty ${c.emptyRowsRemoved}, normalized ${c.cellsNormalized}, trimmed ${c.cellsTrimmed})`);
for (const s of c.steps) console.log(`  ✓ ${s.label}${s.count ? ` (${s.count})` : ""}`);
console.log("  before/after preview row 1:");
if (c.preview.rows[0]) {
  console.log(`    raw:     ${c.preview.rows[0].before.join(" | ")}`);
  console.log(`    cleaned: ${c.preview.rows[0].after.join(" | ")}`);
}

console.log("\n=== DOMAIN ===");
console.log(`${spec.domain.domain} (${(spec.domain.confidence * 100).toFixed(0)}%) — ${spec.domain.reason}`);

console.log("\n=== COLUMN PROFILES ===");
for (const p of spec.profiles) {
  console.log(`  ${p.name.padEnd(18)} type=${p.type.padEnd(9)} role=${p.role.padEnd(11)} fill=${(p.fillRate * 100).toFixed(0)}%`);
}

console.log("\n=== KPIs (top 8) ===");
for (const k of spec.kpis.slice(0, 8)) {
  console.log(`  ${k.name.padEnd(28)} = ${String(k.value)}${k.trend !== undefined ? `  (trend ${(k.trend * 100).toFixed(1)}%)` : ""}`);
}

console.log("\n=== CHARTS ===");
for (const c of spec.charts) {
  console.log(`  [${c.type}] ${c.title}`);
}

console.log("\n=== INSIGHTS ===");
for (const i of spec.insights) {
  console.log(`  • (${i.confidence}) ${i.text}`);
}

console.log("\nOK — pipeline produced a complete DashboardSpec.");
