import type { ColumnProfile, Table } from "./types";

// Currency detection + money formatting for the TS engine — mirrors the Python `_currency` module so the
// in-browser fallback and the secondary dashboard cards (Insights, Actions, ask-your-data, charts) show the
// same currency the engine detects, instead of hardcoding "$".
//
// The active currency is module-level state, set once at the start of each analysis. The TS engine analyzes
// one dataset at a time (in a worker, or synchronously on the main thread), so there's no interleaving. The
// detected currency rides along on the spec, so the main thread can re-set it before it formats anything.

const ISO_TO_SYMBOL: Record<string, string> = {
  USD: "$", CAD: "$", AUD: "$", NZD: "$", MXN: "$", SGD: "$", HKD: "$",
  EUR: "€", GBP: "£", JPY: "¥", CNY: "¥", RMB: "¥",
  ILS: "₪", NIS: "₪", INR: "₹", KRW: "₩", RUB: "₽", TRY: "₺",
  BRL: "R$", ZAR: "R", CHF: "CHF", SEK: "kr", NOK: "kr", DKK: "kr", PLN: "zł",
  THB: "฿", PHP: "₱", VND: "₫", NGN: "₦", UAH: "₴",
};
// Multi-char symbols/codes checked before single "$" so "R$" isn't read as "$".
const SYMBOLS = ["R$", "CHF", "kr", "zł", "€", "£", "¥", "₪", "₹", "₩", "₽", "₺", "฿", "₱", "₫", "₦", "₴", "$"];
const SYMBOL_TO_ISO: Record<string, string> = {
  "$": "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "₪": "ILS", "₹": "INR", "₩": "KRW",
  "₽": "RUB", "₺": "TRY", "R$": "BRL", CHF: "CHF", kr: "SEK", "zł": "PLN",
  "฿": "THB", "₱": "PHP", "₫": "VND", "₦": "NGN", "₴": "UAH",
};
const ISO_RE = new RegExp(
  "\\b(" + Object.keys(ISO_TO_SYMBOL).sort((a, b) => b.length - a.length).join("|") + ")\\b",
  "i"
);

export interface Currency {
  symbol: string;
  code: string;
}
export const DEFAULT_CURRENCY: Currency = { symbol: "$", code: "USD" };

let active: Currency = { ...DEFAULT_CURRENCY };

function fromText(text: string): Currency | null {
  const m = ISO_RE.exec(text);
  if (m) {
    const code = m[1].toUpperCase();
    return { symbol: ISO_TO_SYMBOL[code], code };
  }
  for (const sym of SYMBOLS) {
    if (text.includes(sym)) return { symbol: sym, code: SYMBOL_TO_ISO[sym] ?? sym };
  }
  return null;
}

/** Detect the dataset's currency from money-column headers (ISO codes / symbols), then raw cell values. */
export function detectCurrency(table: Table, profiles: ColumnProfile[]): Currency {
  const moneyCols = profiles.filter((p) => p.type === "currency").map((p) => p.name);
  const headerHit = fromText(moneyCols.join(" "));
  if (headerHit) return headerHit;
  for (const col of moneyCols) {
    let sample = "";
    const rows = Math.min(60, table.rows.length);
    for (let i = 0; i < rows; i++) {
      const v = table.rows[i]?.[col];
      if (v != null) sample += " " + String(v);
    }
    const hit = fromText(sample);
    if (hit) return hit;
  }
  return { ...DEFAULT_CURRENCY };
}

export function setActiveCurrency(c: Currency | undefined | null): void {
  active = c && c.symbol ? c : { ...DEFAULT_CURRENCY };
}
export function activeCurrency(): Currency {
  return active;
}
export function currencySymbol(): string {
  return active.symbol;
}

/** Compact money in the active currency: $1.2M / €340K / ₪1,200. */
export function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const s = active.symbol;
  const a = Math.abs(n);
  if (a >= 1e6) return s + (n / 1e6).toFixed(1) + "M";
  if (a >= 1e3) return s + (n / 1e3).toFixed(0) + "K";
  return s + new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}
