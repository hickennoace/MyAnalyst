import { test, expect } from "@playwright/test";

// Excluding a column and re-running goes back through the worker (with the cleaned column list) and
// re-renders the dashboard. Guards the re-run path + the typeOverrides/exclusion plumbing.

test("excluding a column and re-running keeps the dashboard", async ({ page }) => {
  await page.goto("/analyze?demo=1");
  await expect(page.getByRole("heading", { name: "Key metrics" })).toBeVisible({ timeout: 30_000 });

  // Open the collapsible "Columns" panel.
  await page.locator("summary", { hasText: "Columns" }).click();

  // Uncheck the first column, then apply.
  const firstCheckbox = page.getByRole("checkbox").first();
  await expect(firstCheckbox).toBeChecked();
  await firstCheckbox.uncheck();

  const apply = page.getByRole("button", { name: "Apply & re-run" });
  await expect(apply).toBeEnabled();
  await apply.click();

  // Re-run completes: dashboard still present, no error.
  await expect(page.getByRole("heading", { name: "Key metrics" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Something went wrong analyzing that file.")).toHaveCount(0);
});
