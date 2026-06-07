import { test, expect } from "@playwright/test";

// "Ask your data" should return an answer regardless of whether the optional LLM is configured:
// with a key it streams an AI answer; without one (or on rate-limit) it falls back to the local
// heuristic. Either way an answer bubble appears.
test("ask-your-data returns an answer", async ({ page }) => {
  await page.goto("/analyze?demo=1");
  await expect(page.getByRole("heading", { name: "Ask your data", level: 2 })).toBeVisible({ timeout: 30_000 });

  await page.getByLabel("Ask a question about your data").fill("give me a summary of this data");
  await page.getByRole("button", { name: "Ask", exact: true }).click();

  // 💡 = answered, 🤔 = couldn't answer — both mean a response rendered (no crash / hang).
  await expect(page.getByText(/💡|🤔/).first()).toBeVisible({ timeout: 30_000 });
});
