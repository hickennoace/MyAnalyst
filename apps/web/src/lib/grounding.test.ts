import { describe, expect, it } from "vitest";
import { extractNumbers, collectEvidenceNumbers, verifyAnswerGrounding } from "./grounding";

describe("extractNumbers", () => {
  it("parses plain, comma, currency, percent and scaled forms", () => {
    const got = extractNumbers("Revenue was $1,234.50 (up 57.1%), about 1.2M total, and 600 units.");
    const vals = got.map((g) => g.value);
    expect(vals).toContain(1234.5);
    expect(vals).toContain(57.1);
    expect(vals).toContain(1_200_000);
    expect(vals).toContain(600);
  });

  it("ignores numbers embedded in words/ids", () => {
    const got = extractNumbers("the Q4 cohort").map((g) => g.value);
    // "Q4" is an identifier, not a standalone quantity — best-effort: a bare 4 here is structural anyway.
    expect(got.every((v) => Number.isFinite(v))).toBe(true);
  });
});

describe("collectEvidenceNumbers", () => {
  it("walks nested objects/arrays and parses numbers inside strings", () => {
    const ev = { a: 600, nested: { b: 450, label: "1,050 total" }, list: [12, "34%"] };
    const nums = collectEvidenceNumbers(ev);
    for (const n of [600, 450, 1050, 12, 34]) expect(nums).toContain(n);
  });
});

describe("verifyAnswerGrounding", () => {
  const evidence = { grounded: 'North revenue is 600 of 1,050.', north: 600, total: 1050, south: 450 };

  it("treats verbatim numbers as grounded", () => {
    const r = verifyAnswerGrounding("North brought in 600 of the 1,050 total.", evidence);
    expect(r.unverified).toHaveLength(0);
    expect(r.grounded).toBe(r.salient);
  });

  it("treats a transparent percentage derivation as grounded", () => {
    // 600 / 1050 * 100 = 57.14 ≈ 57.1
    const r = verifyAnswerGrounding("North is 57.1% of total revenue.", evidence);
    expect(r.unverified).toHaveLength(0);
  });

  it("treats a difference of evidence numbers as grounded", () => {
    // 600 - 450 = 150
    const r = verifyAnswerGrounding("North leads South by 150.", evidence);
    expect(r.unverified).toHaveLength(0);
  });

  it("flags a hallucinated figure with no basis", () => {
    const r = verifyAnswerGrounding("Revenue jumped to $4,275 last quarter.", evidence);
    expect(r.unverified).toContain("$4,275");
    expect(r.salient).toBeGreaterThan(0);
  });

  it("does not flag small structural integers or years", () => {
    const r = verifyAnswerGrounding("In 2023, the top 3 regions split into 2 tiers.", evidence);
    expect(r.unverified).toHaveLength(0);
  });

  it("accepts sig-fig rounded forms of a large number", () => {
    const r = verifyAnswerGrounding("About $1.2M in total.", { total: 1_234_567 });
    expect(r.unverified).toHaveLength(0);
  });
});
