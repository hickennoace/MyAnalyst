import type { Table } from "../types";

// Grounding eval suite: canonical (dataset, question, expected-number) cases that pin the EXACT figures
// the deterministic engine produces. The optional LLM narrator is grounded in these same numbers, so if
// a refactor ever changes a computed value, this suite fails loudly — the AI can never silently drift off
// the real data. Cases are plain data so they can also feed a future LLM-judge / regression dashboard.

export interface AnswerEval {
  name: string;
  table: Table;
  question: string;
  /** substrings (the exact numbers/labels) that MUST appear in the grounded answer. */
  expect: string[];
  /** substrings that must NOT appear — guards against a question being mis-grounded. */
  forbid?: string[];
}

// One canonical sales table with hand-verifiable totals:
//   North = 100 + 300 + 200 = 600 ; South = 200 + 150 + 100 = 450 ; grand total = 1,050.
//   Units total = 10+20+30+15+22+11 = 108. All rows are in 2023.
const SALES: Table = {
  name: "sales.csv",
  columns: ["Date", "Region", "Revenue", "Units"],
  rows: [
    { Date: "2023-01-01", Region: "North", Revenue: 100, Units: 10 },
    { Date: "2023-01-08", Region: "South", Revenue: 200, Units: 20 },
    { Date: "2023-01-15", Region: "North", Revenue: 300, Units: 30 },
    { Date: "2023-01-22", Region: "South", Revenue: 150, Units: 15 },
    { Date: "2023-01-29", Region: "North", Revenue: 200, Units: 22 },
    { Date: "2023-02-05", Region: "South", Revenue: 100, Units: 11 },
  ],
  rowCount: 6,
};

export const ANSWER_EVALS: AnswerEval[] = [
  { name: "total aggregate", table: SALES, question: "total revenue", expect: ["1,050"] },
  { name: "grouped average", table: SALES, question: "average revenue by region", expect: ["North", "200"] },
  { name: "ranking by total", table: SALES, question: "which region has the highest revenue", expect: ["North", "600"] },
  { name: "correlation", table: SALES, question: "correlation between revenue and units", expect: ["strong", "positive"] },
  { name: "row count", table: SALES, question: "how many records are there", expect: ["6"] },
  { name: "most common category", table: SALES, question: "most common region", expect: ["North"] },
  // Filters (Phase 1.1): the scoped numbers must be exact, not the whole-dataset totals.
  { name: "categorical filter", table: SALES, question: "total revenue for North", expect: ["600"], forbid: ["1,050"] },
  { name: "year filter (all in range)", table: SALES, question: "total revenue in 2023", expect: ["1,050"] },
  { name: "numeric filter", table: SALES, question: "total revenue where revenue is over 150", expect: ["700"], forbid: ["1,050"] },
  // Comparison (Phase 1.2).
  { name: "comparison", table: SALES, question: "compare revenue North vs South", expect: ["600", "450"] },
];
