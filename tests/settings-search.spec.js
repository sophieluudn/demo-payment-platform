const { test, expect } = require("@playwright/test");

test("stores filter by store and name, clear restores all, details still open", async ({
  page,
}) => {
  await page.goto("/stores.html");
  await expect(page.locator(".sys-context")).toHaveCount(0);
  await expect(page.locator("#sys-store")).toHaveValue("");
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page.locator("#sys-store").selectOption("u");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.locator("#sys-stores-search").fill("missing");
  await page.locator("#sys-search button[type=submit]").click();
  await expect(page.locator("tbody .empty")).toBeVisible();
  await page.locator("[data-action=reset-stores-search]").click();
  await expect(page.locator("#sys-store")).toHaveValue("");
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page.getByRole("button", { name: "檢視", exact: true }).last().click();
  await expect(page.locator(".sys-editor-title")).toBeVisible();
  await page.getByRole("button", { name: "返回列表" }).click();
  await expect(page.locator("#sys-store")).toHaveValue("");
});

test("store manager defaults and clears to entered store", async ({ page }) => {
  await page.goto("/stores.html");
  await page.evaluate(() => {
    const key = "payment-system-management-v2";
    const saved = JSON.parse(localStorage.getItem(key));
    saved.currentUserId = "partial";
    saved.store = "edu";
    localStorage.setItem(key, JSON.stringify(saved));
  });
  await page.reload();
  await expect(page.locator("#sys-store")).toHaveValue("edu");
  await expect(page.locator("#sys-store option[value=u]")).toHaveCount(0);
  await page.locator("#sys-store").selectOption("");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.locator("[data-action=reset-stores-search]").click();
  await expect(page.locator("#sys-store")).toHaveValue("edu");
});

test("payment search and clear retain add action outside search form", async ({
  page,
}) => {
  await page.goto("/payments.html");
  const count = await page.locator("tbody tr").count();
  await page.locator("#sys-payments-search").fill("missing");
  await page.locator("#sys-search button[type=submit]").click();
  await expect(page.locator("tbody .empty")).toBeVisible();
  await page.locator("[data-action=reset-payments-search]").click();
  await expect(page.locator("#sys-payments-search")).toHaveValue("");
  await expect(page.locator("tbody tr")).toHaveCount(count);
  await page
    .locator(".sys-payments-list-toolbar [data-action=new-payment]")
    .click();
  await expect(page.locator("#sys-payment-dialog")).toBeVisible();
});
