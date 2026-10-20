const { test, expect } = require("@playwright/test");
for (const scope of ["*", "edu"])
  test(
    "bulk grants scope " + scope + " persists and remains editable",
    async ({ page }) => {
      await page.goto("/users.html");
      await page.getByRole("button", { name: "新增", exact: true }).click();
      const modal = page.getByRole("dialog", { name: "新增使用者" });
      await modal.getByLabel("姓名", { exact: true }).fill("批次授權");
      await modal
        .getByLabel("Email 帳號", { exact: true })
        .fill("bulk@gmail.com");
      await modal.getByLabel("商店", { exact: true }).selectOption(scope);
      await modal.getByLabel("專案", { exact: true }).selectOption("*");
      if (scope === "*")
        await expect(
          modal
            .getByLabel("角色", { exact: true })
            .locator("option[value=small]"),
        ).toHaveCount(0);
      await modal.getByLabel("角色", { exact: true }).selectOption("viewer");
      await modal.getByRole("button", { name: "加入授權" }).click();
      await expect(modal.locator(".user-grant-saved")).toHaveCount(1);
      await expect(modal.locator(".user-grant-saved")).toContainText(
        "全部專案（" + (scope === "*" ? 3 : 2) + "）",
      );
      await modal.getByRole("button", { name: "確定", exact: true }).click();
      const saved = await page.evaluate(() =>
        JSON.parse(
          localStorage.getItem("payment-system-management-v2"),
        ).data.users.find((user) => user.email === "bulk@gmail.com"),
      );
      expect(Object.keys(saved.grants).sort()).toEqual(
        scope === "*" ? ["A", "B", "C"] : ["A", "B"],
      );
      expect(saved.system).not.toBe(true);
      const row = page.getByRole("row").filter({ hasText: "bulk@gmail.com" });
      await row.getByRole("button", { name: "編輯", exact: true }).click();
      const edit = page.getByRole("dialog", { name: "編輯使用者" });
      await expect(edit.locator(".user-grant-saved")).toHaveCount(1);
      await expect(edit.locator(".user-grant-saved")).toContainText("全部專案");
      await edit.getByRole("button", { name: "取消", exact: true }).click();
    },
  );
test("partial manager bulk grants stay within authorized projects", async ({
  page,
}) => {
  await page.goto("/users.html");
  await page.evaluate(() => {
    const key = "payment-system-management-v2";
    const data = JSON.parse(localStorage.getItem(key));
    data.currentUserId = "partial";
    data.store = "edu";
    localStorage.setItem(key, JSON.stringify(data));
  });
  await page.reload();
  await page.getByRole("button", { name: "新增", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "新增使用者" });
  await modal.getByLabel("商店", { exact: true }).selectOption("*");
  await expect(
    modal
      .getByLabel("專案", { exact: true })
      .locator("option[value=B],option[value=C]"),
  ).toHaveCount(0);
  await modal.getByLabel("專案", { exact: true }).selectOption("*");
  await modal.getByLabel("角色", { exact: true }).selectOption("viewer");
  await modal.getByRole("button", { name: "加入授權" }).click();
  await expect(modal.locator(".user-grant-saved")).toContainText(
    "全部專案（1）",
  );
});
