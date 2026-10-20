const { test, expect } = require("@playwright/test");
test("admin defaults to all, project options follow store and filter rows", async ({
  page,
}) => {
  await page.goto("/users.html");
  const store = page.locator("#sys-store"),
    project = page.locator("#sys-user-project");
  await expect(store).toHaveValue("");
  await expect(project).toHaveValue("");
  await expect(project.locator("option")).toHaveCount(4);
  await store.selectOption("u");
  await expect(project.locator("option")).toHaveCount(2);
  await project.selectOption("C");
  await expect(page.locator(".sys-user-grant-line")).toContainText([
    "U 好學",
    "線上課程專案 C",
    "交易檢視角色",
  ]);
  await store.selectOption("edu");
  await expect(project).toHaveValue("");
  await expect(project.locator("option[value=C]")).toHaveCount(0);
  await expect(project.locator("option")).toHaveCount(3);
  await page.getByRole("button", { name: "清除", exact: true }).click();
  await expect(store).toHaveValue("");
});
test("store manager defaults to entered store and all means only authorized scope", async ({
  page,
}) => {
  await page.goto("/users.html");
  await page.evaluate(() => {
    const key = "payment-system-management-v2";
    const saved = JSON.parse(localStorage.getItem(key));
    saved.currentUserId = "partial";
    saved.store = "edu";
    localStorage.setItem(key, JSON.stringify(saved));
  });
  await page.reload();
  await expect(page.locator("#sys-store")).toHaveValue("edu");
  await expect(page.locator("#sys-user-project option[value=B]")).toHaveCount(
    0,
  );
  await expect(page.locator("#sys-user-project option[value=C]")).toHaveCount(
    0,
  );
  await page.locator("#sys-store").selectOption("");
  await expect(page.locator("#sys-store option[value=u]")).toHaveCount(0);
  await expect(page.locator("#sys-user-project option")).toHaveCount(2);
});
