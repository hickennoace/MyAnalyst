import { test, expect } from "@playwright/test";

// Exercises the real browser pipeline: landing on /analyze?demo=1 runs the sample dataset through the
// Web Worker, the main thread rebuilds the charts, and the dashboard renders. The worker-clone
// regression (which 47 unit tests missed) would surface here as an error toast and no dashboard.

test("sample dataset renders a full dashboard via the worker", async ({ page }) => {
  await page.goto("/analyze?demo=1");

  // Dashboard sections appear once the worker returns a spec and it renders.
  await expect(page.getByRole("heading", { name: "Key metrics" })).toBeVisible({ timeout: 30_000 });

  // Charts are rebuilt on the main thread after the worker posts back — at least one canvas renders.
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 30_000 });

  // The clone bug would have shown this error instead of a dashboard.
  await expect(page.getByText("Something went wrong analyzing that file.")).toHaveCount(0);

  // Core interactive sections are present (level 2 = section headings, not the inner card titles).
  await expect(page.getByRole("heading", { name: "Ask your data", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Browse the data", level: 2 })).toBeVisible();
});

test("a chart can be exported to PNG", async ({ page }) => {
  await page.goto("/analyze?demo=1");
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 30_000 });

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Download chart/ }).first().click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.png$/);
});
