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
    const iso = date.toISOString().slice(0, 10);
    rows.push({
      // Mix in messy formatting the cleaner will normalize: every 5th date uses M/D/Y,
      // and some Region values carry stray whitespace.
      Date: week % 5 === 0 ? `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}` : iso,
      Region: week % 7 === 0 ? `  ${region} ` : region,
      Product: product,
      "Marketing Spend": `$${spend.toLocaleString()}`,
      Units: units,
      Revenue: `$${revenue.toLocaleString()}`,
    });
  }

  // Inject one obvious outlier so the outlier detector has something to find.
  rows[40]["Units"] = 480;

  // Inject realistic mess so the cleaning report has work to show:
  rows.push({ ...rows[10] }); // an exact duplicate row
  rows.push({ Date: "", Region: "", Product: "", "Marketing Spend": "", Units: "", Revenue: "" }); // an empty row
  rows.push({
    // a trailing "Total" summary row that must NOT count as a data point
    Date: "",
    Region: "Total",
    Product: "",
    "Marketing Spend": "$99,560",
    Units: 6523,
    Revenue: "$333,810",
  });

  return {
    name: "sample-sales.csv",
    columns: ["Date", "Region", "Product", "Marketing Spend", "Units", "Revenue"],
    rows,
    rowCount: rows.length,
  };
}
