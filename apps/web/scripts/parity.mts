// TS <-> Python parity check: run the SAME car-sales data through both engines and confirm they agree on
// the headline conclusions (domain, the #1 KPI, the best-seller). Run: npx tsx scripts/parity.mts
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyze } from "../src/lib/analyze";
import type { Table } from "../src/lib/types";

const MODELS = [
  { brand: "Toyota", model: "Corolla", price: 24000, cost: 19000, w: 26 },
  { brand: "Toyota", model: "RAV4", price: 32000, cost: 25000, w: 20 },
  { brand: "Honda", model: "Civic", price: 26000, cost: 21000, w: 16 },
  { brand: "Ford", model: "F-150", price: 45000, cost: 36000, w: 12 },
  { brand: "BMW", model: "X5", price: 68000, cost: 54000, w: 6 },
  { brand: "Mercedes", model: "S-Class", price: 110000, cost: 88000, w: 3 },
  { brand: "Honda", model: "Accord", price: 30000, cost: 24000, w: 10 },
  { brand: "Ford", model: "Focus", price: 22000, cost: 18000, w: 7 },
];
// Deterministic LCG so TS and Python analyze byte-identical rows.
let seed = 12345;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pool: typeof MODELS = [];
for (const m of MODELS) for (let i = 0; i < m.w; i++) pool.push(m);

const cols = ["Date", "Brand", "Model", "Price", "Cost", "CustomerAge", "Region"];
const rows: Record<string, unknown>[] = [];
const start = Date.UTC(2023, 0, 1);
const N = 1200;
for (let i = 0; i < N; i++) {
  const m = pool[Math.floor(rand() * pool.length)];
  const day = Math.floor((i / N) * 700 + rand() * 15);
  rows.push({
    Date: new Date(start + day * 86_400_000).toISOString().slice(0, 10),
    Brand: m.brand, Model: m.model,
    Price: Math.round(m.price * (0.95 + rand() * 0.1)),
    Cost: Math.round(m.cost * (0.95 + rand() * 0.1)),
    CustomerAge: 22 + Math.floor(rand() * 45),
    Region: ["North", "South", "East", "West"][Math.floor(rand() * 4)],
  });
}

const table: Table = { name: "parity.csv", columns: cols, rows, rowCount: rows.length };
const ts = await analyze(table, { skipCharts: true });
const tsKpis = Object.fromEntries(ts.kpis.map((k) => [k.name, String(k.value)]));
const tsOut = {
  domain: ts.domain.domain,
  topKpi: ts.kpis[0]?.name ?? null,
  kpiNames: ts.kpis.map((k) => k.name),
  kpis: tsKpis,
};
// Both engines expose a "Top <dimension>" KPI (value like "Toyota · 38%"); compare the leader name.
const topKey = (names: string[]) => names.find((n) => n.startsWith("Top "));
const leader = (kpis: Record<string, string>, names: string[]) => {
  const k = topKey(names);
  return k ? String(kpis[k]).split("·")[0].trim() : null;
};

// Write the identical rows to CSV and run the Python engine on it.
const dir = mkdtempSync(join(tmpdir(), "parity-"));
const csvPath = join(dir, "parity.csv");
const esc = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
writeFileSync(csvPath, [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n"));
const pyRaw = execFileSync("py", [join(import.meta.dirname, "..", "api", "_parity_one.py"), csvPath], { encoding: "utf-8" });
const py = JSON.parse(pyRaw);

// Compare the headline conclusions (on what BOTH engines expose: the KPI set).
const tsLeader = leader(tsOut.kpis, tsOut.kpiNames);
const pyLeader = leader(py.kpis, py.kpiNames);
const headlineKpis = ["Total revenue", "Transactions", "Gross margin"];
const checks: [string, boolean][] = [
  [`domain match (${ts.domain.domain})`, tsOut.domain === py.domain],
  [`#1 KPI match (${tsOut.topKpi})`, tsOut.topKpi === py.topKpi],
  [`top-seller leader match (${tsLeader})`, tsLeader != null && tsLeader === pyLeader],
  [`both have headline KPIs [${headlineKpis}]`, headlineKpis.every((n) => n in tsOut.kpis && n in py.kpis)],
  ["no 'Average CustomerAge' in either", !tsOut.kpiNames.includes("Average CustomerAge") && !py.kpiNames.includes("Average CustomerAge")],
];

console.log("TS :", JSON.stringify(tsOut.kpis));
console.log("PY :", JSON.stringify(py.kpis));
console.log();
let failed = 0;
for (const [name, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); if (!ok) failed++; }
console.log();
if (failed) { console.log(`${failed} PARITY MISMATCH(ES)`); process.exit(1); }
console.log("PARITY OK — both engines agree on the headline conclusions.");
