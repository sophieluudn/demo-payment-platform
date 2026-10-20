const { test, expect } = require("@playwright/test");

test("project search defaults to all stores for system administrators", async ({
  page,
}) => {
  await page.goto("/projects.html");
  const store = page.locator("#sys-project-store");
  await expect(store).toHaveValue("");
  await expect(page.locator(".sys-context")).toHaveCount(0);
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await page.getByRole("button", { name: "檢視", exact: true }).last().click();
  await expect(page.locator(".sys-editor-title")).toContainText("C");
  await page.getByRole("button", { name: "返回列表" }).click();
  await store.selectOption("u");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.locator("#sys-project-search").fill("nonexistent");
  await page.locator("#sys-search button[type=submit]").click();
  await expect(page.locator("tbody .empty")).toBeVisible();
  await page.locator("[data-action=reset-project-search]").click();
  await expect(store).toHaveValue("");
  await expect(page.locator("tbody tr")).toHaveCount(3);
});

test("other roles default to entered store and see only authorized projects", async ({
  page,
}) => {
  await page.goto("/projects.html");
  await page.evaluate(() => {
    const key = "payment-system-management-v2";
    const saved = JSON.parse(localStorage.getItem(key));
    saved.currentUserId = "partial";
    saved.store = "edu";
    localStorage.setItem(key, JSON.stringify(saved));
  });
  await page.reload();
  const store = page.locator("#sys-project-store");
  await expect(store).toHaveValue("edu");
  await expect(store.locator("option[value=u]")).toHaveCount(0);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody")).toContainText("A");
  await store.selectOption("");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.locator("[data-action=reset-project-search]").click();
  await expect(store).toHaveValue("edu");
});
