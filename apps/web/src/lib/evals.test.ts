import { describe, expect, it } from "vitest";
import { answerQuestion } from "./query";
import { profileTable } from "./profile";
import { ANSWER_EVALS } from "./evals/answer-evals";

// Runs the grounding eval suite through the deterministic answer engine. Every case asserts the EXACT
// numbers appear — this is the guardrail that keeps the (AI-narrated) answers tied to the real data.

describe("answer grounding evals", () => {
  for (const c of ANSWER_EVALS) {
    it(c.name, () => {
      const r = answerQuestion(c.question, c.table, profileTable(c.table));
      expect(r.ok).toBe(true);
      for (const s of c.expect) expect(r.answer, `expected "${s}" in: ${r.answer}`).toContain(s);
      for (const s of c.forbid ?? []) expect(r.answer, `did not expect "${s}" in: ${r.answer}`).not.toContain(s);
    });
  }
});
