import type { Table } from "./types";

// Sample data for the "try a sample" button. Every call returns a FRESH, randomly
// generated dataset — a different domain (sales, SaaS, e-commerce, marketing, HR,
// real-estate, fitness …) with randomized categories, sizes and values — so the
// demo dashboard looks different every time. Each set is deliberately seeded with
// realistic mess (messy dates, currency strings, a duplicate, an empty row, a
// trailing "Total" row, an outlier) so the cleaning report and stats have work to do.

// ── small RNG helpers (true variety per load) ──────────────────────────────────
const rand = () => Math.random();
const randInt = (lo: number, hi: number) => Math.floor(lo + rand() * (hi - lo + 1));
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const subset = <T,>(arr: T[], min: number): T[] => {
  const shuffled = [...arr].sort(() => rand() - 0.5);
  return shuffled.slice(0, Math.max(min, randInt(min, arr.length)));
};
// Roughly-normal noise via central limit.
const gauss = (sd = 1) => ((rand() + rand() + rand() + rand() - 2) / 2) * sd;
const money = (n: number, sym = "$") => `${sym}${Math.max(0, Math.round(n)).toLocaleString()}`;

type Row = Record<string, unknown>;
type Gen = { name: string; columns: string[]; rows: Row[]; numericKey: string; catKey: string };

function isoDate(start: number, stepDays: number, i: number): string {
  return new Date(start + i * stepDays * 86400000).toISOString().slice(0, 10);
}
// Some rows get a messy M/D/YYYY date the cleaner will normalize.
function maybeMessyDate(iso: string, i: number): string {
  if (i % 6 !== 0) return iso;
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

// ── domain generators ──────────────────────────────────────────────────────────

function salesData(): Gen {
  const regions = subset(["North", "South", "East", "West", "Central"], 3);
  const products = subset(["Alpha", "Beta", "Gamma", "Delta", "Omega"], 3);
  const n = randInt(70, 130);
  const start = Date.UTC(2023, 0, 1);
  const base = randInt(40, 90);
  const rows: Row[] = [];
  for (let i = 0; i < n; i++) {
    const region = regions[i % regions.length];
    const product = products[i % products.length];
    const trend = 1 + i * (0.004 + rand() * 0.012);
    const seasonal = 1 + 0.18 * Math.sin((i / 52) * 2 * Math.PI);
    const spend = randInt(500, 2200);
    const units = Math.max(1, Math.round((base + spend / 38) * trend * seasonal + gauss(8)));
    const price = 35 + products.indexOf(product) * 12 + randInt(0, 6);
    rows.push({
      Date: maybeMessyDate(isoDate(start, 7, i), i),
      Region: i % 7 === 0 ? `  ${region} ` : region,
      Product: product,
      "Marketing Spend": money(spend),
      Units: units,
      Revenue: money(units * price),
    });
  }
  return { name: "sample-sales.csv", columns: ["Date", "Region", "Product", "Marketing Spend", "Units", "Revenue"], rows, numericKey: "Units", catKey: "Region" };
}

function saasData(): Gen {
  const plans = subset(["Free", "Starter", "Pro", "Business", "Enterprise"], 3);
  const channels = subset(["Organic", "Paid Ads", "Referral", "Content", "Partner"], 3);
  const n = randInt(80, 140);
  const start = Date.UTC(2023, 0, 1);
  const rows: Row[] = [];
  let mrr = randInt(8000, 20000);
  for (let i = 0; i < n; i++) {
    const signups = Math.max(0, Math.round(40 + i * 0.6 + gauss(10)));
    const churn = Math.max(0, Math.round(signups * (0.05 + rand() * 0.08)));
    const newMrr = signups * randInt(18, 60);
    mrr = Math.round(mrr * 0.99 + newMrr - churn * 30);
    rows.push({
      Week: maybeMessyDate(isoDate(start, 7, i), i),
      Plan: pick(plans),
      Channel: pick(channels),
      Signups: signups,
      Churned: churn,
      MRR: money(mrr),
    });
  }
  return { name: "sample-saas.csv", columns: ["Week", "Plan", "Channel", "Signups", "Churned", "MRR"], rows, numericKey: "Signups", catKey: "Channel" };
}

function ecommerceData(): Gen {
  const cats = subset(["Electronics", "Apparel", "Home", "Beauty", "Sports", "Toys"], 4);
  const channels = subset(["Web", "Mobile App", "Marketplace", "In-Store"], 3);
  const n = randInt(90, 150);
  const start = Date.UTC(2024, 0, 1);
  const rows: Row[] = [];
  for (let i = 0; i < n; i++) {
    const category = pick(cats);
    const qty = randInt(1, 6);
    const unit = 12 + cats.indexOf(category) * 9 + randInt(0, 40);
    const discount = pick([0, 0, 0, 5, 10, 15, 20]);
    const gross = qty * unit;
    rows.push({
      "Order Date": maybeMessyDate(isoDate(start, 2, i), i),
      Category: category,
      Channel: pick(channels),
      Quantity: qty,
      "Discount %": discount,
      Total: money(gross * (1 - discount / 100)),
    });
  }
  return { name: "sample-orders.csv", columns: ["Order Date", "Category", "Channel", "Quantity", "Discount %", "Total"], rows, numericKey: "Quantity", catKey: "Category" };
}

function marketingData(): Gen {
  const channels = subset(["Google", "Meta", "TikTok", "LinkedIn", "Email", "YouTube"], 4);
  const n = randInt(70, 120);
  const start = Date.UTC(2024, 0, 1);
  const rows: Row[] = [];
  for (let i = 0; i < n; i++) {
    const channel = pick(channels);
    const spend = randInt(200, 3000);
    const impressions = Math.round(spend * randInt(20, 80));
    const ctr = 0.005 + rand() * 0.04;
    const clicks = Math.round(impressions * ctr);
    const conversions = Math.round(clicks * (0.02 + rand() * 0.1));
    rows.push({
      Date: maybeMessyDate(isoDate(start, 3, i), i),
      Channel: channel,
      Spend: money(spend),
      Impressions: impressions,
      Clicks: clicks,
      Conversions: conversions,
    });
  }
  return { name: "sample-campaigns.csv", columns: ["Date", "Channel", "Spend", "Impressions", "Clicks", "Conversions"], rows, numericKey: "Conversions", catKey: "Channel" };
}

function hrData(): Gen {
  const depts = subset(["Engineering", "Sales", "Support", "Marketing", "Finance", "Ops"], 4);
  const levels = subset(["Junior", "Mid", "Senior", "Lead"], 3);
  const n = randInt(80, 140);
  const rows: Row[] = [];
  for (let i = 0; i < n; i++) {
    const dept = pick(depts);
    const level = pick(levels);
    const tenure = +(rand() * 9 + 0.2).toFixed(1);
    const base = 45000 + levels.indexOf(level) * 22000 + depts.indexOf(dept) * 4000;
    const salary = Math.round(base + tenure * 2500 + gauss(6000));
    const satisfaction = Math.min(10, Math.max(1, Math.round(6 + tenure * 0.15 + gauss(1.6))));
    rows.push({
      "Employee ID": `E${1000 + i}`,
      Department: dept,
      Level: level,
      "Tenure (yrs)": tenure,
      Salary: money(salary),
      Satisfaction: satisfaction,
    });
  }
  return { name: "sample-employees.csv", columns: ["Employee ID", "Department", "Level", "Tenure (yrs)", "Salary", "Satisfaction"], rows, numericKey: "Satisfaction", catKey: "Department" };
}

function realEstateData(): Gen {
  const areas = subset(["Downtown", "Riverside", "Hillcrest", "Old Town", "Lakeview", "Westend"], 4);
  const types = subset(["Apartment", "House", "Condo", "Townhouse"], 3);
  const n = randInt(80, 130);
  const rows: Row[] = [];
  for (let i = 0; i < n; i++) {
    const beds = randInt(1, 5);
    const sqft = 480 + beds * randInt(180, 320) + randInt(0, 200);
    const area = pick(areas);
    const pricePerFt = 180 + areas.indexOf(area) * 55 + randInt(0, 90);
    const price = Math.round(sqft * pricePerFt + gauss(20000));
    rows.push({
      Neighborhood: area,
      Type: pick(types),
      Bedrooms: beds,
      "Sq Ft": sqft,
      "Days on Market": Math.max(1, Math.round(60 - pricePerFt * 0.05 + gauss(18))),
      Price: money(price),
    });
  }
  return { name: "sample-listings.csv", columns: ["Neighborhood", "Type", "Bedrooms", "Sq Ft", "Days on Market", "Price"], rows, numericKey: "Sq Ft", catKey: "Neighborhood" };
}

function fitnessData(): Gen {
  const types = subset(["Run", "Cycle", "Swim", "Strength", "Yoga", "HIIT"], 4);
  const n = randInt(70, 120);
  const start = Date.UTC(2024, 0, 1);
  const rows: Row[] = [];
  for (let i = 0; i < n; i++) {
    const type = pick(types);
    const duration = randInt(15, 90);
    const intensity = 4 + types.indexOf(type) + randInt(0, 4);
    const calories = Math.round(duration * (4 + intensity) + gauss(30));
    const hr = Math.round(95 + intensity * 7 + gauss(8));
    rows.push({
      Date: maybeMessyDate(isoDate(start, 1, i), i),
      Activity: type,
      "Duration (min)": duration,
      Intensity: intensity,
      Calories: calories,
      "Avg Heart Rate": hr,
    });
  }
  return { name: "sample-workouts.csv", columns: ["Date", "Activity", "Duration (min)", "Intensity", "Calories", "Avg Heart Rate"], rows, numericKey: "Calories", catKey: "Activity" };
}

function surveyData(): Gen {
  const segments = subset(["New", "Returning", "Power User", "Trial", "Enterprise"], 3);
  const topics = subset(["Onboarding", "Support", "Pricing", "Features", "Performance"], 3);
  const n = randInt(80, 140);
  const start = Date.UTC(2024, 0, 1);
  const rows: Row[] = [];
  for (let i = 0; i < n; i++) {
    const seg = pick(segments);
    const base = 3.4 + segments.indexOf(seg) * 0.2;
    const rating = Math.min(5, Math.max(1, Math.round(base + gauss(0.9))));
    const nps = Math.min(10, Math.max(0, Math.round(rating * 1.7 + gauss(1.5))));
    const satisfaction = Math.min(10, Math.max(1, Math.round(rating * 1.8 + gauss(1.2))));
    rows.push({
      Date: maybeMessyDate(isoDate(start, 2, i), i),
      Segment: seg,
      Topic: pick(topics),
      Rating: rating,
      "NPS Score": nps,
      Satisfaction: satisfaction,
    });
  }
  return { name: "sample-survey.csv", columns: ["Date", "Segment", "Topic", "Rating", "NPS Score", "Satisfaction"], rows, numericKey: "Satisfaction", catKey: "Segment" };
}

function financeData(): Gen {
  const tickers = subset(["ACME", "GLOBEX", "INITECH", "UMBRELLA", "STARK"], 3);
  const n = randInt(90, 160);
  const start = Date.UTC(2023, 0, 1);
  const rows: Row[] = [];
  let price = randInt(50, 200);
  for (let i = 0; i < n; i++) {
    const ticker = tickers[i % tickers.length];
    const ret = gauss(0.02);
    price = Math.max(5, price * (1 + ret));
    const close = +price.toFixed(2);
    const open = +(price * (1 + gauss(0.005))).toFixed(2);
    const high = +(Math.max(open, close) * (1 + rand() * 0.01)).toFixed(2);
    const low = +(Math.min(open, close) * (1 - rand() * 0.01)).toFixed(2);
    rows.push({
      Date: maybeMessyDate(isoDate(start, 1, i), i),
      Ticker: ticker,
      Open: open,
      High: high,
      Low: low,
      Close: close,
      Volume: randInt(100000, 5000000),
    });
  }
  return { name: "sample-prices.csv", columns: ["Date", "Ticker", "Open", "High", "Low", "Close", "Volume"], rows, numericKey: "Volume", catKey: "Ticker" };
}

const GENERATORS = [salesData, saasData, ecommerceData, marketingData, hrData, realEstateData, fitnessData, surveyData, financeData];

// Add the realistic mess every dataset needs so the cleaner has something to report.
function withMess(gen: Gen): Table {
  const { columns, rows, numericKey, catKey } = gen;

  // One clear outlier so the outlier detector fires.
  if (rows.length > 10) {
    const v = rows[randInt(5, rows.length - 5)][numericKey];
    if (typeof v === "number") rows[randInt(5, rows.length - 5)][numericKey] = Math.round(v * randInt(6, 12));
  }

  // An exact duplicate row.
  rows.push({ ...rows[randInt(0, rows.length - 1)] });
  // A fully-empty row.
  rows.push(Object.fromEntries(columns.map((c) => [c, ""])));
  // A trailing "Total" summary row that must NOT count as data.
  const total: Row = Object.fromEntries(columns.map((c) => [c, ""]));
  total[catKey] = "Total";
  if (typeof rows[0][numericKey] === "number") {
    total[numericKey] = rows.reduce((s, r) => s + (typeof r[numericKey] === "number" ? (r[numericKey] as number) : 0), 0);
  }
  rows.push(total);

  return { name: gen.name, columns, rows, rowCount: rows.length };
}

/** A fresh, randomly-generated demo dataset — different on every call. */
export function sampleTable(): Table {
  return withMess(pick(GENERATORS)());
}
