const { test, expect } = require("@playwright/test");
test("edit user modal loads and saves current details and grants", async ({
  page,
}) => {
  await page.goto("/users.html");
  const row = page
    .getByRole("row")
    .filter({ hasText: "charlie-a" })
    .filter({ hasNotText: "charlie-ab" });
  await row.getByRole("button", { name: "編輯", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "編輯使用者", exact: true });
  await expect(modal.getByLabel("姓名", { exact: true })).toHaveValue("陳查理");
  await expect(modal.getByLabel("Email 帳號", { exact: true })).toHaveValue(
    "charlie-a@gmail.com",
  );
  await expect(modal.locator(".user-grant-saved")).toHaveCount(1);
  await modal.getByLabel("姓名", { exact: true }).fill("陳查理修改");
  await modal.getByLabel("商店", { exact: true }).selectOption("edu");
  await modal.getByLabel("專案", { exact: true }).selectOption("B");
  await modal.getByLabel("角色", { exact: true }).selectOption("viewer");
  await modal.getByRole("button", { name: "加入授權" }).click();
  await modal.getByRole("button", { name: "確定", exact: true }).click();
  await expect(modal).not.toBeVisible();
  await expect(row).toContainText("陳查理修改");
  await expect(row).toContainText("實體活動專案 B");
  await page.reload();
  await row.getByRole("button", { name: "編輯", exact: true }).click();
  await expect(
    page
      .getByRole("dialog", { name: "編輯使用者" })
      .locator(".user-grant-saved"),
  ).toHaveCount(2);
});
test("new user supports scoped grants across stores and cancellation", async ({
  page,
}) => {
  await page.goto("/users.html");
  await page.getByRole("button", { name: "新增", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "新增使用者" });
  await modal.getByLabel("姓名", { exact: true }).fill("授權測試");
  await modal
    .getByLabel("Email 帳號", { exact: true })
    .fill("grants@gmail.com");
  for (const [store, project] of [
    ["edu", "A"],
    ["u", "C"],
  ]) {
    await modal.getByLabel("商店", { exact: true }).selectOption(store);
    await modal.getByLabel("專案", { exact: true }).selectOption(project);
    await modal.getByLabel("角色", { exact: true }).selectOption("viewer");
    await modal.getByRole("button", { name: "加入授權" }).click();
  }
  await expect(modal.locator(".user-grant-saved")).toHaveCount(2);
  await page.screenshot({ path: "test-results/user-create-modal-desktop.png" });
  await expect(modal.getByRole("button", { name: "加入既有帳號" })).toHaveCount(
    0,
  );
  await expect(modal.getByRole("button", { name: "修改授權" })).toHaveCount(0);
  await modal.getByRole("button", { name: "確定", exact: true }).click();
  await expect(modal).not.toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "grants@gmail.com" }),
  ).toContainText("線上商城專案 A");
  await page.locator("#sys-store").selectOption("u");
  await expect(
    page.getByRole("row").filter({ hasText: "grants@gmail.com" }),
  ).toContainText("線上課程專案 C");
  await page.getByRole("button", { name: "新增", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/user-create-modal-mobile.png" });
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "新增使用者" }),
  ).not.toBeVisible();
});
