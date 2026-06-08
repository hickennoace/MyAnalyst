import { test, expect } from "@playwright/test";

// Exercises the real browser pipeline: landing on /analyze?demo=1 runs the sample dataset through the
// Web Worker, the main thread rebuilds the charts, and the dashboard renders. The worker-clone
// regression (which 47 unit tests missed) would surface here as an error toast and no dashboard.

test("sample dataset renders a full dashboard via the worker", async ({ page }) => {
  await page.goto("/analyze?demo=1");

  // The Overview tab (default) renders once the worker returns a spec.
  await expect(page.getByRole("heading", { name: "Key metrics" })).toBeVisible({ timeout: 30_000 });

  // The clone bug would have shown this error instead of a dashboard.
  await expect(page.getByText("Something went wrong analyzing that file.")).toHaveCount(0);

  // Charts live under the "Trends & drivers" tab — rebuilt on the main thread after the worker posts back.
  await page.getByRole("button", { name: "Trends & drivers" }).click();
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 30_000 });

  // Interactive tools live under the "Explore" tab (level 2 = section headings, not inner card titles).
  await page.getByRole("button", { name: "Explore" }).click();
  await expect(page.getByRole("heading", { name: "Ask your data", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Browse the data", level: 2 })).toBeVisible();
});

test("a chart can be exported to PNG", async ({ page }) => {
  await page.goto("/analyze?demo=1");
  await expect(page.getByRole("heading", { name: "Key metrics" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Trends & drivers" }).click();
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 30_000 });

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Download chart/ }).first().click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.png$/);
});
