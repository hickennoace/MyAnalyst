"use client";

import { useEffect, useState } from "react";

// Lightweight i18n for the marketing/site chrome. English is the default and the
// SSR/SEO language; Hebrew (RTL) is available via the language toggle. The active
// language is stored on <html lang> + <html dir> (set before paint in layout) and
// in localStorage. Components subscribe via useLang() and re-render on change.

export type Lang = "en" | "he";

export function applyLang(l: Lang): void {
  const html = document.documentElement;
  html.lang = l;
  html.dir = l === "he" ? "rtl" : "ltr";
  try {
    localStorage.setItem("quantia:lang", l);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event("quantia:langchange"));
}

export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    const read = () => setLang((document.documentElement.lang as Lang) === "he" ? "he" : "en");
    read();
    window.addEventListener("quantia:langchange", read);
    return () => window.removeEventListener("quantia:langchange", read);
  }, []);
  return [lang, applyLang];
}

interface Feature { title: string; body: string }
interface Step { n: string; label: string; title: string; body: string }

export interface LandingDict {
  nav: { features: string; how: string; open: string };
  hero: {
    pill: string;
    h1lead: string;
    h1accent: string;
    sub: string;
    analyze: string;
    sample: string;
    trust: string;
    tape: string;
    kpis: [string, string, string];
  };
  ticker: string[];
  features: { eyebrow: string; title: string; sub: string; items: Feature[] };
  method: { eyebrow: string; title: string; steps: Step[] };
  privacy: { privTitle: string; privBody: string; aiTitle: string; aiBody: string };
  cta: { eyebrow: string; lead: string; accent: string; sub: string; open: string };
  footer: { rights: string; analyzer: string; privacy: string; built: string };
}

const en: LandingDict = {
  nav: { features: "Features", how: "How it works", open: "Open the app" },
  hero: {
    pill: "AI-assisted · runs in your browser · no setup",
    h1lead: "Turn a spreadsheet into an",
    h1accent: "explained dashboard",
    sub: "Quantia cleans your data, runs real statistics, and writes the conclusions — automatically. A zero-skill alternative to Power BI and Tableau, with the rigor of a working data scientist.",
    analyze: "Analyze your data",
    sample: "Try a live sample",
    trust: "No account · no upload · your data never leaves this page.",
    tape: "revenue.csv · 12 periods",
    kpis: ["growth", "r · p<.001", "data quality"],
  },
  ticker: ["Cleaning report", "Domain detection", "Ranked KPIs", "OLS regression", "ANOVA", "Chi-square", "Forecasting", "Correlation", "Distributions", "Plain-language insight"],
  features: {
    eyebrow: "Capabilities",
    title: "Everything, automatically",
    sub: "The work a data scientist does by hand — done the moment your file lands.",
    items: [
      { title: "Relentless cleaning", body: "Strips currency symbols, unifies date formats, removes duplicates, empty rows and trailing totals — with a transparent before/after report." },
      { title: "Auto domain detection", body: "Figures out whether your data is financial, sales, marketing or survey — and picks the metrics that matter for it." },
      { title: "Instant KPIs & charts", body: "Ranked KPIs and precise charts for your data shape: trends, comparisons, correlations, distributions." },
      { title: "Real statistics", body: "Significance tests, OLS & multiple regression, ANOVA, chi-square, forecasting — statsmodels-grade rigor, in your browser." },
      { title: "Conclusions, not just charts", body: "Plain-language, statistically-calibrated takeaways grounded in the numbers — it tells you what it likely means." },
      { title: "Ask your data", body: "Type “which reason is most common” or “revenue by region as a bar chart” and get an answer — in plain English." },
    ],
  },
  method: {
    eyebrow: "The method",
    title: "Three steps, no friction",
    steps: [
      { n: "01", label: "STEP 01", title: "Upload", body: "Drop a CSV, TSV, Excel or JSON file. Nothing is sent to a server — it's parsed entirely in your browser." },
      { n: "02", label: "STEP 02", title: "We analyze", body: "Clean → profile → detect domain → KPIs → statistics → forecast → conclusions, in seconds." },
      { n: "03", label: "STEP 03", title: "Explore", body: "Read your dashboard, ask questions, generate charts, export & share — no skills required." },
    ],
  },
  privacy: {
    privTitle: "Private by design",
    privBody: "All parsing, cleaning, KPIs, statistics and charts run entirely in your browser. Your raw rows never touch a server. When AI narration is enabled, only small aggregate statistics — never your underlying data — are sent for wording.",
    aiTitle: "Smart, your way",
    aiBody: "Works fully offline with a built-in engine that writes conclusions from real statistical tests. Want richer prose? Plug in any LLM — Claude, Groq, Gemini — with one environment variable. No key, no problem: it still works.",
  },
  cta: { eyebrow: "Ready when you are", lead: "See your data", accent: "clearly", sub: "No setup, no spreadsheet skills, no waiting. Just answers.", open: "Open Quantia" },
  footer: { rights: "© 2026 Quantia · autonomous statistical analysis", analyzer: "Analyzer", privacy: "Privacy", built: "Built on Next.js · Vercel" },
};

const he: LandingDict = {
  nav: { features: "יכולות", how: "איך זה עובד", open: "כניסה לאפליקציה" },
  hero: {
    pill: "מבוסס בינה מלאכותית · פועל בדפדפן · ללא התקנה",
    h1lead: "הפכו גיליון נתונים ל",
    h1accent: "דשבורד עם הסברים",
    sub: "Quantia מנקה את הנתונים שלכם, מריצה ניתוח סטטיסטי אמיתי וכותבת בשבילכם את המסקנות — הכול אוטומטית. חלופה פשוטה ל‑Power BI ול‑Tableau, בלי צורך בידע מוקדם ועם הדיוק של מדען נתונים מנוסה.",
    analyze: "לניתוח הנתונים שלכם",
    sample: "הריצו על דוגמה",
    trust: "ללא חשבון · ללא העלאה · הנתונים נשארים אצלכם בדפדפן.",
    tape: "revenue.csv · 12 תקופות",
    kpis: ["צמיחה", "מתאם · p<.001", "איכות הנתונים"],
  },
  ticker: ["דוח ניקוי", "זיהוי תחום", "מדדים מדורגים", "רגרסיית OLS", "ANOVA", "חי בריבוע", "חיזוי", "מתאם", "התפלגויות", "תובנות בשפה פשוטה"],
  features: {
    eyebrow: "יכולות",
    title: "הכול קורה אוטומטית",
    sub: "כל מה שמדען נתונים עושה ידנית — קורה ברגע שהקובץ עולה.",
    items: [
      { title: "ניקוי יסודי", body: "מסיר סימני מטבע, מאחד פורמטים של תאריכים, ומנקה כפילויות, שורות ריקות ושורות סיכום — עם דוח שקוף של לפני ואחרי." },
      { title: "זיהוי תחום אוטומטי", body: "מבין אם הנתונים שלכם פיננסיים, מכירות, שיווק או סקר — ובוחר בשבילכם את המדדים שבאמת חשובים." },
      { title: "מדדים וגרפים מיידיים", body: "מדדים מדורגים וגרפים מדויקים שמתאימים לנתונים שלכם: מגמות, השוואות, מתאמים והתפלגויות." },
      { title: "סטטיסטיקה אמיתית", body: "מבחני מובהקות, רגרסיה ורגרסיה מרובה, ANOVA, חי בריבוע וחיזוי — ברמה מקצועית, ישירות בדפדפן." },
      { title: "מסקנות, לא רק גרפים", body: "תובנות בשפה פשוטה, מבוססות על המספרים האמיתיים — שמסבירות לכם מה זה כנראה אומר." },
      { title: "שאלו את הנתונים", body: "כתבו ”מה הסיבה הכי נפוצה?“ או ”הכנסות לפי אזור בגרף עמודות“ — ותקבלו תשובה בשפה פשוטה." },
    ],
  },
  method: {
    eyebrow: "איך זה עובד",
    title: "שלושה צעדים פשוטים",
    steps: [
      { n: "01", label: "שלב 01", title: "מעלים", body: "גוררים קובץ CSV, TSV, Excel או JSON. שום דבר לא נשלח לשרת — הכול מתבצע בדפדפן שלכם." },
      { n: "02", label: "שלב 02", title: "אנחנו מנתחים", body: "ניקוי ← אפיון ← זיהוי תחום ← מדדים ← סטטיסטיקה ← חיזוי ← מסקנות, תוך שניות." },
      { n: "03", label: "שלב 03", title: "חוקרים", body: "קוראים את הדשבורד, שואלים שאלות, יוצרים גרפים, מייצאים ומשתפים — בלי צורך בידע מיוחד." },
    ],
  },
  privacy: {
    privTitle: "פרטי כבר מהיסוד",
    privBody: "כל העיבוד, הניקוי, המדדים, הסטטיסטיקה והגרפים מתבצעים אצלכם בדפדפן. השורות הגולמיות לעולם לא נשלחות לשרת. כשהסבר ה‑AI מופעל, נשלחות רק סטטיסטיקות מצרפיות קטנות — אף פעם לא הנתונים עצמם.",
    aiTitle: "חכם, בדרך שלכם",
    aiBody: "עובד מצוין גם ללא חיבור לאינטרנט, עם מנוע מובנה שכותב מסקנות מתוך מבחנים סטטיסטיים אמיתיים. רוצים ניסוח עשיר יותר? חברו כל מודל שפה — Claude, Groq או Gemini — בהגדרה אחת. ואם אין מפתח? עדיין עובד.",
  },
  cta: { eyebrow: "מתי שתרצו", lead: "ראו את הנתונים שלכם", accent: "בבהירות", sub: "בלי התקנות, בלי ידע בגיליונות ובלי המתנה. פשוט תשובות.", open: "כניסה ל‑Quantia" },
  footer: { rights: "© 2026 Quantia · ניתוח סטטיסטי אוטונומי", analyzer: "מנתח", privacy: "פרטיות", built: "בנוי ב‑Next.js · רץ על Vercel" },
};

export const LANDING: Record<Lang, LandingDict> = { en, he };

// ── App / analyzer chrome dictionary ───────────────────────────────────────────
export interface AppDict {
  header: { analyzer: string; data: string; share: string; png: string; pdf: string; exporting: string; newAnalysis: string; home: string };
  stages: string[];
  uploader: { title: string; desc: string; choose: string; analyzing: string; sample: string };
  pipeline: { title: string };
  improve: { summary: string; optional: string; help: string; placeholder: string };
  banners: { sampledA: string; sampledB: string; sampledC: string };
  share: { building: string; copied: string; tooLarge: string; fail: string };
  errors: { generic: string; read: string; noData: string; export: string };
  history: { title: string; stored: string; open: string; del: string; rows: string; cols: string };
  dash: {
    rows: string; cols: string; confidence: string;
    cleaningTitle: string; cleaningSub: string;
    kpisTitle: string; kpisSub: string;
    insightsTitle: string; insightsSub: string; aiNarrated: string;
    conclusionsTitle: string; conclusionsSub: string; aiGenerated: string; theNumbers: string; disclaimer: string;
    chartsTitle: string; chartsSub: string;
    askTitle: string; askSub: string;
    buildTitle: string; buildSub: string;
    browseTitle: string; browseSub: string;
  };
  conf: { high: string; medium: string; low: string };
  confWord: { high: string; medium: string; low: string };
  kind: { summary: string; trend: string; correlation: string; regression: string; outlier: string; composition: string };
  cleaning: {
    title: string; sub: string; rowsIn: string; rowsOut: string;
    rowsRemoved: string; duplicates: string; totalRows: string; emptyRows: string; cellsNormalized: string; cellsTrimmed: string;
    colDetails: string; colName: string; detectedType: string; normalized: string; trimmed: string; missing: string;
    beforeAfter: string; hide: string; show: string; raw: string; cleaned: string;
  };
  query: { title: string; desc: string; placeholder: string; ask: string };
  builder: { title: string; desc: string; generate: string; chartType: string; xAxis: string; xMetric: string; measure: string; metric: string; countRows: string; addChart: string; sameCol: string };
  table: { title: string; search: string; prev: string; next: string; rows: string; filtered: string; noMatch: string };
  view: { subtitle: string; analyzeOwn: string };
  notFound: { msg: string; goHome: string; openApp: string };
  footerNote: string;
}

const appEn: AppDict = {
  header: { analyzer: "Analyzer", data: "Data", share: "Share", png: "PNG", pdf: "PDF", exporting: "Exporting…", newAnalysis: "New analysis", home: "Home", },
  stages: ["Reading file", "Cleaning & normalizing", "Profiling columns", "Detecting domain", "Computing KPIs", "Running statistics", "Writing insights"],
  uploader: { title: "Drop a spreadsheet to analyze", desc: "CSV, TSV, Excel, or JSON. Everything runs in your browser — your data never leaves this page.", choose: "Choose file", analyzing: "Analyzing…", sample: "Try a sample dataset" },
  pipeline: { title: "Analyzing your data…" },
  improve: { summary: "Improve the AI", optional: "(optional) — describe your data or goal", help: "Tell the engine what you're working on so its conclusions are more relevant. Stored only in this browser — never uploaded anywhere.", placeholder: "e.g. I run a used-car dealership and want to understand why customers don't buy." },
  banners: { sampledA: "Large file detected — analyzed a representative random sample of", sampledB: "rows out of", sampledC: ". The statistics are valid for the full dataset; exact totals would need the complete file." },
  share: { building: "Building link…", copied: "Read-only link copied — paste it anywhere.", tooLarge: "Dataset too large for a link — use PNG/PDF export instead.", fail: "Couldn't create the link in this browser." },
  errors: { generic: "Something went wrong analyzing that file.", read: "Could not read that file.", noData: "No tabular data found. Make sure the first row contains column headers.", export: "Export failed — the dashboard may be too large. Try again or use PNG." },
  history: { title: "Recent analyses", stored: "stored locally on this device", open: "Open", del: "Delete from history", rows: "rows", cols: "cols" },
  dash: {
    rows: "rows", cols: "columns", confidence: "confidence",
    cleaningTitle: "Cleaning & normalization", cleaningSub: "The unglamorous core that makes everything below trustworthy.",
    kpisTitle: "Key metrics", kpisSub: "Auto-selected for this dataset's shape and domain.",
    insightsTitle: "What the data is telling you", insightsSub: "Plain-language conclusions, grounded in the computed numbers.", aiNarrated: "AI-narrated",
    conclusionsTitle: "Conclusions & recommendations", conclusionsSub: "What your data means for you — in plain language, no statistics degree required.", aiGenerated: "AI-generated", theNumbers: "The numbers:",
    disclaimer: "These takeaways are written automatically by AI from your data. AI can get things wrong or miss the bigger picture, and a pattern in the data doesn't always mean one thing causes another. Use them as a helpful starting point — and for anything important (money, health, legal, or big business decisions), check with a qualified expert first.",
    chartsTitle: "Automatic charts", chartsSub: "The engine picked these from your data shape.",
    askTitle: "Ask your data", askSub: "Plain-language questions, answered with your real numbers — no AI key needed.",
    buildTitle: "Build your own", buildSub: "Ask for any chart you want — in plain language or by picking columns.",
    browseTitle: "Browse the data", browseSub: "Search, sort, and page through every row.",
  },
  conf: { high: "Strong finding", medium: "Worth a look", low: "Just a hint" },
  confWord: { high: "high confidence", medium: "medium confidence", low: "low confidence" },
  kind: { summary: "summary", trend: "trend", correlation: "correlation", regression: "regression", outlier: "outlier", composition: "composition" },
  cleaning: {
    title: "Cleaning report", sub: "What we fixed before analyzing — so you can trust the numbers.", rowsIn: "rows in", rowsOut: "rows out",
    rowsRemoved: "rows removed", duplicates: "duplicates", totalRows: "total rows", emptyRows: "empty rows", cellsNormalized: "cells normalized", cellsTrimmed: "cells trimmed",
    colDetails: "Column types & per-column changes", colName: "Column", detectedType: "Detected type", normalized: "Normalized", trimmed: "Trimmed", missing: "Missing",
    beforeAfter: "Before / after preview", hide: "Hide", show: "Show", raw: "Raw", cleaned: "Cleaned",
  },
  query: { title: "Ask your data", desc: "Plain-language questions, answered with your real numbers. Runs locally — no AI key needed.", placeholder: "e.g. total revenue by region", ask: "Ask" },
  builder: { title: "Generate a graph", desc: "Ask in plain language, or pick the columns yourself. The engine maps your request to a chart.", generate: "Generate", chartType: "Chart type", xAxis: "X axis", xMetric: "X (metric)", measure: "Measure (Y)", metric: "Metric", countRows: "Count of rows", addChart: "Add chart", sameCol: "Pick two different columns — X and Y can't be the same. (Tip: use “Count of rows” to chart a single column.)" },
  table: { title: "Data", search: "Search all columns…", prev: "Prev", next: "Next", rows: "rows", filtered: "filtered from", noMatch: "No rows match" },
  view: { subtitle: "Shared dashboard · read-only", analyzeOwn: "Analyze your own" },
  notFound: { msg: "This page wandered off the dashboard.", goHome: "Go home", openApp: "Open the analyzer" },
  footerNote: "Quantia · Analysis runs locally in your browser. Insight narration is pluggable.",
};

const appHe: AppDict = {
  header: { analyzer: "מנתח", data: "נתונים", share: "שיתוף", png: "PNG", pdf: "PDF", exporting: "מייצא…", newAnalysis: "ניתוח חדש", home: "בית", },
  stages: ["קורא את הקובץ", "מנקה ומאחד", "מאפיין עמודות", "מזהה תחום", "מחשב מדדים", "מריץ סטטיסטיקה", "כותב תובנות"],
  uploader: { title: "גררו לכאן גיליון נתונים לניתוח", desc: "CSV, TSV, Excel או JSON. הכול מתבצע בדפדפן שלכם — הנתונים לא עוזבים את הדף.", choose: "בחירת קובץ", analyzing: "מנתח…", sample: "נסו מערך נתונים לדוגמה" },
  pipeline: { title: "מנתח את הנתונים שלכם…" },
  improve: { summary: "שיפור ה‑AI", optional: "(רשות) — תארו את הנתונים או המטרה שלכם", help: "ספרו למנוע על מה אתם עובדים כדי שהמסקנות יהיו רלוונטיות יותר. נשמר רק בדפדפן הזה — לא נשלח לשום מקום.", placeholder: "לדוגמה: יש לי סוכנות רכב יד שנייה ואני רוצה להבין למה לקוחות לא קונים." },
  banners: { sampledA: "זוהה קובץ גדול — נותח מדגם אקראי מייצג של", sampledB: "שורות מתוך", sampledC: ". התוצאות הסטטיסטיות תקפות לכל מערך הנתונים; לחישוב סכומים מדויקים נדרש הקובץ המלא." },
  share: { building: "יוצר קישור…", copied: "קישור לצפייה בלבד הועתק — הדביקו אותו בכל מקום.", tooLarge: "מערך הנתונים גדול מדי לקישור — השתמשו בייצוא PNG/PDF במקום.", fail: "לא ניתן ליצור קישור בדפדפן הזה." },
  errors: { generic: "משהו השתבש בניתוח הקובץ.", read: "לא הצלחנו לקרוא את הקובץ.", noData: "לא נמצאו נתונים טבלאיים. ודאו שהשורה הראשונה מכילה כותרות עמודות.", export: "הייצוא נכשל — ייתכן שהדשבורד גדול מדי. נסו שוב או השתמשו ב‑PNG." },
  history: { title: "ניתוחים אחרונים", stored: "נשמר מקומית במכשיר הזה", open: "פתיחה", del: "מחיקה מההיסטוריה", rows: "שורות", cols: "עמודות" },
  dash: {
    rows: "שורות", cols: "עמודות", confidence: "ודאות",
    cleaningTitle: "ניקוי ואיחוד נתונים", cleaningSub: "הבסיס הפחות זוהר שהופך כל מה שמתחת לאמין.",
    kpisTitle: "מדדים מרכזיים", kpisSub: "נבחרו אוטומטית לפי צורת הנתונים והתחום שלהם.",
    insightsTitle: "מה הנתונים מספרים לכם", insightsSub: "מסקנות בשפה פשוטה, מבוססות על המספרים שחושבו.", aiNarrated: "נכתב ע״י AI",
    conclusionsTitle: "מסקנות והמלצות", conclusionsSub: "מה הנתונים אומרים עליכם — בשפה פשוטה, בלי צורך בתואר בסטטיסטיקה.", aiGenerated: "נוצר ע״י AI", theNumbers: "המספרים:",
    disclaimer: "המסקנות האלה נכתבות אוטומטית ע״י בינה מלאכותית מתוך הנתונים שלכם. בינה מלאכותית יכולה לטעות או לפספס את התמונה הגדולה, ודפוס בנתונים לא תמיד אומר שדבר אחד גורם לאחר. השתמשו בהן כנקודת פתיחה מועילה — ולכל דבר חשוב (כסף, בריאות, משפט או החלטות עסקיות גדולות) התייעצו קודם עם מומחה מוסמך.",
    chartsTitle: "גרפים אוטומטיים", chartsSub: "המנוע בחר אותם לפי צורת הנתונים שלכם.",
    askTitle: "שאלו את הנתונים", askSub: "שאלות בשפה פשוטה, עם תשובות מהמספרים האמיתיים שלכם — בלי מפתח AI.",
    buildTitle: "בנו גרף משלכם", buildSub: "בקשו כל גרף שתרצו — בשפה פשוטה או על ידי בחירת עמודות.",
    browseTitle: "עיון בנתונים", browseSub: "חיפוש, מיון ודפדוף בכל השורות.",
  },
  conf: { high: "ממצא חזק", medium: "שווה בדיקה", low: "רק רמז" },
  confWord: { high: "ודאות גבוהה", medium: "ודאות בינונית", low: "ודאות נמוכה" },
  kind: { summary: "סיכום", trend: "מגמה", correlation: "מתאם", regression: "רגרסיה", outlier: "חריג", composition: "הרכב" },
  cleaning: {
    title: "דוח ניקוי", sub: "מה תיקנו לפני הניתוח — כדי שתוכלו לסמוך על המספרים.", rowsIn: "שורות נכנסו", rowsOut: "שורות יצאו",
    rowsRemoved: "שורות הוסרו", duplicates: "כפילויות", totalRows: "שורות סיכום", emptyRows: "שורות ריקות", cellsNormalized: "תאים אוחדו", cellsTrimmed: "תאים נוקו",
    colDetails: "סוגי עמודות ושינויים לכל עמודה", colName: "עמודה", detectedType: "סוג שזוהה", normalized: "אוחדו", trimmed: "נוקו", missing: "חסרים",
    beforeAfter: "תצוגה לפני / אחרי", hide: "הסתרה", show: "הצגה", raw: "גולמי", cleaned: "מנוקה",
  },
  query: { title: "שאלו את הנתונים", desc: "שאלות בשפה פשוטה, עם תשובות מהמספרים האמיתיים שלכם. רץ מקומית — בלי מפתח AI.", placeholder: "לדוגמה: סך ההכנסות לפי אזור", ask: "שאלו" },
  builder: { title: "יצירת גרף", desc: "בקשו בשפה פשוטה, או בחרו את העמודות בעצמכם. המנוע יתרגם את הבקשה לגרף.", generate: "צרו", chartType: "סוג גרף", xAxis: "ציר X", xMetric: "X (מדד)", measure: "מדד (Y)", metric: "מדד", countRows: "ספירת שורות", addChart: "הוספת גרף", sameCol: "בחרו שתי עמודות שונות — X ו‑Y לא יכולים להיות זהים. (טיפ: השתמשו ב”ספירת שורות“ כדי להציג עמודה אחת.)" },
  table: { title: "נתונים", search: "חיפוש בכל העמודות…", prev: "הקודם", next: "הבא", rows: "שורות", filtered: "מתוך", noMatch: "אין שורות שתואמות" },
  view: { subtitle: "דשבורד משותף · לקריאה בלבד", analyzeOwn: "לנתח משלכם" },
  notFound: { msg: "הדף הזה תעה אי שם מחוץ לדשבורד.", goHome: "חזרה לבית", openApp: "פתיחת המנתח" },
  footerNote: "Quantia · הניתוח מתבצע מקומית בדפדפן שלכם. מנגנון התובנות ניתן להחלפה.",
};

export const APP: Record<Lang, AppDict> = { en: appEn, he: appHe };

// ── Privacy page ───────────────────────────────────────────────────────────────
export interface PrivacyDict {
  back: string; title: string; intro: string;
  blocks: { title: string; body: string }[];
  cta: string;
}
export const PRIVACY: Record<Lang, PrivacyDict> = {
  en: {
    back: "Quantia", title: "Privacy", intro: "Short version: your data stays on your device.",
    blocks: [
      { title: "Your files never leave your browser", body: "Parsing, cleaning, profiling, KPIs, statistics, forecasting, charts, and the templated insights all run locally in your browser using JavaScript. Quantia has no upload endpoint and no database for your data. Nothing is transmitted to a server to produce your dashboard." },
      { title: "Local history", body: "Recent analyses are stored only in your browser's localStorage, on this device. Clearing your browser data removes them. They are never synced anywhere." },
      { title: "Shareable links", body: "A share link encodes the whole dashboard into the URL's hash fragment (the part after #). Browsers never send the hash to a server, so a shared dashboard is reconstructed entirely in the recipient's browser. Anyone with the link can view it — treat links like the data they contain." },
      { title: "Optional AI narration", body: "If — and only if — the operator enables the optional LLM narrator, a small metadata-only summary (KPI values, correlations, a regression, a forecast — never your raw rows) is sent to the configured model provider to phrase the written insights. With AI disabled, even that doesn't leave your browser." },
      { title: "No tracking", body: "Quantia ships no advertising or third-party analytics trackers." },
    ],
    cta: "Try the analyzer",
  },
  he: {
    back: "Quantia", title: "פרטיות", intro: "בקצרה: הנתונים שלכם נשארים במכשיר שלכם.",
    blocks: [
      { title: "הקבצים שלכם לעולם לא עוזבים את הדפדפן", body: "הפענוח, הניקוי, האפיון, המדדים, הסטטיסטיקה, החיזוי, הגרפים והתובנות — הכול רץ מקומית בדפדפן שלכם ב‑JavaScript. ל‑Quantia אין נקודת קצה להעלאה ואין מסד נתונים לנתונים שלכם. שום דבר לא נשלח לשרת כדי להפיק את הדשבורד." },
      { title: "היסטוריה מקומית", body: "ניתוחים אחרונים נשמרים רק ב‑localStorage של הדפדפן שלכם, במכשיר הזה. ניקוי נתוני הדפדפן מוחק אותם. הם לעולם לא מסונכרנים לשום מקום." },
      { title: "קישורים לשיתוף", body: "קישור שיתוף מקודד את כל הדשבורד אל תוך מקטע ה‑hash של הכתובת (החלק שאחרי #). דפדפנים לעולם לא שולחים את ה‑hash לשרת, כך שדשבורד משותף נבנה מחדש כולו בדפדפן של הנמען. כל מי שיש לו את הקישור יכול לצפות בו — התייחסו לקישורים כמו אל הנתונים שבתוכם." },
      { title: "הסבר AI אופציונלי", body: "אם — ורק אם — המפעיל מפעיל את מנוע ה‑AI האופציונלי, נשלח סיכום קטן של מטא‑נתונים בלבד (ערכי מדדים, מתאמים, רגרסיה, חיזוי — אף פעם לא השורות הגולמיות) לספק המודל המוגדר, כדי לנסח את התובנות. כשה‑AI כבוי, גם זה לא עוזב את הדפדפן." },
      { title: "ללא מעקב", body: "ב‑Quantia אין פרסומות ואין כלי מעקב או אנליטיקס של צד שלישי." },
    ],
    cta: "נסו את המנתח",
  },
};

/** Convenience hook: returns the app-chrome dictionary for the active language. */
export function useT(): AppDict {
  const [lang] = useLang();
  return APP[lang];
}
