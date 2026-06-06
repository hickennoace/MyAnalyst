import type { Table } from "./types";

// A small, realistic sales/operational dataset for the "try a sample" button.
// Deterministic so the demo dashboard is stable across loads.

export function sampleTable(): Table {
  const regions = ["North", "South", "East", "West"];
  const products = ["Alpha", "Beta", "Gamma"];
  const rows: Record<string, unknown>[] = [];

  let seed = 42;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  const start = new Date("2023-01-01");
  for (let week = 0; week < 78; week++) {
    const date = new Date(start.getTime() + week * 7 * 86400000);
    const region = regions[week % regions.length];
    const product = products[week % products.length];
    // Revenue trends up over time with noise + seasonal wobble; marketing spend loosely drives units.
    const trend = 1 + week * 0.012;
    const seasonal = 1 + 0.15 * Math.sin((week / 52) * 2 * Math.PI);
    const spend = Math.round(500 + rand() * 1500);
    const units = Math.round((20 + spend / 40) * trend * seasonal + (rand() - 0.5) * 8);
    const price = 40 + products.indexOf(product) * 15;
    const revenue = units * price;
    rows.push({
      Date: date.toISOString().slice(0, 10),
      Region: region,
      Product: product,
      "Marketing Spend": `$${spend.toLocaleString()}`,
      Units: units,
      Revenue: `$${revenue.toLocaleString()}`,
    });
  }

  // Inject one obvious outlier so the outlier detector has something to find.
  rows[40]["Units"] = 480;

  return {
    name: "sample-sales.csv",
    columns: ["Date", "Region", "Product", "Marketing Spend", "Units", "Revenue"],
    rows,
    rowCount: rows.length,
  };
}
