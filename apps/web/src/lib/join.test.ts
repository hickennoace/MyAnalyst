import { describe, expect, it } from "vitest";
import { suggestJoinKeys, joinTables } from "./join";
import type { Table } from "./types";

const orders: Table = {
  name: "orders.csv",
  columns: ["OrderID", "CustomerID", "Total"],
  rows: [
    { OrderID: 1, CustomerID: "C1", Total: 100 },
    { OrderID: 2, CustomerID: "C2", Total: 200 },
    { OrderID: 3, CustomerID: "C1", Total: 50 },
    { OrderID: 4, CustomerID: "C9", Total: 30 }, // no matching customer
  ],
  rowCount: 4,
};

const customers: Table = {
  name: "customers.csv",
  columns: ["CustomerID", "Region", "Total"],
  rows: [
    { CustomerID: "C1", Region: "North", Total: 999 },
    { CustomerID: "C2", Region: "South", Total: 999 },
  ],
  rowCount: 2,
};

describe("suggestJoinKeys", () => {
  it("finds the shared key and prefers the unique side", () => {
    const keys = suggestJoinKeys(orders, customers);
    expect(keys[0].leftKey).toBe("CustomerID");
    expect(keys[0].rightKey).toBe("CustomerID");
    expect(keys[0].rightUnique).toBe(true);
    expect(keys[0].overlap).toBeCloseTo(3 / 4, 5); // 3 of 4 order rows match a customer
  });
});

describe("joinTables", () => {
  it("left-joins, keeping all left rows and renaming colliding columns", () => {
    const j = joinTables(orders, customers, "CustomerID", "CustomerID", "left");
    expect(j.rowCount).toBe(4); // all order rows kept
    expect(j.columns).toContain("Region");
    expect(j.columns).toContain("Total"); // left Total
    expect(j.columns).toContain("Total (2)"); // right Total renamed on collision
    const r1 = j.rows.find((r) => r.OrderID === 1)!;
    expect(r1.Region).toBe("North");
    const r4 = j.rows.find((r) => r.OrderID === 4)!;
    expect(r4.Region).toBeNull(); // unmatched → null
  });

  it("inner-joins, dropping unmatched left rows", () => {
    const j = joinTables(orders, customers, "CustomerID", "CustomerID", "inner");
    expect(j.rowCount).toBe(3); // C9 order dropped
    expect(j.rows.every((r) => r.Region !== null)).toBe(true);
  });
});
