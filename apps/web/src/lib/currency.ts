import type { ColumnProfile, Table } from "./types";

// Currency detection + money formatting for the TS engine — mirrors the Python `_currency` module so the
// in-browser fallback and the secondary dashboard cards (Insights, Actions, ask-your-data, charts) show the
// same currency the engine detects, instead of hardcoding "$". Covers ~50 world currencies, detected from
// money-column headers (ISO codes, symbols, or the currency's NAME) and raw cell values. The dashboard
// DISPLAYS money in the detected currency — it does not convert between currencies.
//
// The active currency is module-level state, set once at the start of each analysis. The TS engine analyzes
// one dataset at a time (worker or main thread), so there's no interleaving. The detected currency also
// rides on the spec, so the main thread can re-set it before it formats anything.

const CODE_TO_SYMBOL: Record<string, string> = {
  USD: "$", CAD: "$", AUD: "$", NZD: "$", HKD: "$", SGD: "$", MXN: "$", CLP: "$", COP: "$", ARS: "$", TWD: "NT$",
  EUR: "€", GBP: "£", JPY: "¥", CNY: "¥", RMB: "¥",
  ILS: "₪", NIS: "₪", INR: "₹", KRW: "₩", RUB: "₽", TRY: "₺", THB: "฿", PHP: "₱", VND: "₫", NGN: "₦",
  UAH: "₴", GHS: "₵", PYG: "₲", KZT: "₸", GEL: "₾", CRC: "₡", BRL: "R$", ZAR: "R", EGP: "E£",
  CHF: "CHF", SEK: "kr", NOK: "kr", DKK: "kr", ISK: "kr",
  PLN: "zł", CZK: "Kč", HUF: "Ft", RON: "lei", BGN: "лв", HRK: "kn",
  AED: "AED", SAR: "SAR", QAR: "QAR", KWD: "KWD", BHD: "BHD", OMR: "OMR", JOD: "JOD",
  IDR: "Rp", MYR: "RM", PKR: "₨", LKR: "₨", NPR: "₨", BDT: "৳", KES: "KSh", MAD: "MAD", TND: "TND",
};
const NORMALIZE: Record<string, string> = { NIS: "ILS", RMB: "CNY" };

// True glyph symbols, longest first so "R$"/"NT$"/"E£" beat "$"/"£". Default code for the symbol-only case.
const GLYPHS = ["R$", "NT$", "E£", "€", "£", "¥", "₪", "₹", "₩", "₽", "₺", "฿", "₱", "₫", "₦", "₴", "₵", "₲", "₸", "₾", "₡", "$"];
const GLYPH_TO_CODE: Record<string, string> = {
  $: "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "₪": "ILS", "₹": "INR", "₩": "KRW", "₽": "RUB",
  "₺": "TRY", "฿": "THB", "₱": "PHP", "₫": "VND", "₦": "NGN", "₴": "UAH", "₵": "GHS", "₲": "PYG",
  "₸": "KZT", "₾": "GEL", "₡": "CRC", "R$": "BRL", "NT$": "TWD", "E£": "EGP",
};
// Distinctive currency NAMES (word-boundary). No bare pound/won/real/peso/krona — too ambiguous.
const WORD_TO_CODE: Record<string, string> = {
  dollar: "USD", dollars: "USD", euro: "EUR", euros: "EUR", sterling: "GBP", yen: "JPY", yuan: "CNY",
  renminbi: "CNY", shekel: "ILS", shekels: "ILS", shekalim: "ILS", rupee: "INR", rupees: "INR",
  ruble: "RUB", rubles: "RUB", rouble: "RUB", roubles: "RUB", lira: "TRY", zloty: "PLN", baht: "THB",
  ringgit: "MYR", rupiah: "IDR", dirham: "AED", riyal: "SAR", rial: "SAR", forint: "HUF", koruna: "CZK",
  reais: "BRL", franc: "CHF", francs: "CHF", hryvnia: "UAH", naira: "NGN", taka: "BDT", dong: "VND", rand: "ZAR",
};
const ISO_RE = new RegExp("\\b(" + Object.keys(CODE_TO_SYMBOL).sort((a, b) => b.length - a.length).join("|") + ")\\b", "i");
const WORD_RE = new RegExp("\\b(" + Object.keys(WORD_TO_CODE).sort((a, b) => b.length - a.length).join("|") + ")\\b", "i");

export interface Currency {
  symbol: string;
  code: string;
}
export const DEFAULT_CURRENCY: Currency = { symbol: "$", code: "USD" };

let active: Currency = { ...DEFAULT_CURRENCY };

function asCurrency(code: string): Currency {
  const c = NORMALIZE[code] ?? code;
  return { symbol: CODE_TO_SYMBOL[c] ?? "$", code: c };
}

function fromText(text: string): Currency | null {
  const iso = ISO_RE.exec(text);
  if (iso) return asCurrency(iso[1].toUpperCase());
  const word = WORD_RE.exec(text);
  if (word) return asCurrency(WORD_TO_CODE[word[1].toLowerCase()]);
  for (const sym of GLYPHS) if (text.includes(sym)) return asCurrency(GLYPH_TO_CODE[sym]);
  return null;
}

/** Detect the dataset's currency from money-column headers (ISO codes / names / symbols), then cell values. */
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
    // In cell values only trust GLYPHS (letter codes like "RM"/"kr" collide with ordinary text).
    for (const sym of GLYPHS) if (sample.includes(sym)) return asCurrency(GLYPH_TO_CODE[sym]);
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

/** Compact money in the active currency: $1.2M / €340K / ₪1,200 / ¥50K. */
export function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const s = active.symbol;
  const a = Math.abs(n);
  if (a >= 1e6) return s + (n / 1e6).toFixed(1) + "M";
  if (a >= 1e3) return s + (n / 1e3).toFixed(0) + "K";
  return s + new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}
