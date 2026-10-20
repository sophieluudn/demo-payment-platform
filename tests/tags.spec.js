const { test, expect } = require("@playwright/test");
test("inline tag edit and add save or cancel", async ({ page }) => {
  await page.goto("/tags.html");
  const rows = page.locator("tbody tr");
  const count = await rows.count();
  const original = await rows.first().locator("td").first().textContent();
  await rows.first().getByRole("button", { name: "編輯", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "新增", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("textbox", { name: "標籤名稱", exact: true })
    .fill("取消修改");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(rows.first()).toContainText(original);
  await rows.first().getByRole("button", { name: "編輯", exact: true }).click();
  await page
    .getByRole("textbox", { name: "標籤名稱", exact: true })
    .fill("修改標籤");
  await page
    .getByRole("textbox", { name: "標籤說明", exact: true })
    .fill("修改說明");
  await page.getByRole("button", { name: "確定", exact: true }).click();
  await expect(rows.first()).toContainText("修改標籤");
  await page.getByRole("button", { name: "新增", exact: true }).click();
  await expect(rows).toHaveCount(count + 1);
  await expect(
    page.getByRole("button", { name: "確定", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(rows).toHaveCount(count);
  await page.getByRole("button", { name: "新增", exact: true }).click();
  await page
    .getByRole("textbox", { name: "標籤名稱", exact: true })
    .fill("新增標籤");
  await page
    .getByRole("textbox", { name: "標籤說明", exact: true })
    .fill("新增說明");
  await page.screenshot({ path: "test-results/tags-inline-add.png" });
  await page.getByRole("button", { name: "確定", exact: true }).click();
  await expect(rows.first()).toContainText("新增標籤");
  await page.reload();
  await expect(rows).toHaveCount(count + 1);
  await expect(rows.nth(1)).toContainText("修改標籤");
});
