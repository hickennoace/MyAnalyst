// Numeric grounding verifier (Wave 3 W3.6). The optional LLM answers in prose; this checks that the
// NUMBERS it states are actually anchored to the pre-computed evidence - verbatim, a rounded form, or a
// transparent arithmetic derivation (difference, ratio, %, share) of evidence numbers. It powers a
// subtle "grounded in your data" / "unverified figure" trust signal on AI answers.
//
// Design bias: be GENEROUS about what counts as grounded. A false "unverified" warning on a legitimate
// figure erodes trust far more than silently missing one fabricated number, so tolerances are wide and
// structural numbers (small counts, years) are exempt. This is a confidence signal, never a hard gate.

export interface NumberToken {
  raw: string;
  value: number;
}

const SCALE: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9 };

// $1,234.50 | 57.1% | 1.2M | 3k | 600 - a number with optional leading $, thousands separators, a
// decimal, and an optional trailing % or K/M/B scale suffix (not immediately followed by a letter).
const NUM_RE = /(\$)?(-?\d[\d,]*(?:\.\d+)?)(\s*%|\s*[kmb](?![a-z]))?/gi;

/** Extract the salient numeric tokens from a piece of prose. */
export function extractNumbers(text: string): NumberToken[] {
  const out: NumberToken[] = [];
  for (const m of text.matchAll(NUM_RE)) {
    const [raw, , digits, suffixRaw] = m;
    const base = parseFloat(digits.replace(/,/g, ""));
    if (!Number.isFinite(base)) continue;
    const suffix = (suffixRaw ?? "").trim().toLowerCase();
    let value = base;
    if (suffix && suffix !== "%") value = base * (SCALE[suffix] ?? 1);
    out.push({ raw: raw.trim(), value });
  }
  return out;
}

/** Every finite number reachable in the evidence payload - object/array values plus numbers parsed out
 *  of any string fields (labels, the grounded one-liner). Deduped. */
export function collectEvidenceNumbers(evidence: unknown): number[] {
  const set = new Set<number>();
  const visit = (v: unknown, depth: number): void => {
    if (depth > 8 || v == null) return;
    if (typeof v === "number") {
      if (Number.isFinite(v)) set.add(v);
    } else if (typeof v === "string") {
      for (const t of extractNumbers(v)) set.add(t.value);
    } else if (Array.isArray(v)) {
      for (const item of v) visit(item, depth + 1);
    } else if (typeof v === "object") {
      for (const item of Object.values(v as Record<string, unknown>)) visit(item, depth + 1);
    }
  };
  visit(evidence, 0);
  return [...set];
}

const roundSig = (n: number, sig: number): number => {
  if (n === 0) return 0;
  const d = Math.ceil(Math.log10(Math.abs(n)));
  const power = sig - d;
  const factor = 10 ** power;
  return Math.round(n * factor) / factor;
};

/** Is x close to e, allowing a wide relative tolerance and 2–3 sig-fig rounding ("$1.2M" ≈ 1,234,567)? */
function close(x: number, e: number): boolean {
  const tol = Math.max(0.5, Math.abs(e) * 0.03);
  if (Math.abs(x - e) <= tol) return true;
  return roundSig(e, 2) === x || roundSig(e, 3) === x;
}

/** Structural numbers we never flag: small counts/ordinals (≤ 12) and 4-digit years. */
function isStructural(value: number, raw: string): boolean {
  const formatted = /[$%]/.test(raw) || /[kmb]$/i.test(raw);
  if (!formatted && Number.isInteger(value) && Math.abs(value) <= 12) return true;
  if (Number.isInteger(value) && value >= 1900 && value <= 2099 && !formatted) return true;
  return false;
}

/** Can x be derived from a transparent operation on a pair of evidence numbers? */
function isDerivable(x: number, nums: number[]): boolean {
  for (let i = 0; i < nums.length; i++) {
    const a = nums[i];
    for (let j = 0; j < nums.length; j++) {
      if (i === j) continue;
      const b = nums[j];
      if (close(x, a - b)) return true; // difference
      if (close(x, a + b)) return true; // sum
      if (b !== 0) {
        if (close(x, (a / b) * 100)) return true; // % of
        if (close(x, a / b)) return true; // ratio / multiple
        if (a + b !== 0 && close(x, (a / (a + b)) * 100)) return true; // share of the two
        if (close(x, ((a - b) / b) * 100)) return true; // % change
      }
    }
  }
  return false;
}

export interface GroundingResult {
  /** How many salient (non-structural) numbers the answer stated. */
  salient: number;
  /** How many of those were anchored to the evidence. */
  grounded: number;
  /** The raw tokens that could not be verified. */
  unverified: string[];
}

/**
 * Verify the numbers in an LLM answer against the evidence it was given. Returns counts plus the list of
 * figures with no basis. An answer with `salient > 0 && unverified.length === 0` is fully grounded.
 */
export function verifyAnswerGrounding(answer: string, evidence: unknown): GroundingResult {
  const evNums = collectEvidenceNumbers(evidence).slice(0, 200);
  const direct = evNums.slice(0, 80); // cap the O(n²) derivation search to the first numbers
  const tokens = extractNumbers(answer);
  let salient = 0;
  let grounded = 0;
  const unverified: string[] = [];
  for (const t of tokens) {
    if (isStructural(t.value, t.raw)) continue;
    salient++;
    if (evNums.some((e) => close(t.value, e)) || isDerivable(t.value, direct)) grounded++;
    else if (!unverified.includes(t.raw)) unverified.push(t.raw);
  }
  return { salient, grounded, unverified };
}
