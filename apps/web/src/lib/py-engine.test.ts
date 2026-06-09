import { describe, it, expect, vi, afterEach } from "vitest";
import { sampleForPayload, runPythonConclusions, type PyAnalysisSpec } from "./py-engine";

const MAX = 3_800_000;

function rows(n: number, cols: string[], wide = false): Record<string, unknown>[] {
  return Array.from({ length: n }, (_, i) => {
    const r: Record<string, unknown> = {};
    for (const c of cols) r[c] = wide ? `${c}-value-${i}-padding-padding-padding` : i % 1000;
    return r;
  });
}

describe("sampleForPayload (adaptive byte-budget sampling)", () => {
  it("sends all rows when the dataset is small", () => {
    const out = sampleForPayload(["a", "b"], rows(5_000, ["a", "b"]));
    expect(out.length).toBe(5_000);
  });

  it("sends far more than the old 40k cap for a narrow table that fits", () => {
    const out = sampleForPayload(["a", "b"], rows(500_000, ["a", "b"]));
    expect(out.length).toBeGreaterThan(40_000); // adaptive — narrow rows fit many
    expect(out.length).toBeLessThanOrEqual(100_000); // bounded by the hard cap
    expect(JSON.stringify(out).length).toBeLessThan(MAX); // stays under the Vercel budget
  });

  it("keeps a wide table's payload under the Vercel limit (no 413)", () => {
    const cols = Array.from({ length: 30 }, (_, i) => `col${i}`);
    const out = sampleForPayload(cols, rows(200_000, cols, true));
    expect(JSON.stringify({ columns: cols, rows: out }).length).toBeLessThan(4_500_000);
    expect(out.length).toBeGreaterThan(0);
  });

  it("preserves column order in the emitted arrays", () => {
    const out = sampleForPayload(["x", "y", "z"], [{ z: 3, x: 1, y: 2 }]);
    expect(out[0]).toEqual([1, 2, 3]);
  });
});

// Transient backend failures used to silently blank the conclusions/KPIs (no retry). These pin the retry
// policy: retry the transient classes (5xx / network) a couple times; fail fast on a 4xx the retry can't fix.
const CONCLUDE_SPEC = {
  facts: [],
  kpis: [],
  chartReadings: [],
  domain: { domain: "generic", confidence: 1, reason: "" },
  narrative: "",
} as unknown as PyAnalysisSpec;
const okRes = (data: unknown) => ({ ok: true, status: 200, json: async () => data });
const failRes = (status: number, error = "boom") => ({ ok: false, status, json: async () => ({ error }) });

describe("postJson retry (via runPythonConclusions)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("retries a transient 5xx, then resolves with the eventual success", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(failRes(503))
      .mockResolvedValueOnce(okRes({ provider: "none", conclusions: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(runPythonConclusions(CONCLUDE_SPEC)).resolves.toMatchObject({ provider: "none" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries a network error (rejected fetch), then resolves", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(okRes({ provider: "groq", conclusions: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(runPythonConclusions(CONCLUDE_SPEC)).resolves.toMatchObject({ provider: "groq" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry a 4xx client error — fails fast", async () => {
    const fetchMock = vi.fn().mockResolvedValue(failRes(400, "bad payload"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(runPythonConclusions(CONCLUDE_SPEC)).rejects.toThrow("bad payload");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
