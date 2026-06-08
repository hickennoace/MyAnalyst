import { test, expect } from "@playwright/test";

// A real CSV upload through the hidden file input → parse → worker → dashboard.
function sampleCsv(): string {
  const rows = ["Date,Region,Revenue,Units"];
  for (let i = 0; i < 36; i++) {
    const date = new Date(Date.UTC(2023, 0, 1) + i * 7 * 86400000).toISOString().slice(0, 10);
    const region = ["North", "South", "East"][i % 3];
    rows.push(`${date},${region},${1000 + i * 37},${10 + (i % 5)}`);
  }
  return rows.join("\n");
}

test("uploading a CSV produces a dashboard for that file", async ({ page }) => {
  await page.goto("/analyze");

  await page.setInputFiles('input[type="file"]', {
    name: "uploaded-sales.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(sampleCsv()),
  });

  // The file is staged for review first — confirm it shows, then start analyzing deliberately.
  await expect(page.getByRole("heading", { name: /Ready to analyze/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("uploaded-sales.csv").first()).toBeVisible();
  await page.getByRole("button", { name: /Start analyzing/ }).click();

  await expect(page.getByRole("heading", { name: "Key metrics" })).toBeVisible({ timeout: 30_000 });
  // The dataset's own name shows in the dashboard header.
  await expect(page.getByText("uploaded-sales.csv").first()).toBeVisible();
  await expect(page.getByText("Something went wrong analyzing that file.")).toHaveCount(0);
});
