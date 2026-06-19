import type { ColumnProfile, RfmAnalysis, RfmMember, RfmSegment, Table } from "./types";
import { numericColumn, dateColumn } from "./profile";
import { looksLikeEntity } from "./cohort";

// RFM segmentation - the classic customer-value model. Score every entity (customer) on three axes:
//   Recency   - how long since their last transaction (lower = better),
//   Frequency - how many transactions they made,
//   Monetary  - how much they spent in total,
// each into 1–5 quintiles, then bucket them into recognizable segments (Champions, Loyal, At Risk, …).
// Fires only on transaction-shaped data (an entity id + a date + a value column). Pure + worker-safe.

const MIN_CUSTOMERS = 8;
const DAY = 86_400_000;

interface SegmentDef {
  key: string;
  label: string;
  blurb: string;
  /** first matching rule wins; r/f are 1–5 quintile scores. */
  match: (r: number, f: number) => boolean;
}

// Ordered, mutually-exclusive rules (first match wins) - every (R,F) in 1–5 lands in exactly one bucket.
const SEGMENTS: SegmentDef[] = [
  { key: "champions", label: "Champions", blurb: "Recent, frequent, and high-spending - your best customers.", match: (r, f) => r >= 4 && f >= 4 },
  { key: "loyal", label: "Loyal", blurb: "Buy often and are still active - reward and retain them.", match: (r, f) => f >= 4 && r >= 2 },
  { key: "potential", label: "Potential / New", blurb: "Recent buyers who haven't built a habit yet - nurture them.", match: (r, f) => r >= 4 && f < 4 },
  { key: "at-risk", label: "At Risk", blurb: "Were valuable but haven't bought in a while - win them back.", match: (r, f) => r <= 2 && f >= 3 },
  { key: "hibernating", label: "Hibernating / Lost", blurb: "Low recency and low frequency - largely dormant.", match: (r, f) => r <= 2 && f < 3 },
  { key: "attention", label: "Needs Attention", blurb: "Middling on every axis - a nudge could tip them either way.", match: () => true },
];

/** Assign a 1–5 quintile score to each value by rank position. `higherIsBetter=false` inverts (for recency). */
function quintiles(values: number[], higherIsBetter: boolean): number[] {
  const n = values.length;
  const order = values.map((v, i) => [v, i] as [number, number]).sort((a, b) => a[0] - b[0]);
  const score = new Array<number>(n).fill(3);
  order.forEach(([, origIdx], rank) => {
    let s = Math.min(5, Math.floor((rank / n) * 5) + 1);
    if (!higherIsBetter) s = 6 - s;
    score[origIdx] = s;
  });
  return score;
}

function pickColumns(table: Table, profiles: ColumnProfile[]): { entity: ColumnProfile; date: ColumnProfile; value: ColumnProfile } | null {
  // A repeating customer column is usually typed "category" (not "id"), so - like cohort analysis - fall
  // back to an id-ish-named column that recurs. `distinctCount < rowCount` ensures real repeat custom.
  const entity =
    profiles.find((p) => p.role === "identifier" && p.distinctCount >= MIN_CUSTOMERS && p.distinctCount < table.rowCount) ??
    profiles.find((p) => looksLikeEntity(p.name) && p.distinctCount >= MIN_CUSTOMERS && p.distinctCount < table.rowCount);
  const date = profiles.find((p) => p.role === "time" && p.type === "date");
  // Prefer a currency column for monetary; fall back to the largest-sum metric.
  const value =
    profiles.find((p) => p.role === "metric" && p.type === "currency" && (p.numeric?.sum ?? 0) > 0) ??
    profiles
      .filter((p) => p.role === "metric" && p.numeric && (p.numeric.sum ?? 0) > 0)
      .sort((a, b) => (b.numeric!.sum ?? 0) - (a.numeric!.sum ?? 0))[0];
  if (!entity || !date || !value) return null;
  return { entity, date, value };
}

interface RfmDetail {
  entity: string;
  dateColumn: string;
  valueColumn: string;
  asOfDay: number;
  members: RfmMember[];
}

/** Score every entity into RFM members - the shared core behind both the summary and the export. */
function rfmDetail(table: Table, profiles: ColumnProfile[]): RfmDetail | undefined {
  const cols = pickColumns(table, profiles);
  if (!cols) return undefined;

  const dates = dateColumn(table, cols.date.name);
  const values = numericColumn(table, cols.value.name);

  // Roll transactions up per entity: last-seen day, transaction count, total spend.
  interface Acc { lastDay: number; freq: number; monetary: number }
  const byEntity = new Map<string, Acc>();
  let asOfDay = -Infinity;
  table.rows.forEach((r, i) => {
    const iso = dates[i];
    if (!iso) return; // a transaction needs a date to score recency
    const day = Math.floor(Date.parse(iso) / DAY);
    if (!Number.isFinite(day)) return;
    const id = r[cols.entity.name];
    if (id === null || id === undefined || id === "") return;
    const key = String(id);
    if (day > asOfDay) asOfDay = day;
    const acc = byEntity.get(key) ?? { lastDay: -Infinity, freq: 0, monetary: 0 };
    acc.freq += 1;
    if (day > acc.lastDay) acc.lastDay = day;
    const v = values[i];
    if (Number.isFinite(v) && v >= 0) acc.monetary += v;
    byEntity.set(key, acc);
  });

  const ids = [...byEntity.keys()];
  if (ids.length < MIN_CUSTOMERS || !Number.isFinite(asOfDay)) return undefined;

  const recencyDays = ids.map((id) => asOfDay - byEntity.get(id)!.lastDay);
  const freq = ids.map((id) => byEntity.get(id)!.freq);
  const monetary = ids.map((id) => byEntity.get(id)!.monetary);

  const rScore = quintiles(recencyDays, false); // fewer days since last seen = better
  const fScore = quintiles(freq, true);

  const members: RfmMember[] = ids.map((id, i) => {
    const def = SEGMENTS.find((s) => s.match(rScore[i], fScore[i]))!;
    return {
      id,
      recencyDays: recencyDays[i],
      frequency: freq[i],
      monetary: monetary[i],
      rScore: rScore[i],
      fScore: fScore[i],
      segmentKey: def.key,
      segmentLabel: def.label,
    };
  });

  return { entity: cols.entity.name, dateColumn: cols.date.name, valueColumn: cols.value.name, asOfDay, members };
}

/** The per-entity membership behind the RFM segments - used to export a segment as a worklist. */
export function rfmMembers(table: Table, profiles: ColumnProfile[]): RfmMember[] | undefined {
  return rfmDetail(table, profiles)?.members;
}

export function analyzeRfm(table: Table, profiles: ColumnProfile[]): RfmAnalysis | undefined {
  const detail = rfmDetail(table, profiles);
  if (!detail) return undefined;
  const { members } = detail;

  // Aggregate entities into their segments.
  interface Bucket { size: number; recency: number; freq: number; monetary: number }
  const buckets = new Map<string, Bucket>();
  for (const m of members) {
    const b = buckets.get(m.segmentKey) ?? { size: 0, recency: 0, freq: 0, monetary: 0 };
    b.size += 1;
    b.recency += m.recencyDays;
    b.freq += m.frequency;
    b.monetary += m.monetary;
    buckets.set(m.segmentKey, b);
  }

  const grandMonetary = members.reduce((s, m) => s + m.monetary, 0) || 1;
  const segments: RfmSegment[] = SEGMENTS.filter((d) => buckets.has(d.key)).map((d) => {
    const b = buckets.get(d.key)!;
    return {
      key: d.key,
      label: d.label,
      blurb: d.blurb,
      size: b.size,
      sharePct: (b.size / members.length) * 100,
      avgRecencyDays: b.recency / b.size,
      avgFrequency: b.freq / b.size,
      avgMonetary: b.monetary / b.size,
      totalMonetary: b.monetary,
      monetaryShare: b.monetary / grandMonetary,
    };
  });
  segments.sort((a, b) => b.totalMonetary - a.totalMonetary);

  return {
    entity: detail.entity,
    dateColumn: detail.dateColumn,
    valueColumn: detail.valueColumn,
    asOf: new Date(detail.asOfDay * DAY).toISOString().slice(0, 10),
    customers: members.length,
    segments,
  };
}
