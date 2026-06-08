import { describe, expect, it } from "vitest";
import { analyzeBestSellers } from "./bestsellers";
import { profileTable } from "./profile";
import type { Table } from "./types";

// Car sales: Corolla sells the most UNITS (cheap, high volume); S-Class drives the most REVENUE per
// sale though it sells few. The best-seller story must distinguish the two.
function carSales(): Table {
  const models = [
    { model: "Corolla", price: 24000, n: 60 },
    { model: "Civic", price: 26000, n: 30 },
    { model: "F-150", price: 45000, n: 25 },
    { model: "S-Class", price: 110000, n: 18 },
  ];
  const rows: Record<string, unknown>[] = [];
  let d = new Date("2023-01-01").getTime();
  for (const m of models) {
    for (let i = 0; i < m.n; i++) {
      d += 43_200_000;
      // Color is evenly spread across sales → not the "best seller" dimension; Model is.
      rows.push({ Date: new Date(d).toISOString().slice(0, 10), Model: m.model, Price: m.price, Color: ["Red", "Blue", "White"][i % 3] });
    }
  }
  return { name: "cars.csv", columns: ["Date", "Model", "Price", "Color"], rows, rowCount: rows.length };
}

describe("analyzeBestSellers", () => {
  it("picks the product dimension and ranks revenue and volume leaders separately", () => {
    const t = carSales();
    const bs = analyzeBestSellers(t, profileTable(t))!;
    expect(bs).toBeDefined();
    expect(bs.dimension).toBe("Model"); // most uneven revenue spread, not Color
    expect(bs.metric).toBe("Price");
    // S-Class makes the most money; Corolla sells the most units.
    expect(bs.topRevenue.name).toBe("S-Class");
    expect(bs.topUnits.name).toBe("Corolla");
    expect(bs.hasQuantity).toBe(false);
    // Revenue total = 60*24000 + 30*26000 + 25*45000 + 18*110000.
    expect(bs.totalRevenue).toBeCloseTo(60 * 24000 + 30 * 26000 + 25 * 45000 + 18 * 110000, 0);
    expect(bs.totalUnits).toBe(133);
    expect(bs.topUnits.units).toBe(60);
    expect(bs.topRevenue.revenueShare).toBeGreaterThan(0.3);
  });

  it("sums a real quantity column instead of counting rows when present", () => {
    const rows: Record<string, unknown>[] = [];
    let d = new Date("2023-03-01").getTime();
    // Two products; B has fewer orders but larger quantities per order.
    for (let i = 0; i < 20; i++) { d += 86_400_000; rows.push({ Date: new Date(d).toISOString().slice(0, 10), Product: "A", Revenue: 100, Units: 1 }); }
    for (let i = 0; i < 8; i++) { d += 86_400_000; rows.push({ Date: new Date(d).toISOString().slice(0, 10), Product: "B", Revenue: 500, Units: 10 }); }
    const t: Table = { name: "o.csv", columns: ["Date", "Product", "Revenue", "Units"], rows, rowCount: rows.length };
    const bs = analyzeBestSellers(t, profileTable(t))!;
    expect(bs.hasQuantity).toBe(true);
    expect(bs.metric).toBe("Revenue");
    // B: 8 orders × 10 = 80 units > A: 20 units.
    expect(bs.topUnits.name).toBe("B");
    expect(bs.totalUnits).toBe(20 * 1 + 8 * 10);
  });

  it("returns undefined when there is no revenue metric", () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ Product: `P${i % 4}`, Rating: 1 + (i % 5) }));
    const t: Table = { name: "r.csv", columns: ["Product", "Rating"], rows, rowCount: rows.length };
    expect(analyzeBestSellers(t, profileTable(t))).toBeUndefined();
  });
});
