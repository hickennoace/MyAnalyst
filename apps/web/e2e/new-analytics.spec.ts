import { test, expect } from "@playwright/test";

// A transaction-shaped CSV engineered to light up all three new lenses:
//  - a skewed repeat-customer column → concentration (80–20) + RFM,
//  - two correlated numerics (Amount, Quantity) → the relationship heatmap.
function transactionsCsv(): string {
  const rows = ["OrderDate,Customer,Category,Quantity,Amount"];
  const cats = ["Electronics", "Apparel", "Home", "Beauty", "Sports"];
  const start = Date.UTC(2024, 0, 1);
  let i = 0;
  for (let c = 0; c < 24; c++) {
    const heavy = c < 5; // a few whales place many large orders
    const orders = heavy ? 8 : 2;
    for (let o = 0; o < orders; o++) {
      const date = new Date(start + i * 86400000).toISOString().slice(0, 10);
      const qty = heavy ? 4 + (o % 5) : 1 + (o % 2);
      const amount = qty * (30 + (c % 4) * 10); // Amount tracks Quantity → strong correlation
      rows.push(`${date},CUST-${1000 + c},${cats[i % cats.length]},${qty},${amount}`);
      i++;
    }
  }
  return rows.join("\n");
}

test("new analytics sections (concentration, RFM, relationships) render", async ({ page }) => {
  await page.goto("/analyze");

  await page.setInputFiles('input[type="file"]', {
    name: "transactions.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(transactionsCsv()),
  });

  await expect(page.getByRole("heading", { name: /Ready to analyze/ })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /Start analyzing/ }).click();
  await expect(page.getByRole("heading", { name: "Key metrics" })).toBeVisible({ timeout: 30_000 });

  // Insights tab → concentration + RFM sections.
  await page.getByRole("button", { name: "Insights" }).click();
  await expect(page.getByRole("heading", { name: /80.{1,3}20/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Customer value (RFM)" })).toBeVisible();

  // Trends & drivers tab → the relationship heatmap.
  await page.getByRole("button", { name: "Trends & drivers" }).click();
  await expect(page.getByRole("heading", { name: "How your numbers relate" })).toBeVisible();

  await expect(page.getByText("Something went wrong analyzing that file.")).toHaveCount(0);
});
