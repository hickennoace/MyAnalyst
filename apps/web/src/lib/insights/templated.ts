import type { Insight, InsightContext, InsightProvider } from "../types";

// Templated insight provider: turns the metadata-only InsightContext into grounded, plain-language
// conclusions. Every sentence is filled with numbers the local engine actually computed — so it can't
// hallucinate. Bilingual (English + natural Hebrew) via ctx.lang. Default "smart" narrator.

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

export class TemplatedInsightProvider implements InsightProvider {
  readonly name = "templated";
  lastSource: "llm" | "templated" = "templated";

  async generate(ctx: InsightContext): Promise<Insight[]> {
    this.lastSource = "templated";
    const he = ctx.lang === "he";
    const L = (en: string, hebrew: string) => (he ? hebrew : en);
    const insights: Insight[] = [];

    // 1. Headline summary — set the scene in one friendly sentence.
    const headlineKpi = ctx.kpis[0];
    insights.push({
      id: "ins-summary",
      kind: "summary",
      confidence: "high",
      cites: headlineKpi ? [headlineKpi.id] : [],
      text: L(
        `Here's what your ${labelDomain(ctx.domain, false)} data looks like: ${ctx.rowCount.toLocaleString()} rows ` +
          `and ${ctx.columns.length} columns` +
          (headlineKpi ? `. The number that jumps out most is ${headlineKpi.name} — ${headlineKpi.value}${headlineKpi.unit ? " " + headlineKpi.unit : ""}.` : "."),
        `הנה איך נראים נתוני ה${labelDomain(ctx.domain, true)} שלכם: ${ctx.rowCount.toLocaleString()} שורות ` +
          `ו־${ctx.columns.length} עמודות` +
          (headlineKpi ? `. המספר שהכי בולט הוא ${headlineKpi.name} — ${headlineKpi.value}${headlineKpi.unit ? " " + headlineKpi.unit : ""}.` : ".")
      ),
    });

    // 2. Trends — is it really going somewhere, in plain words.
    for (const t of ctx.trends.slice(0, 2)) {
      const kpi = ctx.kpis.find((k) => k.id.includes(t.metric));
      const amt = pct(Math.abs(t.changePct));
      let text: string;
      if (t.direction === "up") text = L(`Good news — ${t.metric} has been climbing, up about ${amt} from start to finish (${fmt(t.from)} → ${fmt(t.to)}). It's worth figuring out what's working so you can keep it going.`, `חדשות טובות — ${t.metric} מטפס, עלייה של כ־${amt} מההתחלה לסוף (${fmt(t.from)} ← ${fmt(t.to)}). כדאי להבין מה עובד כדי להמשיך עם זה.`);
      else if (t.direction === "down") text = L(`Heads up — ${t.metric} has been slipping, down about ${amt} over the period (${fmt(t.from)} → ${fmt(t.to)}). It's a good idea to look into why before it drops further.`, `שימו לב — ${t.metric} יורד, ירידה של כ־${amt} לאורך התקופה (${fmt(t.from)} ← ${fmt(t.to)}). כדאי לבדוק למה לפני שזה ימשיך לרדת.`);
      else text = L(`${t.metric} stayed pretty steady over the period (${fmt(t.from)} → ${fmt(t.to)}) — no real ups or downs to worry about.`, `${t.metric} נשאר די יציב לאורך התקופה (${fmt(t.from)} ← ${fmt(t.to)}) — בלי עליות או ירידות אמיתיות שכדאי לדאוג מהן.`);
      insights.push({ id: `ins-trend-${t.metric}`, kind: "trend", confidence: Math.abs(t.changePct) > 0.05 ? "high" : "medium", cites: kpi ? [kpi.id] : [], text });
    }

    // 3. Correlations — "these two move together", with an honest caveat.
    const strong = ctx.correlations.filter((c) => c.strength !== "weak").slice(0, 2);
    for (const c of strong) {
      const strengthHe = c.strength === "strong" ? "חזק" : "בינוני";
      const text = L(
        `${c.a} and ${c.b} tend to move together — ${c.r > 0 ? `when ${c.a} goes up, ${c.b} usually goes up` : `when ${c.a} goes up, ${c.b} usually goes down`} (a ${c.strength} link, r = ${c.r.toFixed(2)}). ` +
          (c.significant ? `This looks like a real connection, not just chance. ` : `But it's weak enough that it might just be coincidence — don't lean on it yet. `) +
          `Just remember: moving together doesn't prove one causes the other.`,
        `${c.a} ו־${c.b} נוטים לנוע יחד — ${c.r > 0 ? `כש־${c.a} עולה, ${c.b} בדרך כלל עולה` : `כש־${c.a} עולה, ${c.b} בדרך כלל יורד`} (קשר ${strengthHe}, r = ${c.r.toFixed(2)}). ` +
          (c.significant ? `זה נראה כמו קשר אמיתי, לא סתם מקריות. ` : `אבל זה חלש מספיק כדי שיכול להיות סתם צירוף מקרים — אל תסתמכו על זה עדיין. ` ) +
          `רק זכרו: תנועה משותפת לא מוכיחה שאחד גורם לשני.`
      );
      insights.push({ id: `ins-corr-${c.a}-${c.b}`, kind: "correlation", confidence: c.significant ? (c.strength === "strong" ? "high" : "medium") : "low", cites: [`corr:${c.a}~${c.b}`], text });
    }

    // 4. Regression — "if you nudge X, Y tends to follow".
    if (ctx.regression && ctx.regression.r2 > 0.1) {
      const r = ctx.regression;
      const text = L(
        `${r.driver} seems to be a real lever for ${r.target}: as a rough rule, every extra 1 of ${r.driver} comes with about ${r.slope >= 0 ? "+" : ""}${fmt(r.slope)} ${r.target}. ` +
          `On its own, ${r.driver} explains roughly ${pct(r.adjR2)} of why ${r.target} moves` +
          (r.significant ? `, and the pattern is reliable enough to take seriously.` : `, but the pattern isn't reliable yet — treat it as a hint.`),
        `${r.driver} נראה כמו מנוף אמיתי ל־${r.target}: ככלל אצבע, כל יחידה נוספת של ${r.driver} מלווה בערך ב־${r.slope >= 0 ? "+" : ""}${fmt(r.slope)} ${r.target}. ` +
          `בפני עצמו, ${r.driver} מסביר כ־${pct(r.adjR2)} מהתנועה של ${r.target}` +
          (r.significant ? `, והדפוס אמין מספיק כדי להתייחס אליו ברצינות.` : `, אבל הדפוס עדיין לא אמין — התייחסו אליו כרמז.`)
      );
      insights.push({ id: "ins-regression", kind: "regression", confidence: r.significant ? (r.adjR2 > 0.5 ? "high" : "medium") : "low", cites: ["regression"], text });
    }

    // 4b. Forecast — where things are heading if nothing changes.
    if (ctx.forecast) {
      const f = ctx.forecast;
      const dirEn = f.changePct > 0.02 ? "keep rising" : f.changePct < -0.02 ? "keep falling" : "hold about steady";
      const dirHe = f.changePct > 0.02 ? "להמשיך לעלות" : f.changePct < -0.02 ? "להמשיך לרדת" : "להישאר פחות או יותר יציב";
      const text = L(
        `If the recent pattern holds, ${f.metric} should ${dirEn} over the next ${f.horizon} period${f.horizon === 1 ? "" : "s"} — from about ${fmt(f.lastValue)} now to roughly ${fmt(f.projected)} (${f.changePct >= 0 ? "up" : "down"} about ${pct(Math.abs(f.changePct))}). It's a best guess based on the trend, so revisit it as new numbers come in.`,
        `אם הדפוס האחרון יישמר, ${f.metric} אמור ${dirHe} במהלך ${f.horizon} התקופות הקרובות — מכ־${fmt(f.lastValue)} כעת לכ־${fmt(f.projected)} (${f.changePct >= 0 ? "עלייה" : "ירידה"} של כ־${pct(Math.abs(f.changePct))}). זו הערכה לפי המגמה, אז כדאי לעדכן ככל שמגיעים נתונים חדשים.`
      );
      insights.push({ id: "ins-forecast", kind: "trend", confidence: "medium", cites: ["forecast"], text });
    }

    // 4c. Most common category value (e.g. top reason).
    const cat = ctx.categories[0];
    if (cat && cat.top[0]) {
      const top = cat.top[0];
      const text = L(
        `By far the most common ${cat.column} is "${top.value}", appearing in ${pct(top.pct)} of records (${top.count} of ${cat.total})` +
          (cat.top[1] ? `, followed by "${cat.top[1].value}" (${pct(cat.top[1].pct)}).` : "."),
        `ה־${cat.column} הנפוץ ביותר בהפרש גדול הוא "${top.value}", שמופיע ב־${pct(top.pct)} מהשורות (${top.count} מתוך ${cat.total})` +
          (cat.top[1] ? `, ואחריו "${cat.top[1].value}" (${pct(cat.top[1].pct)}).` : ".")
      );
      insights.push({ id: `ins-cat-${cat.column}`, kind: "composition", confidence: top.pct >= 0.4 ? "high" : "medium", cites: [`category:${cat.column}`], text });
    }

    // 5. Outliers — a gentle "double-check these" nudge.
    for (const o of ctx.outliers.slice(0, 1)) {
      if (o.count > 0) {
        const ex = o.examples[0];
        const text = L(
          `A few ${o.column} values look unusually high or low (${o.count} of them` + (ex ? `, the most extreme being ${fmt(ex.value)}` : "") + `). Odd values like these can quietly skew the averages, so it's worth a quick check on whether they're real or just typos.`,
          `כמה ערכים של ${o.column} נראים גבוהים או נמוכים בצורה חריגה (${o.count} כאלה` + (ex ? `, והקיצוני ביותר הוא ${fmt(ex.value)}` : "") + `). ערכים חריגים כאלה יכולים לעוות בשקט את הממוצעים, אז שווה בדיקה זריזה אם הם אמיתיים או סתם טעויות הקלדה.`
        );
        insights.push({ id: `ins-outlier-${o.column}`, kind: "outlier", confidence: "medium", cites: [`outlier:${o.column}`], text });
      }
    }

    return insights;
  }
}

function labelDomain(d: InsightContext["domain"], he: boolean): string {
  if (he) {
    switch (d) {
      case "financial-timeseries": return "סדרת זמן פיננסית";
      case "sales-operational": return "מכירות / תפעול";
      case "marketing": return "שיווק";
      case "survey": return "סקר";
      default: return "כללי";
    }
  }
  switch (d) {
    case "financial-timeseries": return "financial time-series";
    case "sales-operational": return "sales / operational";
    case "marketing": return "marketing";
    case "survey": return "survey";
    default: return "general";
  }
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1000) return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
}
