import { describe, it, expect, afterEach } from "vitest";
import { detectCurrency, setActiveCurrency, currencySymbol, fmtMoney, DEFAULT_CURRENCY } from "./currency";
import type { ColumnProfile, Table } from "./types";

const money = (name: string) => ({ name, type: "currency" }) as ColumnProfile;
const tbl = (columns: string[], rows: Record<string, unknown>[]): Table =>
  ({ name: "t", columns, rows } as unknown as Table);

afterEach(() => setActiveCurrency(DEFAULT_CURRENCY));

describe("currency detection", () => {
  it("reads an ISO code from a money-column header", () => {
    expect(detectCurrency(tbl(["Revenue (EUR)"], []), [money("Revenue (EUR)")])).toEqual({ symbol: "€", code: "EUR" });
  });

  it("reads a symbol from the header", () => {
    expect(detectCurrency(tbl(["Price ₪"], []), [money("Price ₪")]).symbol).toBe("₪");
  });

  it("reads a symbol from raw cell values when the header is plain", () => {
    const t = tbl(["Amount"], [{ Amount: "£1,200" }, { Amount: "£980" }]);
    expect(detectCurrency(t, [money("Amount")]).symbol).toBe("£");
  });

  it("defaults to USD when nothing is found", () => {
    expect(detectCurrency(tbl(["Sales"], [{ Sales: 100 }]), [money("Sales")])).toEqual({ symbol: "$", code: "USD" });
  });

  it("does not read 'R$' as a bare '$'", () => {
    expect(detectCurrency(tbl(["Total R$"], []), [money("Total R$")])).toEqual({ symbol: "R$", code: "BRL" });
  });
});

describe("money formatting", () => {
  it("fmtMoney uses the active symbol and compacts", () => {
    setActiveCurrency({ symbol: "€", code: "EUR" });
    expect(currencySymbol()).toBe("€");
    expect(fmtMoney(1_200_000)).toBe("€1.2M");
    expect(fmtMoney(340_000)).toBe("€340K");
    expect(fmtMoney(900)).toBe("€900");
  });

  it("falls back to $ when currency is cleared", () => {
    setActiveCurrency(null);
    expect(fmtMoney(5000)).toBe("$5K");
  });
});
