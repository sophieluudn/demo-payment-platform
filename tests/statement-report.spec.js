const { test, expect } = require("@playwright/test");
test("statement report tabs and CSV export", async ({ page }) => {
  await page.goto("/statements.html");
  await page
    .locator(".statement-table tbody tr")
    .first()
    .getByRole("button", { name: "檢視 / 匯出" })
    .click();
  const modal = page.getByRole("dialog", { name: "交易與退款紀錄" });
  await expect(modal).toBeVisible();
  await expect(modal.locator("tbody tr")).toHaveCount(10);
  await expect(modal.locator("tfoot")).toContainText("總計");
  for (const tab of ["退款", "退款V2"]) {
    await modal.getByRole("tab", { name: tab, exact: true }).click();
    await expect(
      modal.getByRole("tab", { name: tab, exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(modal.locator("tbody tr")).toHaveCount(7);
  }
  await expect(modal.locator("thead")).toContainText("折讓單號");
  const downloaded = page.waitForEvent("download");
  await modal.getByRole("button", { name: "匯出", exact: true }).click();
  expect((await downloaded).suggestedFilename()).toContain("退款V2.csv");
  await page.screenshot({ path: "test-results/statement-report.png" });
  await page.keyboard.press("Escape");
  await expect(modal).not.toBeVisible();
});
