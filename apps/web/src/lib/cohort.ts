import type { Cadence, ColumnProfile, CohortAnalysis, Table } from "./types";
import { detectCadence, periodKey } from "./timeseries";

// Cohort & retention analysis. When the data has an entity id (a customer/user/account that RECURS over
// time) plus a time column, group entities by the period they first appear (their cohort) and measure
// how many remain active in each later period. Output is a cohort × offset retention grid (offset 0 =
// 100%). Pure, metadata-only, worker-safe. Only meaningful when entities actually recur — otherwise
// returns undefined (e.g. one row per id is transactional, not retention, data).

const MAX_COHORTS = 12;
const MAX_OFFSETS = 12;

// Match entity-ish column names even when concatenated (CustomerID, user_id) — no \b, since there's no
// word boundary inside "CustomerID". A false positive is harmless: the recurrence gate below drops any
// "entity" whose rows don't actually repeat over time.
function looksLikeEntity(name: string): boolean {
  const n = name.toLowerCase().replace(/[\s_-]/g, "");
  return /customer|user|account|member|client|subscriber|email|uuid|guid|person|patient|player|device|session/.test(n) || /id$/.test(n);
}

/** Pick the entity-id column: a profiled identifier, else an id-ish-named column that recurs. */
function pickEntity(profiles: ColumnProfile[], rowCount: number): ColumnProfile | undefined {
  const byRole = profiles.find((p) => p.role === "identifier" && p.distinctCount > 1 && p.distinctCount < rowCount);
  if (byRole) return byRole;
  return profiles.find((p) => looksLikeEntity(p.name) && p.distinctCount > 1 && p.distinctCount < rowCount);
}

export function analyzeCohorts(table: Table, profiles: ColumnProfile[]): CohortAnalysis | undefined {
  const time = profiles.find((p) => p.role === "time");
  const entity = pickEntity(profiles, table.rowCount);
  if (!time || !entity) return undefined;

  // Gather (entity, timestamp) pairs.
  const times: number[] = [];
  const pairs: { id: string; t: number }[] = [];
  for (const r of table.rows) {
    const d = new Date(String(r[time.name]));
    const id = r[entity.name];
    if (Number.isNaN(d.getTime()) || id === null || id === undefined || id === "") continue;
    times.push(d.getTime());
    pairs.push({ id: String(id), t: d.getTime() });
  }
  if (pairs.length < 10) return undefined;

  const cadence: Cadence = detectCadence(times);

  // Map each entity → the set of period keys it's active in.
  const active = new Map<string, Set<string>>();
  for (const p of pairs) {
    const key = periodKey(new Date(p.t), cadence);
    let set = active.get(p.id);
    if (!set) active.set(p.id, (set = new Set()));
    set.add(key);
  }

  // Only meaningful if entities recur across periods.
  const avgPeriods = [...active.values()].reduce((s, set) => s + set.size, 0) / active.size;
  if (avgPeriods < 1.2) return undefined;

  // Chronological list of all periods → index.
  const allPeriods = [...new Set(pairs.map((p) => periodKey(new Date(p.t), cadence)))].sort();
  const periodIndex = new Map(allPeriods.map((k, i) => [k, i]));
  if (allPeriods.length < 2) return undefined;

  // Each entity's cohort = its first active period; record which period offsets it's active in.
  const cohortMembers = new Map<number, { ids: string[]; activeIdx: Set<number>[] }>();
  for (const [id, set] of active) {
    const idxs = [...set].map((k) => periodIndex.get(k)!).sort((a, b) => a - b);
    const first = idxs[0];
    let entry = cohortMembers.get(first);
    if (!entry) cohortMembers.set(first, (entry = { ids: [], activeIdx: [] }));
    entry.ids.push(id);
    entry.activeIdx.push(new Set(idxs));
  }

  // Build the retention grid (latest cohorts last; cap rows/cols for readability).
  const cohortStarts = [...cohortMembers.keys()].sort((a, b) => a - b).slice(-MAX_COHORTS);
  const cohorts = cohortStarts.map((start) => {
    const { ids, activeIdx } = cohortMembers.get(start)!;
    const maxOffset = Math.min(MAX_OFFSETS - 1, allPeriods.length - 1 - start);
    const retention: (number | null)[] = [];
    for (let k = 0; k <= maxOffset; k++) {
      const retained = activeIdx.filter((s) => s.has(start + k)).length;
      retention.push(Math.round((retained / ids.length) * 100));
    }
    return { label: allPeriods[start], size: ids.length, retention };
  });

  const periodCount = Math.max(...cohorts.map((c) => c.retention.length));
  return { entity: entity.name, time: time.name, cadence, cohorts, periodCount };
}
