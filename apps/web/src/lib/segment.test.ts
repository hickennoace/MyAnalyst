import { describe, expect, it } from "vitest";
import { segmentMembers, segmentRows } from "./segment";
import { profileTable } from "./profile";
import type { Table } from "./types";

// Two clearly-separated blobs in (Spend, Visits) space: a low-low group and a high-high group.
function twoClusterTable(): Table {
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < 30; i++) rows.push({ Spend: 10 + (i % 5), Visits: 2 + (i % 3) });
  for (let i = 0; i < 30; i++) rows.push({ Spend: 500 + (i % 5), Visits: 80 + (i % 3) });
  return { name: "c.csv", columns: ["Spend", "Visits"], rows, rowCount: rows.length };
}

describe("segmentRows", () => {
  it("finds well-separated groups and describes them", () => {
    const t = twoClusterTable();
    const seg = segmentRows(t, profileTable(t))!;
    expect(seg).toBeDefined();
    expect(seg.k).toBeGreaterThanOrEqual(2);
    expect(seg.segments).toHaveLength(seg.k);
    expect(seg.segments.reduce((s, g) => s + g.size, 0)).toBe(60);
    // The two extreme blobs must land in different clusters → both a high-Spend and a low-Spend group.
    const dirs = seg.segments.map((s) => s.defining.find((d) => d.column === "Spend")?.direction);
    expect(dirs).toContain("high");
    expect(dirs).toContain("low");
  });

  it("returns undefined with too few rows or features", () => {
    const small: Table = { name: "s.csv", columns: ["A", "B"], rows: [{ A: 1, B: 2 }], rowCount: 1 };
    expect(segmentRows(small, profileTable(small))).toBeUndefined();
  });

  it("is deterministic across runs", () => {
    const t = twoClusterTable();
    const p = profileTable(t);
    const a = segmentRows(t, p)!;
    const b = segmentRows(t, p)!;
    expect(a.segments.map((s) => s.size).sort()).toEqual(b.segments.map((s) => s.size).sort());
  });
});

describe("segmentMembers", () => {
  it("assigns clustered rows to the same clusters segmentRows reports, with matching sizes", () => {
    const t = twoClusterTable();
    const p = profileTable(t);
    const seg = segmentRows(t, p)!;
    const members = segmentMembers(t, p)!;
    // Every clustered row appears once, indices are valid into the table.
    expect(members.every((m) => m.rowIndex >= 0 && m.rowIndex < t.rowCount)).toBe(true);
    // Per-cluster counts line up with the reported segment sizes (same seed, same pipeline).
    for (const s of seg.segments) {
      expect(members.filter((m) => m.cluster === s.id)).toHaveLength(s.size);
    }
  });

  it("returns undefined when segmentation doesn't apply", () => {
    const small: Table = { name: "s.csv", columns: ["A", "B"], rows: [{ A: 1, B: 2 }], rowCount: 1 };
    expect(segmentMembers(small, profileTable(small))).toBeUndefined();
  });
});
