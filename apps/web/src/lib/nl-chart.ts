import type { ChartType, ColumnProfile } from "./types";
import type { ChartRequest } from "./charts";

// Heuristic natural-language → ChartRequest parser. The "smart" chart generation, no API key.
// It resolves column names fuzzily and infers a sensible chart type from the words + data shape.

const CATEGORY_HINT = /(reason|category|type|status|segment|group|class|gender|channel|source|outcome|result|stage|priority|label|tag|product|region|country|state|city|department)/i;

const TYPE_WORDS: { type: ChartType; words: RegExp }[] = [
  { type: "line", words: /\b(line|trend|over time|timeline|time series)\b/i },
  { type: "bar", words: /\b(bar|compare|comparison|by | per |breakdown|ranking|top)\b/i },
  { type: "pie", words: /\b(pie|share|composition|proportion|percentage of|split)\b/i },
  { type: "scatter", words: /\b(scatter|relationship|correlat|vs\.?|versus|against)\b/i },
  { type: "area", words: /\b(area|cumulative|stacked area)\b/i },
  { type: "histogram", words: /\b(histogram|distribution|spread|frequency)\b/i },
];

export interface NlResult {
  request?: ChartRequest;
  /** Human explanation of what was understood (or why it failed). */
  message: string;
}

function resolveColumn(token: string, profiles: ColumnProfile[]): ColumnProfile | undefined {
  const t = token.toLowerCase().trim();
  if (!t) return undefined;
  // exact, then contains, then word-overlap.
  let hit = profiles.find((p) => p.name.toLowerCase() === t);
  if (hit) return hit;
  hit = profiles.find((p) => p.name.toLowerCase().includes(t) || t.includes(p.name.toLowerCase()));
  if (hit) return hit;
  const tWords = new Set(t.split(/\s+/));
  return profiles.find((p) => p.name.toLowerCase().split(/\s+/).some((w) => tWords.has(w)));
}

/** Find any column names explicitly mentioned in the prompt. */
function mentionedColumns(prompt: string, profiles: ColumnProfile[]): ColumnProfile[] {
  const lp = prompt.toLowerCase();
  return profiles.filter((p) => lp.includes(p.name.toLowerCase())).sort(
    (a, b) => lp.indexOf(a.name.toLowerCase()) - lp.indexOf(b.name.toLowerCase())
  );
}

export function parseChartRequest(prompt: string, profiles: ColumnProfile[]): NlResult {
  const p = prompt.trim();
  if (!p) return { message: "Type what you'd like to see, e.g. \"revenue by region as a bar chart\"." };

  // 1. Chart type from words (default decided later from data shape).
  let type: ChartType | undefined = TYPE_WORDS.find((t) => t.words.test(p))?.type;

  // 2. Columns: prefer explicit "<y> by/vs <x>" structure, else any mentioned columns.
  const byMatch = p.match(/(.+?)\s+(?:by|per|across|over|against|vs\.?|versus)\s+(.+)/i);
  let xProfile: ColumnProfile | undefined;
  let yProfiles: ColumnProfile[] = [];

  if (byMatch) {
    const yPart = byMatch[1].replace(/^(show|plot|draw|chart|graph|a|the|me)\s+/gi, "");
    yProfiles = yPart.split(/,|and/).map((s) => resolveColumn(s, profiles)).filter(Boolean) as ColumnProfile[];
    xProfile = resolveColumn(byMatch[2], profiles);
  }

  const mentioned = mentionedColumns(p, profiles);
  const metrics = profiles.filter((p2) => p2.role === "metric");
  const time = profiles.find((p2) => p2.role === "time");
  const dims = profiles.filter((p2) => p2.role === "dimension");

  if (!xProfile && !yProfiles.length && mentioned.length) {
    // Assign mentioned columns by role.
    yProfiles = mentioned.filter((m) => m.role === "metric");
    xProfile = mentioned.find((m) => m.role === "time" || m.role === "dimension");
  }

  // 2b. Count mode — for categorical/string columns where there's no metric to plot
  // (e.g. "most common reason for not buying"). Tally rows per value.
  const countIntent = /\b(count|most common|number of|distribution|frequency|how often|breakdown|how many|tally)\b/i.test(p);
  const mentionsMetric = mentioned.some((m) => m.role === "metric") || yProfiles.some((y) => y.role === "metric");
  if (countIntent || (mentioned.length > 0 && !mentionsMetric && mentioned.some((m) => m.role === "dimension"))) {
    const catCol =
      (xProfile && xProfile.role !== "metric" ? xProfile : undefined) ??
      mentioned.find((m) => m.role === "dimension") ??
      dims.find((d) => CATEGORY_HINT.test(d.name)) ??
      dims[0];
    if (catCol) {
      const chartType: ChartType = type === "pie" ? "pie" : "bar";
      return {
        request: { type: chartType, x: catCol.name, y: [], count: true },
        message: `Counting how often each ${catCol.name} occurs.`,
      };
    }
  }

  // 3. Fill gaps with sensible defaults from data shape.
  if (!yProfiles.length && metrics.length) yProfiles = [metrics[0]];
  if (!xProfile) xProfile = time ?? dims[0] ?? metrics.find((m) => !yProfiles.includes(m));

  // 4. Infer type if not stated.
  if (!type) {
    if (xProfile?.role === "time") type = "line";
    else if (xProfile?.role === "dimension") type = "bar";
    else if (yProfiles.length >= 1 && xProfile?.role === "metric") type = "scatter";
    else type = "bar";
  }

  // 5. Histogram needs only one metric.
  if (type === "histogram") {
    const m = yProfiles[0] ?? (xProfile?.role === "metric" ? xProfile : metrics[0]);
    if (!m) return { message: "I couldn't find a numeric column to build a distribution from." };
    return {
      request: { type, x: m.name, y: [m.name] },
      message: `Showing the distribution of ${m.name}.`,
    };
  }

  // scatter needs x metric + y metric
  if (type === "scatter") {
    const xs = xProfile?.role === "metric" ? xProfile : metrics[0];
    const ysC = yProfiles.find((y) => y !== xs) ?? metrics.find((m) => m !== xs);
    if (!xs || !ysC) return { message: "Scatter needs two numeric columns; I couldn't find both." };
    return { request: { type, x: xs.name, y: [ysC.name] }, message: `Plotting ${xs.name} vs ${ysC.name}.` };
  }

  if (!xProfile || !yProfiles.length) {
    return {
      message:
        "I couldn't map that to columns. Try naming them, e.g. \"" +
        (metrics[0]?.name ?? "value") + " by " + (dims[0]?.name ?? time?.name ?? "category") + "\".",
    };
  }

  return {
    request: { type, x: xProfile.name, y: yProfiles.map((y) => y.name), aggregate: xProfile.role === "dimension" },
    message: `${capitalize(type)} chart of ${yProfiles.map((y) => y.name).join(", ")} by ${xProfile.name}.`,
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
