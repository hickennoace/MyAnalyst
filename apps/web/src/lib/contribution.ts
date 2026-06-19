import type { ColumnProfile, ContributionAnalysis, ContributionSegment, Table } from "./types";
import { numericColumn } from "./profile";
import { detectCadence, periodKey } from "./timeseries";

// Contribution / mix-shift decomposition - the single most common thing a human analyst is paid to
// explain: when a total moves between two periods, *how much* did each segment drive it? The per-segment
// deltas sum exactly to the total change (an additive decomposition), so the story always reconciles.
// Pure, dependency-free, metadata-only output (segment labels + numbers) - safe in the worker and on
// the read-only shared view.

const MAX_SEGMENTS = 8;

function periodSum(map: Map<string, number>): number {
  let s = 0;
  for (const v of map.values()) s += v;
  return s;
}

/**
 * Attribute the change in `metric`'s total between its two most recent periods to the values of
 * `dimension`. Returns undefined when there isn't enough history (need ≥2 periods of data).
 */
export function decomposeChange(table: Table, timeCol: string, metric: string, dimension: string): ContributionAnalysis | undefined {
  const vals = numericColumn(table, metric);
  const times: number[] = [];
  const recs: { t: number; seg: string; v: number }[] = [];
  table.rows.forEach((r, i) => {
    const d = new Date(String(r[timeCol]));
    if (Number.isNaN(d.getTime()) || !Number.isFinite(vals[i])) return;
    times.push(d.getTime());
    recs.push({ t: d.getTime(), seg: String(r[dimension] ?? "-"), v: vals[i] });
  });
  if (recs.length < 4) return undefined;

  const cadence = detectCadence(times);
  // period label -> (segment -> summed metric). Period keys (ISO day, yyyy-Www, yyyy-mm, yyyy-Qn, yyyy)
  // all sort lexicographically into chronological order, so a plain sort gives us time order.
  const byPeriod = new Map<string, Map<string, number>>();
  for (const rec of recs) {
    const pk = periodKey(new Date(rec.t), cadence);
    let segMap = byPeriod.get(pk);
    if (!segMap) byPeriod.set(pk, (segMap = new Map()));
    segMap.set(rec.seg, (segMap.get(rec.seg) ?? 0) + rec.v);
  }
  const periods = [...byPeriod.keys()].sort();
  if (periods.length < 2) return undefined;

  const prevLabel = periods[periods.length - 2];
  const latestLabel = periods[periods.length - 1];
  const prevMap = byPeriod.get(prevLabel)!;
  const latestMap = byPeriod.get(latestLabel)!;
  const prevTotal = periodSum(prevMap);
  const latestTotal = periodSum(latestMap);
  const totalDelta = latestTotal - prevTotal;
  const eps = 1e-9 * (Math.abs(prevTotal) + Math.abs(latestTotal) + 1);

  const segNames = new Set<string>([...prevMap.keys(), ...latestMap.keys()]);
  const all: ContributionSegment[] = [];
  for (const seg of segNames) {
    const prev = prevMap.get(seg) ?? 0;
    const latest = latestMap.get(seg) ?? 0;
    const delta = latest - prev;
    const status: ContributionSegment["status"] =
      prev === 0 && latest !== 0 ? "new"
      : latest === 0 && prev !== 0 ? "lost"
      : Math.abs(delta) <= eps ? "flat"
      : delta > 0 ? "grew" : "shrank";
    all.push({
      name: seg,
      prev,
      latest,
      delta,
      contributionPct: Math.abs(totalDelta) > eps ? delta / totalDelta : 0,
      sharePrev: prevTotal !== 0 ? prev / prevTotal : 0,
      shareLatest: latestTotal !== 0 ? latest / latestTotal : 0,
      status,
    });
  }
  all.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  // Roll everything past the top N into a single "Other" row so the deltas still sum to the total.
  let segments = all;
  if (all.length > MAX_SEGMENTS) {
    const head = all.slice(0, MAX_SEGMENTS);
    const tail = all.slice(MAX_SEGMENTS);
    const prev = tail.reduce((s, x) => s + x.prev, 0);
    const latest = tail.reduce((s, x) => s + x.latest, 0);
    const delta = latest - prev;
    head.push({
      name: `Other (${tail.length})`,
      prev,
      latest,
      delta,
      contributionPct: Math.abs(totalDelta) > eps ? delta / totalDelta : 0,
      sharePrev: prevTotal !== 0 ? prev / prevTotal : 0,
      shareLatest: latestTotal !== 0 ? latest / latestTotal : 0,
      status: Math.abs(delta) <= eps ? "flat" : delta > 0 ? "grew" : "shrank",
    });
    segments = head;
  }

  return {
    metric,
    dimension,
    cadence,
    prevLabel,
    latestLabel,
    prevTotal,
    latestTotal,
    totalDelta,
    totalDeltaPct: prevTotal !== 0 ? totalDelta / Math.abs(prevTotal) : null,
    segments,
  };
}

/**
 * Pick the most explanatory decompositions for the primary metric: try each low-cardinality dimension
 * and keep the ones where the change is meaningfully concentrated (a clear "driver" story), best first.
 */
export function buildContributions(table: Table, profiles: ColumnProfile[], metricName: string): ContributionAnalysis[] {
  const time = profiles.find((p) => p.role === "time");
  if (!time) return [];
  const dims = profiles.filter((p) => p.role === "dimension" && p.distinctCount >= 2 && p.distinctCount <= 30);
  const out: { a: ContributionAnalysis; spread: number }[] = [];
  for (const dim of dims.slice(0, 5)) {
    const a = decomposeChange(table, time.name, metricName, dim.name);
    if (!a || Math.abs(a.totalDelta) < 1e-9) continue;
    // "Concentration": how much of the GROSS movement one segment accounts for, in [0,1]. We divide by
    // the sum of |delta| (not by totalDelta) so near-cancelling segments - where totalDelta is tiny and
    // delta/totalDelta explodes to absurd percentages - don't get ranked as the sharpest story.
    const gross = a.segments.reduce((s, x) => s + Math.abs(x.delta), 0);
    const spread = gross > 0 ? Math.max(...a.segments.map((s) => Math.abs(s.delta))) / gross : 0;
    out.push({ a, spread });
  }
  out.sort((x, y) => y.spread - x.spread);
  return out.slice(0, 2).map((o) => o.a);
}
