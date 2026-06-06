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
  nav: { features: "יכולות", how: "איך זה עובד", open: "פתחו את האפליקציה" },
  hero: {
    pill: "מבוסס בינה מלאכותית · פועל בדפדפן · ללא התקנה",
    h1lead: "הפכו גיליון נתונים ל",
    h1accent: "לוח מחוונים מוסבר",
    sub: "Quantia מנקה את הנתונים שלכם, מריצה סטטיסטיקה אמיתית וכותבת את המסקנות — באופן אוטומטי. חלופה ללא צורך במיומנות ל‑Power BI ול‑Tableau, עם הדיוק של מדען נתונים מקצועי.",
    analyze: "נתחו את הנתונים שלכם",
    sample: "נסו דוגמה חיה",
    trust: "ללא חשבון · ללא העלאה · הנתונים לעולם לא עוזבים את הדף הזה.",
    tape: "revenue.csv · 12 תקופות",
    kpis: ["צמיחה", "מתאם · p<.001", "איכות נתונים"],
  },
  ticker: ["דוח ניקוי", "זיהוי תחום", "מדדי KPI מדורגים", "רגרסיית OLS", "ANOVA", "חי בריבוע", "חיזוי", "מתאם", "התפלגויות", "תובנה בשפה פשוטה"],
  features: {
    eyebrow: "יכולות",
    title: "הכול, אוטומטית",
    sub: "העבודה שמדען נתונים עושה ידנית — מתבצעת ברגע שהקובץ שלכם נטען.",
    items: [
      { title: "ניקוי יסודי", body: "מסיר סימני מטבע, מאחד פורמטים של תאריכים, מסיר כפילויות, שורות ריקות ושורות סיכום — עם דוח שקוף של לפני ואחרי." },
      { title: "זיהוי תחום אוטומטי", body: "מזהה אם הנתונים שלכם פיננסיים, מכירות, שיווק או סקר — ובוחר את המדדים שחשובים עבורם." },
      { title: "מדדים וגרפים מיידיים", body: "מדדי KPI מדורגים וגרפים מדויקים לצורת הנתונים שלכם: מגמות, השוואות, מתאמים והתפלגויות." },
      { title: "סטטיסטיקה אמיתית", body: "מבחני מובהקות, רגרסיה OLS ומרובה, ANOVA, חי בריבוע וחיזוי — ברמת statsmodels, בתוך הדפדפן." },
      { title: "מסקנות, לא רק גרפים", body: "תובנות בשפה פשוטה, מכוילות סטטיסטית ומבוססות על המספרים — מסביר לכם מה זה כנראה אומר." },
      { title: "שאלו את הנתונים", body: "כתבו ”מהי הסיבה הנפוצה ביותר“ או ”הכנסות לפי אזור כגרף עמודות“ וקבלו תשובה — בשפה פשוטה." },
    ],
  },
  method: {
    eyebrow: "השיטה",
    title: "שלושה צעדים, בלי חיכוך",
    steps: [
      { n: "01", label: "שלב 01", title: "העלאה", body: "גררו קובץ CSV, TSV, Excel או JSON. שום דבר לא נשלח לשרת — הכול מנותח בתוך הדפדפן שלכם." },
      { n: "02", label: "שלב 02", title: "אנחנו מנתחים", body: "ניקוי → אפיון → זיהוי תחום → מדדים → סטטיסטיקה → חיזוי → מסקנות, תוך שניות." },
      { n: "03", label: "שלב 03", title: "חקרו", body: "קראו את לוח המחוונים, שאלו שאלות, צרו גרפים, ייצאו ושתפו — ללא צורך במיומנות." },
    ],
  },
  privacy: {
    privTitle: "פרטי מעצם תכנונו",
    privBody: "כל הפענוח, הניקוי, המדדים, הסטטיסטיקה והגרפים פועלים כולם בתוך הדפדפן שלכם. השורות הגולמיות שלכם לעולם לא מגיעות לשרת. כשהסבר ה‑AI מופעל, נשלחות רק סטטיסטיקות מצרפיות קטנות — לעולם לא הנתונים עצמם.",
    aiTitle: "חכם, בדרך שלכם",
    aiBody: "עובד לגמרי במצב לא מקוון עם מנוע מובנה שכותב מסקנות ממבחנים סטטיסטיים אמיתיים. רוצים ניסוח עשיר יותר? חברו כל מודל שפה — Claude, Groq, Gemini — עם משתנה סביבה אחד. אין מפתח, אין בעיה: זה עדיין עובד.",
  },
  cta: { eyebrow: "מוכנים כשתרצו", lead: "ראו את הנתונים שלכם", accent: "בבהירות", sub: "ללא התקנה, ללא מיומנות בגיליונות, ללא המתנה. רק תשובות.", open: "פתחו את Quantia" },
  footer: { rights: "© 2026 Quantia · ניתוח סטטיסטי אוטונומי", analyzer: "מנתח", privacy: "פרטיות", built: "בנוי על Next.js · Vercel" },
};

export const LANDING: Record<Lang, LandingDict> = { en, he };
