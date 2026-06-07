import { describe, expect, it } from "vitest";
import { analyzeCohorts } from "./cohort";
import { profileTable } from "./profile";
import type { Table } from "./types";

// Customers acquired in 2023-01 and 2023-02. The Jan cohort (C1,C2,C3) stays active for 3 months;
// the Feb cohort (C4,C5) is active two months. Built so retention is hand-verifiable.
function retentionTable(): Table {
  const rows: Record<string, unknown>[] = [];
  const add = (id: string, month: string) => rows.push({ CustomerID: id, Month: `2023-${month}-15`, Spend: 50 });
  for (const id of ["C1", "C2", "C3"]) for (const m of ["01", "02", "03"]) add(id, m); // Jan cohort, 3 months each
  for (const id of ["C4", "C5"]) for (const m of ["02", "03"]) add(id, m); // Feb cohort, 2 months each
  return { name: "ret.csv", columns: ["CustomerID", "Month", "Spend"], rows, rowCount: rows.length };
}

describe("analyzeCohorts", () => {
  it("builds a retention grid from recurring entities", () => {
    const t = retentionTable();
    const c = analyzeCohorts(t, profileTable(t))!;
    expect(c).toBeDefined();
    expect(c.entity).toBe("CustomerID");
    expect(c.cohorts.length).toBe(2);

    const jan = c.cohorts.find((x) => x.label === "2023-01")!;
    expect(jan.size).toBe(3);
    // 3 customers, all active months 0,1,2 → 100% retained throughout.
    expect(jan.retention[0]).toBe(100);
    expect(jan.retention[1]).toBe(100);
    expect(jan.retention[2]).toBe(100);

    const feb = c.cohorts.find((x) => x.label === "2023-02")!;
    expect(feb.size).toBe(2);
    expect(feb.retention[0]).toBe(100);
  });

  it("returns undefined when entities never recur (transactional data)", () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ OrderID: `O${i}`, Date: `2023-0${(i % 9) + 1}-01`, Total: 10 + i }));
    const t: Table = { name: "orders.csv", columns: ["OrderID", "Date", "Total"], rows, rowCount: rows.length };
    expect(analyzeCohorts(t, profileTable(t))).toBeUndefined();
  });
});
