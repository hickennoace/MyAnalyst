import type { Conclusion, InsightContext } from "./types";

// Conclusion engine — the "so what?" layer. The reasoning is statistically rigorous (significance
// tests, ANOVA, regression, chi-square, FDR correction) but the WORDING is plain language aimed at
// someone with no statistics background. Bilingual: English + natural Hebrew, chosen by ctx.lang.
// The technical numbers live in each conclusion's optional `detail` line.

export const DISCLAIMER =
  "These takeaways are written automatically by AI from your data. AI can get things wrong or miss the bigger picture, and a pattern in the data doesn't always mean one thing causes another. Use them as a helpful starting point — and for anything important (money, health, legal, or big business decisions), check with a qualified expert first.";

function pctTxt(x: number): string {
  return `${Math.round(x * 100)}%`;
}
function num(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: Math.abs(n) >= 100 ? 0 : 2 }).format(n);
}
function pTxt(p: number): string {
  if (!Number.isFinite(p)) return "p = n/a";
  return p < 0.001 ? "p < 0.001" : `p = ${p.toFixed(3)}`;
}
function confFromP(p: number): Conclusion["confidence"] {
  return p < 0.01 ? "high" : p < 0.05 ? "medium" : "low";
}

type Draft = Omit<Conclusion, "id">;

export function deriveConclusions(ctx: InsightContext): Conclusion[] {
  const out: Draft[] = [];
  const he = ctx.lang === "he";
  // pick: choose English or Hebrew string
  const L = (en: string, hebrew: string) => (he ? hebrew : en);

  // 1. Group differences (ANOVA) — usually the most actionable.
  for (const g of ctx.groupComparisons.filter((g) => g.significant).slice(0, 2)) {
    out.push({
      confidence: confFromP(g.p),
      basis: `ANOVA ${g.metric} by ${g.dimension}`,
      text: L(
        `${g.metric} really does depend on the ${g.dimension}. "${g.top.name}" has the highest average ${g.metric} ` +
          `(about ${num(g.top.mean)}), while "${g.bottom.name}" has the lowest (about ${num(g.bottom.mean)}). ` +
          `This is a real difference, not random luck — so it's worth figuring out what makes "${g.top.name}" do better and copying it.`,
        `${g.metric} באמת תלוי ב־${g.dimension}. ל"${g.top.name}" יש הממוצע הגבוה ביותר של ${g.metric} ` +
          `(בערך ${num(g.top.mean)}), בעוד של"${g.bottom.name}" הנמוך ביותר (בערך ${num(g.bottom.mean)}). ` +
          `זה הבדל אמיתי ולא מקריות — אז כדאי להבין מה גורם ל"${g.top.name}" להצליח יותר וליישם את זה גם במקומות אחרים.`
      ),
      detail: L(
        `The ${g.dimension} accounts for about ${pctTxt(g.etaSq)} of the differences in ${g.metric}. (ANOVA F = ${num(g.f)}, ${pTxt(g.p)}.)`,
        `ה־${g.dimension} מסביר כ־${pctTxt(g.etaSq)} מההבדלים ב־${g.metric}. (ANOVA F = ${num(g.f)}, ${pTxt(g.p)}.)`
      ),
    });
  }

  // 2. Categorical dominance — e.g. "the most common reason for not buying".
  for (const cat of ctx.categories.slice(0, 2)) {
    const top = cat.top[0];
    if (!top) continue;
    const second = cat.top[1];
    if (top.pct >= 0.5) {
      out.push({
        confidence: "high",
        basis: `${cat.column} frequency`,
        text: L(
          `"${top.value}" is by far the most common ${cat.column} — it shows up in ${pctTxt(top.pct)} of cases ` +
            `(${top.count} out of ${cat.total}). Because it's so common, dealing with it first will make the biggest difference.`,
          `"${top.value}" הוא ה־${cat.column} הנפוץ ביותר בהפרש גדול — הוא מופיע ב־${pctTxt(top.pct)} מהמקרים ` +
            `(${top.count} מתוך ${cat.total}). מכיוון שהוא כל כך נפוץ, טיפול בו קודם ייתן את ההשפעה הגדולה ביותר.`
        ),
      });
    } else if (top.pct >= 0.2) {
      const cover = second ? top.pct + second.pct : top.pct;
      out.push({
        confidence: "medium",
        basis: `${cat.column} frequency`,
        text: L(
          `The most common ${cat.column} is "${top.value}" (${pctTxt(top.pct)} of cases)` +
            (second ? `, followed by "${second.value}" (${pctTxt(second.pct)})` : "") +
            `. Just the top ${second ? "two" : "one"} already make up ${pctTxt(cover)} of everything, so that's where to focus first.`,
          `ה־${cat.column} הנפוץ ביותר הוא "${top.value}" (${pctTxt(top.pct)} מהמקרים)` +
            (second ? `, ואחריו "${second.value}" (${pctTxt(second.pct)})` : "") +
            `. כבר ${second ? "שני המובילים מהווים" : "המוביל מהווה"} ${pctTxt(cover)} מהכול, אז שם כדאי להתמקד קודם.`
        ),
      });
    }
  }

  // 3. A real connection between two numbers (significant correlation).
  const sigCorr = ctx.correlations.find((c) => c.significant && c.strength !== "weak");
  if (sigCorr) {
    out.push({
      confidence: confFromP(sigCorr.p),
      basis: `correlation ${sigCorr.a}~${sigCorr.b}`,
      text: L(
        `When ${sigCorr.a} goes up, ${sigCorr.b} tends to go ${sigCorr.r > 0 ? "up" : "down"} too — there's a genuine connection between them. ` +
          `${sigCorr.a} might be something you can adjust to influence ${sigCorr.b}, but try a small change first to make sure it's really causing it and not just a coincidence.`,
        `כש־${sigCorr.a} עולה, ${sigCorr.b} נוטה ${sigCorr.r > 0 ? "לעלות" : "לרדת"} גם כן — יש ביניהם קשר אמיתי. ` +
          `ייתכן ש־${sigCorr.a} הוא משהו שאפשר לכוונן כדי להשפיע על ${sigCorr.b}, אבל כדאי לנסות שינוי קטן קודם כדי לוודא שזה באמת הגורם ולא צירוף מקרים.`
      ),
      detail: L(
        `${sigCorr.strength === "strong" ? "Strong" : "Moderate"} link (correlation r = ${sigCorr.r.toFixed(2)}), measured on ${sigCorr.n} rows; very unlikely to be chance (${pTxt(sigCorr.p)}).`,
        `קשר ${sigCorr.strength === "strong" ? "חזק" : "בינוני"} (מתאם r = ${sigCorr.r.toFixed(2)}), נמדד על ${sigCorr.n} שורות; קלוש מאוד שזה מקרי (${pTxt(sigCorr.p)}).`
      ),
    });
  } else {
    const noisy = ctx.correlations.find((c) => !c.significant && Math.abs(c.r) > 0.25);
    if (noisy) {
      out.push({
        confidence: "low",
        basis: `correlation ${noisy.a}~${noisy.b}`,
        text: L(
          `${noisy.a} and ${noisy.b} look a little related, but it's weak enough that it could easily just be coincidence. ` +
            `Don't make decisions based on this one yet — you'd want more data to be sure.`,
          `${noisy.a} ו־${noisy.b} נראים מעט קשורים, אבל זה חלש מספיק כדי שיכול בקלות להיות צירוף מקרים. ` +
            `אל תקבלו החלטות על סמך זה עדיין — כדאי עוד נתונים כדי להיות בטוחים.`
        ),
        detail: L(
          `Apparent link r = ${noisy.r.toFixed(2)}, but it isn't statistically reliable (${pTxt(noisy.p)}, ${noisy.n} rows).`,
          `קשר לכאורה r = ${noisy.r.toFixed(2)}, אבל הוא אינו מובהק סטטיסטית (${pTxt(noisy.p)}, ${noisy.n} שורות).`
        ),
      });
    }
  }

  // 4a. Driver analysis (multiple regression) — which factor truly matters.
  if (ctx.drivers && ctx.drivers.fP < 0.05) {
    const d = ctx.drivers;
    const sig = d.drivers.filter((x) => x.significant).sort((a, b) => Math.abs(b.beta) - Math.abs(a.beta));
    const insig = d.drivers.filter((x) => !x.significant);
    if (sig.length) {
      const lead = sig[0];
      let text: string;
      if (he) {
        text = `מבין כל הגורמים, ל־${lead.name} יש ההשפעה האמיתית הגדולה ביותר על ${d.target}.`;
        if (insig.length)
          text += ` מעניין ש־${insig.map((i) => i.name).join(" ו־")} ${insig.length === 1 ? "לא מוסיף" : "לא מוסיפים"} כלום בעצם ברגע שלוקחים בחשבון את ${sig.map((s) => s.name).join(" ו־")} — ${insig.length === 1 ? "הוא רק נראה חשוב כי הוא נע" : "הם רק נראו חשובים כי הם נעים"} יחד איתו.`;
        text += ` אז כדאי למקד את תשומת הלב ב־${lead.name}.`;
      } else {
        text = `Out of all the factors, ${lead.name} has the biggest real effect on ${d.target}.`;
        if (insig.length)
          text += ` Interestingly, ${insig.map((i) => i.name).join(" and ")} ${insig.length === 1 ? "doesn't" : "don't"} actually add anything once you account for ${sig.map((s) => s.name).join(" and ")} — ${insig.length === 1 ? "it only" : "they only"} looked important because ${insig.length === 1 ? "it moves" : "they move"} alongside it.`;
        text += ` So focus your attention on ${lead.name}.`;
      }
      out.push({
        confidence: confFromP(lead.p),
        basis: `multiple regression on ${d.target}`,
        text,
        detail: L(
          `Comparing all factors together, this model explains about ${pctTxt(d.adjR2)} of what drives ${d.target}. (${lead.name}: standardized effect ${lead.beta.toFixed(2)}, ${pTxt(lead.p)}.)`,
          `בהשוואת כל הגורמים יחד, המודל מסביר כ־${pctTxt(d.adjR2)} ממה שמניע את ${d.target}. (${lead.name}: השפעה מתוקננת ${lead.beta.toFixed(2)}, ${pTxt(lead.p)}.)`
        ),
      });
    }
  }

  // 4b. Simple regression — only when there's no fuller driver analysis.
  if (ctx.regression && ctx.regression.significant && !ctx.drivers) {
    const r = ctx.regression;
    out.push({
      confidence: confFromP(r.slopeP),
      basis: "regression",
      text: L(
        `As a rough rule, every extra 1 of ${r.driver} comes with about ${r.slope >= 0 ? "+" : ""}${num(r.slope)} ${r.target}. ` +
          `That makes ${r.driver} a promising thing to adjust if you want to move ${r.target}.`,
        `ככלל אצבע, כל יחידה נוספת של ${r.driver} מלווה בערך ב־${r.slope >= 0 ? "+" : ""}${num(r.slope)} ${r.target}. ` +
          `זה הופך את ${r.driver} לגורם מבטיח לכוונן אם רוצים להזיז את ${r.target}.`
      ),
      detail: L(
        `This relationship explains about ${pctTxt(r.adjR2)} of ${r.target}. (Slope ${num(r.slope)}, range ${num(r.ciLow)}–${num(r.ciHigh)}, ${pTxt(r.slopeP)}.)`,
        `הקשר הזה מסביר כ־${pctTxt(r.adjR2)} מ־${r.target}. (שיפוע ${num(r.slope)}, טווח ${num(r.ciLow)}–${num(r.ciHigh)}, ${pTxt(r.slopeP)}.)`
      ),
    });
  }

  // 5. Trends — real trend vs. noise, in plain words.
  const t = ctx.trends.find((t) => t.direction !== "flat");
  if (t) {
    if (t.significant) {
      out.push({
        confidence: confFromP(t.slopeP ?? 0.05),
        basis: `trend ${t.metric}`,
        text:
          t.direction === "up"
            ? L(
                `${t.metric} is genuinely climbing over time (about ${pctTxt(Math.abs(t.changePct))} across the whole period) — this is a real upward trend, not just random ups and downs. Consider leaning into whatever's driving it.`,
                `${t.metric} באמת מטפס לאורך זמן (כ־${pctTxt(Math.abs(t.changePct))} על פני כל התקופה) — זו מגמת עלייה אמיתית, לא סתם תנודות אקראיות. שקלו לחזק את מה שמניע את זה.`
              )
            : L(
                `${t.metric} is genuinely falling over time (about ${pctTxt(Math.abs(t.changePct))} across the whole period) — this is a real decline, not just random noise. Worth finding the cause before it gets worse.`,
                `${t.metric} באמת יורד לאורך זמן (כ־${pctTxt(Math.abs(t.changePct))} על פני כל התקופה) — זו ירידה אמיתית, לא רעש אקראי. כדאי לאתר את הסיבה לפני שזה מחמיר.`
              ),
        detail: L(`The trend is statistically reliable (${pTxt(t.slopeP ?? NaN)}).`, `המגמה מובהקת סטטיסטית (${pTxt(t.slopeP ?? NaN)}).`),
      });
    } else {
      out.push({
        confidence: "low",
        basis: `trend ${t.metric}`,
        text: L(
          `${t.metric} bounced around (about ${pctTxt(Math.abs(t.changePct))} from start to finish), but there's no real upward or downward trend — it's mostly random movement. Don't read too much into it yet; wait for more data.`,
          `${t.metric} התנדנד (כ־${pctTxt(Math.abs(t.changePct))} מההתחלה לסוף), אבל אין מגמת עלייה או ירידה אמיתית — זו בעיקר תנועה אקראית. אל תייחסו לזה משמעות יתר עדיין; חכו לעוד נתונים.`
        ),
        detail: L(`No statistically reliable trend (${pTxt(t.slopeP ?? NaN)}).`, `אין מגמה מובהקת סטטיסטית (${pTxt(t.slopeP ?? NaN)}).`),
      });
    }
  }

  // 6. Two categories that go together (chi-square association).
  const assoc = ctx.associations.find((a) => a.significant);
  if (assoc) {
    out.push({
      confidence: confFromP(assoc.p),
      basis: `association ${assoc.a}~${assoc.b}`,
      text: L(
        `${assoc.a} and ${assoc.b} are connected — knowing one tells you something about the other. Certain ${assoc.a} values tend to come with certain ${assoc.b} values. ` +
          `Looking at them together (instead of separately) may reveal useful patterns.`,
        `${assoc.a} ו־${assoc.b} קשורים זה לזה — ידיעת האחד מספרת לכם משהו על השני. ערכים מסוימים של ${assoc.a} נוטים להופיע יחד עם ערכים מסוימים של ${assoc.b}. ` +
          `התבוננות בהם יחד (במקום בנפרד) עשויה לחשוף דפוסים שימושיים.`
      ),
      detail: L(
        `${assoc.cramersV > 0.5 ? "Strong" : assoc.cramersV > 0.3 ? "Moderate" : "Mild"} connection (Cramér's V = ${assoc.cramersV.toFixed(2)}), very unlikely to be chance (${pTxt(assoc.p)}).`,
        `קשר ${assoc.cramersV > 0.5 ? "חזק" : assoc.cramersV > 0.3 ? "בינוני" : "קל"} (Cramér's V = ${assoc.cramersV.toFixed(2)}), קלוש מאוד שזה מקרי (${pTxt(assoc.p)}).`
      ),
    });
  }

  // 7. Forecast.
  if (ctx.forecast && out.length < 6) {
    const f = ctx.forecast;
    out.push({
      confidence: "medium",
      basis: "forecast",
      text: L(
        `If things keep going the way they have been, ${f.metric} is heading toward about ${num(f.projected)} ` +
          `over the next ${f.horizon} period${f.horizon === 1 ? "" : "s"} (${f.changePct >= 0 ? "up" : "down"} about ${pctTxt(Math.abs(f.changePct))}). ` +
          `Plan around that, and update it as new numbers come in.`,
        `אם הדברים ימשיכו כפי שהיו, ${f.metric} צפוי להגיע לכ־${num(f.projected)} ` +
          `במהלך ${f.horizon} התקופות הקרובות (${f.changePct >= 0 ? "עלייה" : "ירידה"} של כ־${pctTxt(Math.abs(f.changePct))}). ` +
          `תכננו בהתאם, ועדכנו ככל שמגיעים נתונים חדשים.`
      ),
      detail: L(`Projection based on the recent trend (Holt's method).`, `התחזית מבוססת על המגמה האחרונה (שיטת הולט).`),
    });
  }

  // 8. Outliers.
  const o = ctx.outliers[0];
  if (o && o.count > 0 && out.length < 6) {
    out.push({
      confidence: "medium",
      basis: `outliers in ${o.column}`,
      text: L(
        `A few ${o.column} values are unusually high or low (${o.count} of them). ` +
          `Oddball values like these can quietly throw off the averages, so it's worth checking whether they're real or just typos before trusting any ${o.column} numbers.`,
        `כמה ערכים של ${o.column} גבוהים או נמוכים בצורה חריגה (${o.count} כאלה). ` +
          `ערכים חריגים כאלה יכולים לעוות בשקט את הממוצעים, אז כדאי לבדוק אם הם אמיתיים או סתם טעויות הקלדה לפני שסומכים על מספרי ${o.column}.`
      ),
      detail: L(
        `${o.count} value${o.count === 1 ? "" : "s"} far outside the normal range (beyond 3 standard deviations).`,
        `${o.count} ערכים הרחק מחוץ לטווח הרגיל (מעבר ל־3 סטיות תקן).`
      ),
    });
  }

  if (out.length === 0) {
    out.push({
      confidence: "low",
      basis: "overview",
      text: L(
        "Nothing clearly stood out in this data. More rows — or a column that captures the outcome you actually care about — would help reveal stronger patterns.",
        "שום דבר לא בלט בבירור בנתונים האלה. עוד שורות — או עמודה שמתארת את התוצאה שבאמת מעניינת אתכם — יעזרו לחשוף דפוסים חזקים יותר."
      ),
    });
  }

  // Small-sample caveat goes first — it qualifies everything else.
  if (ctx.smallSample) {
    out.unshift({
      confidence: "low",
      basis: `sample size n = ${ctx.rowCount}`,
      text: L(
        `Heads up: you only have ${ctx.rowCount} rows of data, which is quite few. Treat everything below as rough hints rather than firm facts — the picture could easily change with more data.`,
        `שימו לב: יש לכם רק ${ctx.rowCount} שורות נתונים, וזה די מעט. התייחסו לכל מה שלמטה כרמזים גסים ולא כעובדות מוצקות — התמונה עשויה להשתנות בקלות עם עוד נתונים.`
      ),
    });
  }

  return out.slice(0, 7).map((c, i) => ({ id: `concl-${i}`, ...c }));
}
