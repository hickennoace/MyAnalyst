import type { ColumnProfile, Table, TextAnalysis, TextTerm } from "./types";

// Open-text / survey analytics: turn a free-text column (verbatims, feedback, reviews, notes) into
// themes + sentiment, entirely client-side. No tool an operator-BI platform self-serves reads
// open-ended feedback, and keeping it local makes it safe for HR / CSAT comments. Pure & dependency-free.
//
// Approach: tokenize → drop stopwords → rank unigrams + bigrams by frequency (bigrams subsume their
// component unigrams so "customer service" wins over "service"); lexicon sentiment per response.

const STOPWORDS = new Set(
  ("a an the and or but if then else for of to in on at by with from into over under again further " +
   "is are was were be been being have has had do does did doing will would can could should may might must " +
   "i you he she it we they them his her its our your their this that these those there here what which who whom " +
   "as so than too very just not no nor only own same s t can don it's i'm we're they're im dont " +
   "me my mine us out up down off no yes about above after before between because while during all any each few more most " +
   "other some such own get got really would also even much many one two it’s").split(/\s+/)
);

// Compact sentiment lexicon - enough to separate clearly positive/negative verbatims.
const POSITIVE = new Set(
  ("good great excellent amazing awesome love loved loving like helpful friendly fast easy best perfect happy " +
   "satisfied recommend wonderful fantastic nice smooth reliable quality clean enjoy enjoyed pleasant impressed " +
   "responsive efficient affordable value worth quick outstanding superb delightful brilliant").split(/\s+/)
);
const NEGATIVE = new Set(
  ("bad poor terrible awful hate hated horrible worst slow difficult hard confusing broken buggy expensive " +
   "disappointed disappointing rude unhelpful unfriendly dirty late delayed wrong error problem issue issues " +
   "frustrating frustrated annoying useless waste lacking missing crash crashes failed fails complaint refund").split(/\s+/)
);
const NEGATORS = new Set(["not", "no", "never", "n't", "without", "hardly", "barely"]);

function tokenize(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9'\s]/g, " ").split(/\s+/).filter(Boolean);
}

/** Score one response in [-1, 1] using the lexicon, with simple negation handling. */
function scoreSentiment(tokens: string[]): number {
  let score = 0;
  let hits = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    let polarity = POSITIVE.has(t) ? 1 : NEGATIVE.has(t) ? -1 : 0;
    if (polarity !== 0) {
      // flip if the preceding 1–2 tokens negate.
      if (NEGATORS.has(tokens[i - 1]) || NEGATORS.has(tokens[i - 2])) polarity *= -1;
      score += polarity;
      hits++;
    }
  }
  return hits === 0 ? 0 : Math.max(-1, Math.min(1, score / hits));
}

/** Candidate free-text columns: type "text" with genuinely multi-word, mostly-distinct values. */
export function textColumns(table: Table, profiles: ColumnProfile[]): ColumnProfile[] {
  return profiles.filter((p) => {
    if (p.type !== "text") return false;
    if (p.cardinalityRatio < 0.3) return false; // looks categorical, not free text
    const sample = table.rows.slice(0, 200).map((r) => String(r[p.name] ?? "")).filter(Boolean);
    if (sample.length < 5) return false;
    const avgWords = sample.reduce((s, v) => s + v.trim().split(/\s+/).length, 0) / sample.length;
    return avgWords >= 3;
  });
}

export function analyzeText(table: Table, column: string): TextAnalysis | undefined {
  const responses = table.rows.map((r) => String(r[column] ?? "").trim()).filter((s) => s.length > 0);
  if (responses.length < 5) return undefined;

  const uni = new Map<string, number>();
  const bi = new Map<string, number>();
  let wordTotal = 0;
  let pos = 0, neg = 0, neu = 0, scoreSum = 0;
  // a representative quote per top term: first concise response containing it.
  const tokensByResp: string[][] = [];

  for (const resp of responses) {
    const toks = tokenize(resp);
    tokensByResp.push(toks);
    wordTotal += toks.length;
    const isContent = (t: string) => !STOPWORDS.has(t) && t.length > 2;
    const content = toks.filter(isContent);
    const seenUni = new Set<string>();
    for (const t of content) if (!seenUni.has(t)) { uni.set(t, (uni.get(t) ?? 0) + 1); seenUni.add(t); }
    // Bigrams must be ADJACENT in the original text (both content words) - building them from the
    // compacted `content` array would join words that weren't next to each other ("good slow" from
    // "...good but slow..."), surfacing phrases nobody actually wrote.
    const seenBi = new Set<string>();
    for (let i = 0; i < toks.length - 1; i++) {
      if (!isContent(toks[i]) || !isContent(toks[i + 1])) continue;
      const g = `${toks[i]} ${toks[i + 1]}`;
      if (!seenBi.has(g)) { bi.set(g, (bi.get(g) ?? 0) + 1); seenBi.add(g); }
    }
    const sc = scoreSentiment(toks);
    scoreSum += sc;
    if (sc > 0.15) pos++; else if (sc < -0.15) neg++; else neu++;
  }

  // Merge bigrams (≥2 occurrences) with the unigrams they don't subsume.
  const topBi = [...bi.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const biWords = new Set(topBi.flatMap(([g]) => g.split(" ")));
  const topUni = [...uni.entries()].filter(([w]) => !biWords.has(w)).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const merged = [...topBi, ...topUni].sort((a, b) => b[1] - a[1]).slice(0, 8);

  const findQuote = (term: string): string | undefined => {
    const parts = term.split(" ");
    for (let i = 0; i < responses.length; i++) {
      const toks = tokensByResp[i];
      const hit = parts.every((p) => toks.includes(p));
      if (hit && responses[i].length <= 160) return responses[i];
    }
    // fall back to a truncated longer match
    for (let i = 0; i < responses.length; i++) {
      if (parts.every((p) => tokensByResp[i].includes(p))) return responses[i].slice(0, 157) + "…";
    }
    return undefined;
  };

  const terms: TextTerm[] = merged.map(([term, count]) => ({
    term,
    count,
    share: count / responses.length,
    sample: findQuote(term),
  }));

  return {
    column,
    responseCount: responses.length,
    avgWords: Math.round((wordTotal / responses.length) * 10) / 10,
    terms,
    sentiment: pos + neg + neu > 0
      ? { positive: pos / responses.length, neutral: neu / responses.length, negative: neg / responses.length, score: scoreSum / responses.length }
      : undefined,
  };
}

/** Analyze up to `limit` free-text columns in the table. */
export function buildTextAnalyses(table: Table, profiles: ColumnProfile[], limit = 2): TextAnalysis[] {
  return textColumns(table, profiles)
    .slice(0, limit)
    .map((p) => analyzeText(table, p.name))
    .filter((a): a is TextAnalysis => a !== undefined);
}
