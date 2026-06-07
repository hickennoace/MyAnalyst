import { test, expect } from "@playwright/test";
import * as XLSX from "xlsx";

// A multi-sheet workbook should surface a sheet picker and let the user switch sheets (each switch
// re-parses that sheet and re-runs the worker pipeline).
function twoSheetWorkbook(): Buffer {
  const wb = XLSX.utils.book_new();
  const sales = XLSX.utils.json_to_sheet(
    Array.from({ length: 24 }, (_, i) => ({
      Month: `2023-${String((i % 12) + 1).padStart(2, "0")}`,
      Sales: 100 + i * 7,
      Region: ["North", "South"][i % 2],
    }))
  );
  const products = XLSX.utils.json_to_sheet(
    Array.from({ length: 8 }, (_, i) => ({ Name: `P${i}`, Price: 10 + i * 3 }))
  );
  XLSX.utils.book_append_sheet(wb, sales, "Sales");
  XLSX.utils.book_append_sheet(wb, products, "Products");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

test("multi-sheet Excel shows a sheet picker and can switch sheets", async ({ page }) => {
  await page.goto("/analyze");
  await page.setInputFiles('input[type="file"]', {
    name: "book.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: twoSheetWorkbook(),
  });

  await expect(page.getByRole("heading", { name: "Key metrics" })).toBeVisible({ timeout: 30_000 });

  // Picker appears, defaults to the first sheet.
  const picker = page.getByLabel(/Choose which sheet to analyze/);
  await expect(picker).toBeVisible();
  await expect(picker).toHaveValue("Sales");

  // Switch sheets → re-analyzes without error.
  await picker.selectOption("Products");
  await expect(page.getByRole("heading", { name: "Key metrics" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Something went wrong analyzing that file.")).toHaveCount(0);
  await expect(page.getByLabel(/Choose which sheet to analyze/)).toHaveValue("Products");
});
