import { describe, expect, it } from "vitest";
import { sampleTable } from "./sample";

describe("sampleTable", () => {
  it("always produces a valid, non-empty table (across all generators)", () => {
    for (let i = 0; i < 80; i++) {
      const t = sampleTable();
      expect(t.columns.length).toBeGreaterThan(0);
      expect(t.rowCount).toBe(t.rows.length);
      expect(t.rows.length).toBeGreaterThan(10);
      // Every row is an object keyed by the declared columns.
      for (const c of t.columns) expect(c in t.rows[0]).toBe(true);
    }
  });
});
