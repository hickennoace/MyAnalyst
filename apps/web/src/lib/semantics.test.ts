import { describe, expect, it } from "vitest";
import { isAdditive, isTransactionGrain, isValueTautology, metricKind, quantityMetric, revenueMetric } from "./semantics";
import { profileTable } from "./profile";
import type { Table } from "./types";

// A car-sales table: one row per sale. Price paid per sale = that sale's revenue. CustomerAge is an
// attribute that must NEVER be summed.
function carSales(): Table {
  const models = [
    { model: "Corolla", price: 24000, n: 40 },
    { model: "F-150", price: 45000, n: 20 },
    { model: "S-Class", price: 110000, n: 4 },
  ];
  const rows: Record<string, unknown>[] = [];
  let d = new Date("2023-01-01").getTime();
  for (const m of models) {
    for (let i = 0; i < m.n; i++) {
      d += 86_400_000;
      rows.push({ Date: new Date(d).toISOString().slice(0, 10), Model: m.model, Price: m.price + i, CustomerAge: 30 + (i % 20) });
    }
  }
  return { name: "cars.csv", columns: ["Date", "Model", "Price", "CustomerAge"], rows, rowCount: rows.length };
}

describe("isTransactionGrain", () => {
  it("recognizes one-row-per-sale data (time + repeating dimension)", () => {
    const t = carSales();
    expect(isTransactionGrain(profileTable(t), t.rowCount)).toBe(true);
  });

  it("is false without a time column", () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ Model: `M${i % 3}`, Price: 100 + i }));
    const t: Table = { name: "x.csv", columns: ["Model", "Price"], rows, rowCount: rows.length };
    expect(isTransactionGrain(profileTable(t), t.rowCount)).toBe(false);
  });
});

describe("revenueMetric", () => {
  it("picks the per-sale price as the value metric on transaction-grain data", () => {
    const t = carSales();
    const p = profileTable(t);
    const rev = revenueMetric(p, true)!;
    expect(rev).toBeDefined();
    expect(rev.name).toBe("Price");
  });

  it("prefers an explicitly value-named column over a price column", () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
      Date: `2023-01-${String((i % 28) + 1).padStart(2, "0")}`,
      Region: `R${i % 3}`,
      UnitPrice: 100,
      Revenue: 500 + i,
    }));
    const t: Table = { name: "s.csv", columns: ["Date", "Region", "UnitPrice", "Revenue"], rows, rowCount: rows.length };
    const rev = revenueMetric(profileTable(t), true)!;
    expect(rev.name).toBe("Revenue");
  });

  it("returns undefined for financial price-series data (never sum a stock price)", () => {
    const t = carSales();
    expect(revenueMetric(profileTable(t), true, "financial-timeseries")).toBeUndefined();
  });

  it("returns undefined for a non-transaction price catalog", () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ Product: `P${i}`, Price: 10 + i }));
    const t: Table = { name: "cat.csv", columns: ["Product", "Price"], rows, rowCount: rows.length };
    // No time column → not transaction grain → price must not be summed into "revenue".
    expect(revenueMetric(profileTable(t), false)).toBeUndefined();
  });
});

describe("metricKind / isAdditive", () => {
  it("treats the revenue metric as a value and age as an attribute", () => {
    const t = carSales();
    const p = profileTable(t);
    const rev = revenueMetric(p, true)!;
    const price = p.find((x) => x.name === "Price")!;
    const age = p.find((x) => x.name === "CustomerAge")!;
    expect(metricKind(price, rev)).toBe("value");
    expect(isAdditive(price, rev)).toBe(true);
    expect(metricKind(age, rev)).toBe("attribute");
    expect(isAdditive(age, rev)).toBe(false);
  });

  it("a price column that is NOT the revenue metric is an attribute (don't sum unit prices)", () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ SKU: `S${i}`, UnitPrice: 5 + i }));
    const t: Table = { name: "p.csv", columns: ["SKU", "UnitPrice"], rows, rowCount: rows.length };
    const up = profileTable(t).find((x) => x.name === "UnitPrice")!;
    expect(isAdditive(up)).toBe(false);
  });
});

describe("isValueTautology", () => {
  it("suppresses 'close the gap' for a unit price across any dimension", () => {
    expect(isValueTautology("Price", "Model")).toBe(true);
    expect(isValueTautology("Price", "Region")).toBe(true); // unit price → still a price comparison
    expect(isValueTautology("MSRP", "Salesperson")).toBe(true);
  });

  it("suppresses it for an outcome metric across a PRODUCT dimension", () => {
    expect(isValueTautology("Revenue", "Model")).toBe(true);
    expect(isValueTautology("Revenue", "Brand")).toBe(true);
  });

  it("keeps it for an outcome metric across an OPERATIONAL dimension (a real gap to close)", () => {
    expect(isValueTautology("Revenue", "Region")).toBe(false);
    expect(isValueTautology("ConversionRate", "SalesRep")).toBe(false);
    expect(isValueTautology("Satisfaction", "Store")).toBe(false);
  });
});

describe("quantityMetric", () => {
  it("finds a units/quantity column distinct from the value metric", () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ Date: `2023-02-${String((i % 27) + 1).padStart(2, "0")}`, Product: `P${i % 4}`, Revenue: 100 + i, Units: 1 + (i % 5) }));
    const t: Table = { name: "u.csv", columns: ["Date", "Product", "Revenue", "Units"], rows, rowCount: rows.length };
    const p = profileTable(t);
    const rev = revenueMetric(p, true);
    expect(quantityMetric(p, rev)!.name).toBe("Units");
  });
});
