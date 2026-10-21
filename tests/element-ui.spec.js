const { test, expect } = require("@playwright/test");
const STORAGE = "payment-system-management-v2";
const app = (page) => page.locator("#element-app");
const field = (page, id) => page.locator(`[data-source-id="${id}"]`);

test("edited payment unit can be changed and persists", async ({page}) => {
  await page.goto("/payments.html");
  await app(page).getByRole("link").filter({hasText:"國內信用卡一次付清"}).first().click();
  const dialog = page.getByRole("dialog", {name:"編輯支付工具",exact:true});
  const unit = dialog.locator('[data-field-name="unit"] .el-select');
  await expect(unit.getByRole("combobox")).toBeEnabled();
  await choose(page,unit,"元");
  await dialog.getByRole("spinbutton").fill("150");
  const date = dialog.locator(".el-date-editor input");
  await date.fill("2099-11-01 00:00:00");
  await date.press("Tab");
  await dialog.getByRole("button", {name:"確定",exact:true}).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).data.paymentTools.find(t => t.id === "credit-card").unit,STORAGE)).toBe("元");
});

test("payment fee unit stays beside the rate and offers percent and currency", async ({page}) => {
  await page.goto("/payments.html");
  await app(page).getByRole("button", {name:"新增",exact:true}).click();
  const dialog = page.getByRole("dialog", {name:"新增支付工具",exact:true});
  const fee = dialog.locator(".ep-sys-payment-fee");
  for (const width of [1280,390]) {
    await page.setViewportSize({width,height:1000});
    const {rate,unit} = await fee.evaluate(node => ({
      rate:node.querySelector(".el-input-number").getBoundingClientRect().toJSON(),
      unit:node.querySelector(".el-select").getBoundingClientRect().toJSON(),
    }));
    expect(unit.width).toBe(88);
    expect(Math.abs(unit.y + unit.height / 2 - rate.y - rate.height / 2)).toBeLessThan(2);
    expect(Math.abs(unit.x-rate.x-rate.width-12)).toBeLessThan(1);
  }
  await fee.locator(".el-select").click();
  await expect(page.getByRole("option")).toHaveText(["%","元"]);
  await page.getByRole("option", {name:"元",exact:true}).click();
  await expect(fee.locator(".el-select")).toContainText("元");
});

test("store and project action buttons have a visible gap", async ({ page }) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["stores", "projects"]) {
      await page.goto(`/${route}.html`);
      await expect(app(page).locator(".el-tag").filter({hasText:/^啟用$/}).first()).toBeVisible();
      const actions = app(page).locator(".management-list-actions").first();
      await expect(actions).toBeVisible();
      const buttons = actions.getByRole("button");
      const first = await buttons.nth(0).boundingBox();
      const second = await buttons.nth(1).boundingBox();
      expect(Math.max(second.x - first.x - first.width, second.y - first.y - first.height)).toBeGreaterThanOrEqual(7.5);
    }
  }
});

test("list headers and cells are left aligned across management pages", async ({ page }) => {
  for (const route of ["transactions", "products", "stores", "projects", "payments", "users", "roles", "tags", "statements", "statistics"]) {
    await page.goto(`/${route}.html`);
    await expect(app(page)).toBeVisible();
    const cells = app(page).locator(".el-table th .cell, .el-table td .cell");
    await expect(cells.first()).toBeVisible();
    expect(await cells.evaluateAll(nodes => nodes.filter(node => getComputedStyle(node).textAlign !== "left").map(node => node.textContent))).toEqual([]);
  }
});

test("header account menu switches stores and returns to login", async ({ page }) => {
  for (const route of ["index", "products"]) {
    await page.goto(`/${route}.html`);
    const account = page.getByRole("button", { name: "帳戶選單" });
    await expect(account).toContainText("C");
    await account.click();
    await page.getByRole("menuitem", { name: "切換商店" }).click();
    await expect(page).toHaveURL(/\/select-store\.html$/);
    await expect(page.getByRole("heading", { name: "請選擇商店" })).toBeVisible();
    await page.goto(`/${route}.html`);
    await page.getByRole("button", { name: "帳戶選單" }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("menuitem", { name: "登出", exact: true }).click();
    await expect(page).toHaveURL(/\/login\.html$/);
    await expect(page.getByRole("button", { name: "使用 Google 帳戶登入" })).toBeVisible();
  }
});
test("transaction detail estimates tool fees with a minimum and five decimal places", async ({page}) => {
  await page.goto("/transaction-detail.html?order=202610080050006");
  const summary = field(page,"payment-summary");
  await expect(summary).toContainText("預估手續費");
  await expect(summary).toContainText("NT$1.00000 元");
  await expect(summary).not.toContainText("%");
  expect(await page.evaluate(() => {
    const order = [...window.transactionOrders.find(order => order[0] === "202610080050006")];
    order[7] = "1008";
    return TransactionFees.estimate(order).feeAmount;
  })).toBe(20.1096);
  await page.goto("/transaction-detail.html?order=202610080050001");
  await expect(field(page,"payment-summary")).toContainText("NT$20.16000 元");
});
for (const route of ["stores", "projects"]) {
  test(`${route} fee inputs follow tool availability in new, edit and view dialogs`, async ({page}) => {
    await page.goto(`/${route}.html`);
    await app(page).getByRole("button", {name:"管理手續費",exact:true}).first().click();
    await expect(app(page).locator(".el-table")).toHaveCount(1);
    await expect(app(page).getByRole("columnheader", {name:"設定狀態",exact:true})).toBeVisible();
    await expect(app(page).getByRole("columnheader", {name:"費率生效狀態",exact:true})).toBeVisible();
    await expect(app(page).getByRole("columnheader", {name:"設定方式",exact:true})).toHaveCount(0);
    await expect(page.locator("#controller-source .effective-fee-table")).toHaveCount(0);
    await app(page).getByRole("button", {name:"新增手續費率",exact:true}).click();
    let dialog = page.getByRole("dialog", {name:"新增手續費率",exact:true});
    let row = dialog.locator(".el-table__body tr").first();
    await expect(dialog.locator(".el-select")).toHaveCount(0);
    await expect(dialog).not.toContainText("全站預設");
    const globalFee = await page.evaluate(() => new window.SystemManagement.SystemManagement(window.SystemManagement.seed()).resolveFee(window.SystemManagement.seed().paymentTools[0].id).fee);
    await expect(row.getByRole("spinbutton")).toHaveValue(String(globalFee));
    for (const width of [1280, 390]) {
      await page.setViewportSize({width, height: 1000});
      await expect(dialog).toBeVisible();
      expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    }
    await page.setViewportSize({width:1280,height:1000});
    const toggle = row.locator(".el-switch");
    if (await row.getByRole("switch").getAttribute("aria-checked") === "false") await toggle.click();
    await expect(row.getByRole("spinbutton")).toBeEnabled();
    await row.getByRole("spinbutton").fill("1.23");
    await toggle.click();
    await expect(row.getByRole("spinbutton")).toBeDisabled();
    await toggle.click();
    await expect(row.getByRole("spinbutton")).toBeEnabled();
    await expect(row.getByRole("spinbutton")).toHaveValue("1.23");
    await toggle.click();
    await dialog.getByRole("button", {name:"確定",exact:true}).click();
    await expect(dialog).toBeHidden();
    const version = app(page).locator(".el-table__body tr").first();
    await version.getByRole("button", {name:"編輯",exact:true}).click();
    dialog = page.getByRole("dialog", {name:"編輯手續費率",exact:true});
    row = dialog.locator(".el-table__body tr").first();
    await expect(row.getByRole("switch")).toHaveAttribute("aria-checked","false");
    await expect(row.getByRole("spinbutton")).toBeDisabled();
    await row.locator(".el-switch").click();
    await expect(row.getByRole("spinbutton")).toBeEnabled();
    await dialog.getByRole("button", {name:"取消",exact:true}).click();
    await version.getByRole("button", {name:"檢視",exact:true}).click();
    dialog = page.getByRole("dialog", {name:"檢視手續費率",exact:true});
    for (const input of await dialog.getByRole("spinbutton").all()) await expect(input).toBeDisabled();
  });
}
test("saving a user rejects conflicting roles for the same store and project", async ({page}) => {
  await page.goto("/users.html");
  await page.evaluate(() => {
    window.userConflictSaved = false;
    window.openUserCreateModal({
      user: {name:"角色衝突測試", email:"conflict@example.com"},
      stores:[{id:"edu",name:"教育事業部"}],
      projects:[{id:"A",name:"專案 A",store:"edu"}],
      roles:()=>[{id:"view",name:"檢視"},{id:"edit",name:"編輯"}],
      grants:[{store:"edu",project:"A",role:"view"},{store:"edu",project:"A",role:"edit"}],
      onSave:()=>{window.userConflictSaved=true;},
    });
  });
  const dialog = page.getByRole("dialog", {name:"編輯使用者",exact:true});
  await expect(dialog.locator(".platform-field-error")).toHaveCount(0);
  await dialog.getByRole("button", {name:"確定",exact:true}).click();
  await expect(dialog.locator(".platform-field-error")).toHaveText("同一商店的同一專案只能設定一個角色權限");
  expect(await page.evaluate(()=>window.userConflictSaved)).toBe(false);
});
test("user validation appears only after confirmation and clears when corrected", async ({ page }) => {
  await page.goto("/users.html");
  await app(page).getByRole("button", { name: "新增", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "新增使用者" });
  const name = dialog.getByRole("textbox", { name: "姓名", exact: true });
  const email = dialog.getByRole("textbox", { name: "Email 帳號", exact: true });
  await name.focus();
  await email.fill("invalid");
  await name.focus();
  await expect(dialog.locator(".platform-field-error")).toHaveCount(0);
  await dialog.getByRole("button", { name: "確定", exact: true }).click();
  await expect(dialog.locator(".platform-field-error")).toHaveCount(4);
  await expect(dialog).toContainText("請輸入有效的電子郵件地址");
  await name.fill("驗證測試");
  await email.fill("validation@example.com");
  await expect(dialog.locator(".platform-field-error")).toHaveCount(2);
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await app(page).getByRole("button", { name: "新增", exact: true }).click();
  await expect(dialog.locator(".platform-field-error")).toHaveCount(0);
});
async function choose(page, target, label) {
  await target.click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

test("demo login leads to store selection and keeps the selected store in management", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login\.html$/);
  await expect(
    page.getByRole("heading", { name: "行動支付支援平台 (Demo)", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "使用 Google 帳戶登入" }).click();
  await expect(page).toHaveURL(/\/select-store\.html$/);
  await expect(page.getByRole("heading", { name: "請選擇商店" })).toBeVisible();
  await page.getByRole("button", { name: "U 好學", exact: true }).click();
  await expect(page).toHaveURL(/\/index\.html$/);
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).store,
      STORAGE,
    ),
  ).toBe("u");
  await page.goto("/projects.html");
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).store,
      STORAGE,
    ),
  ).toBe("u");
});

test("store selection honors existing identity and handles mobile and long store lists", async ({
  page,
}) => {
  const { seed } = require("../system-model");
  const data = seed();
  for (let index = 0; index < 70; index++)
    data.stores.push({
      id: `extra-${index}`,
      name: `行動支付測試商店 ${index + 1}`,
    });
  await page.addInitScript(
    ({ key, data }) =>
      localStorage.setItem(
        key,
        JSON.stringify({ data, currentUserId: "charlie", store: "edu" }),
      ),
    { key: STORAGE, data },
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/select-store.html");
  await expect(
    page.getByRole("navigation", { name: "可選商店" }).getByRole("button"),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "教育事業部", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key));
    state.currentUserId = "admin";
    localStorage.setItem(key, JSON.stringify(state));
  }, STORAGE);
  // The init script restores the viewer on navigation, so remove it for this separate context.
  const context = await page
    .context()
    .browser()
    .newContext({ viewport: { width: 390, height: 844 } });
  const admin = await context.newPage();
  await admin.addInitScript(
    ({ key, data }) =>
      localStorage.setItem(
        key,
        JSON.stringify({ data, currentUserId: "admin", store: "edu" }),
      ),
    { key: STORAGE, data },
  );
  await admin.goto("/select-store.html");
  await expect(admin.getByRole("navigation").getByRole("button")).toHaveCount(
    72,
  );
  await admin
    .getByRole("button", { name: "行動支付測試商店 70", exact: true })
    .scrollIntoViewIfNeeded();
  expect(
    await admin.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await context.close();
});

test("all routes render Element Plus without runtime errors at desktop and mobile widths", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "index",
      "transactions",
      "products",
      "tags",
      "statistics",
      "statements",
      "users",
      "roles",
      "projects",
      "stores",
      "payments",
      "transaction-detail",
    ]) {
      await page.goto(
        `/${route}.html${route === "transaction-detail" ? "?order=202610080050006" : ""}`,
      );
      await expect(app(page).locator(".el-menu")).not.toHaveCount(0);
      await expect(page.locator("#controller-source")).toBeHidden();
      if (route !== "index")
        await expect(app(page).locator(".el-table")).not.toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
    }
  }
  expect(errors).toEqual([]);
});

test("project and store filters default to the entered store for admin and filter actual rows", async ({
  page,
}) => {
  for (const route of ["projects", "stores"]) {
    await page.goto(`/${route}.html`);
    const target = field(
      page,
      route === "projects" ? "sys-project-store" : "sys-store",
    );
    await expect(target).toContainText("教育事業部");
    await choose(page, target, "U 好學");
    await expect(app(page).locator(".el-table__body tbody tr")).toHaveCount(1);
    await app(page).getByRole("button", { name: "清除", exact: true }).click();
    await expect(target).toContainText("教育事業部");
    await expect(app(page).locator(".el-table__body tbody tr")).toHaveCount(
      route === "projects" ? 2 : 1,
    );
  }
});

test("pagination changes page size and page using controller data", async ({
  page,
}) => {
  await page.goto("/projects.html");
  await choose(page,field(page,"sys-project-store"),"全部商店");
  await choose(page, app(page).locator(".el-pagination .el-select"), "2項/頁");
  await expect(app(page).locator(".el-table__body tr")).toHaveCount(2);
  await app(page)
    .locator(".el-pagination")
    .getByRole("button", { name: "下一頁" })
    .click();
  await expect(app(page).locator(".el-table__body tr")).toHaveCount(1);
  await expect(app(page).locator(".el-table")).toContainText("線上課程專案 C");
  await choose(page, app(page).locator(".el-pagination .el-select"), "10項/頁");
  await expect(app(page).locator(".el-table__body tr")).toHaveCount(3);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(app(page).locator(".platform-sidebar")).toHaveCSS(
    "width",
    "64px",
  );
});

test("entered store and authorization remain enforced for other roles", async ({
  page,
}) => {
  await page.goto("/projects.html");
  await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key));
    state.currentUserId = "partial";
    state.store = "edu";
    localStorage.setItem(key, JSON.stringify(state));
  }, STORAGE);
  await page.reload();
  await expect(field(page, "sys-project-store")).toContainText("教育事業部");
  await expect(app(page).locator(".el-table__body tbody tr")).toHaveCount(1);
  await expect(
    app(page).getByText("支付工具設定", { exact: true }),
  ).toHaveCount(0);
  await page.goto("/stores.html");
  await expect(field(page, "sys-store")).toContainText("教育事業部");
  await page.goto("/payments.html");
  await expect(app(page)).toContainText("無存取權限");
  await expect(app(page).locator(".el-table")).toHaveCount(0);
});

test("payments edit, persist, clear search, cancel and Escape", async ({
  page,
}) => {
  await page.goto("/payments.html");
  const row = app(page)
    .locator(".el-table__body tr")
    .filter({ hasText: "國內信用卡一次付清" })
    .first();
  await row.getByRole("link").click();
  const dialog = page.getByRole("dialog", {
    name: "編輯支付工具",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("spinbutton").fill("3.5");
  const date = dialog.locator(".el-date-editor input");
  await date.fill("2099-11-01 00:00:00");
  await date.press("Tab");
  await dialog.getByRole("button", { name: "確定", exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(row).toContainText("3.5");
  await row.getByRole("link").click();
  await expect(
    dialog
      .locator(".el-select")
      .filter({
        has: page.getByRole("combobox", {
          name: "第三方金流平台",
          exact: true,
        }),
      }),
  ).toContainText("藍新金流");
  await expect(
    dialog.getByRole("textbox", { name: "付款方式代碼", exact: true }),
  ).toHaveValue("CREDIT");
  await expect(dialog.locator(".el-date-editor input")).toHaveValue(
    "2099-11-01 00:00:00",
  );
  await dialog.getByRole("spinbutton").fill("3.75");
  await dialog.getByRole("button", { name: "確定", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(row).toContainText("3.75");
  const versions = await page.evaluate(
    (key) =>
      JSON.parse(localStorage.getItem(key)).data.feeVersions.filter(
        (v) => v.scope === "global" && v.target === "credit-card",
      ),
    STORAGE,
  );
  expect(versions.filter((v) => !v.cancelledAt)).toHaveLength(2);
  expect(versions.some((v) => v.replacedBy)).toBe(true);
  await app(page)
    .getByRole("textbox", { name: "關鍵字", exact: true })
    .fill("missing");
  await app(page).getByRole("button", { name: "搜尋", exact: true }).click();
  await expect(app(page).locator(".el-empty")).toBeVisible();
  await app(page).getByRole("button", { name: "清除", exact: true }).click();
  await expect(row).toBeVisible();
  await app(page).getByRole("button", { name: "新增", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "新增支付工具" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("payment platform dropdown filters together with keywords and resets to all", async ({
  page,
}) => {
  await page.goto("/payments.html");
  const platform = app(page).locator(".ep-sys-payments-search .el-select");
  await platform.click();
  for (const name of [
    "全部",
    "藍新金流",
    "Line Pay",
    "街口支付",
    "台灣行動支付",
  ]) {
    await expect(page.getByRole("option", { name, exact: true })).toBeVisible();
  }
  await page.getByRole("option", { name: "Line Pay", exact: true }).click();
  await app(page).getByRole("button", { name: "搜尋", exact: true }).click();
  await expect(app(page).locator(".el-table__body tr")).toHaveCount(1);
  await expect(app(page).locator(".el-table__body tr")).toContainText(
    "Line Pay",
  );
  await expect(
    app(page).getByRole("columnheader", { name: "下一次手續費", exact: true }),
  ).toHaveCount(0);
  await expect(
    app(page).getByRole("columnheader", {
      name: "手續費開始時間 (GMT+8)",
      exact: true,
    }),
  ).toBeVisible();
  await app(page)
    .getByRole("textbox", { name: "關鍵字", exact: true })
    .fill("Apple");
  await app(page).getByRole("button", { name: "搜尋", exact: true }).click();
  await expect(app(page).locator(".el-empty")).toBeVisible();
  await app(page).getByRole("button", { name: "清除", exact: true }).click();
  await expect(platform).toContainText("全部");
  await expect(app(page).locator(".el-table__body tr")).toHaveCount(11);
});

test("payment fee versions retain history when revised through the edit modal", async ({
  page,
}) => {
  await page.goto("/payments.html");
  const row = app(page)
    .locator(".el-table__body tr")
    .filter({ hasText: "國內信用卡一次付清" })
    .first();
  await row.getByRole("link").click();
  const dialog = page.getByRole("dialog", {
    name: "編輯支付工具",
    exact: true,
  });
  await expect(
    dialog.getByRole("button", { name: "費率歷程", exact: true }),
  ).toHaveCount(0);
  const date = dialog.locator(".el-date-editor input");
  await date.fill("2099-11-01 00:00:00");
  await date.press("Tab");
  await dialog.getByRole("spinbutton").fill("2.8");
  await dialog.getByRole("button", { name: "確定", exact: true }).click();
  await expect(dialog).toBeHidden();
  await row.getByRole("link").click();
  await dialog.getByRole("spinbutton").fill("3.1");
  await dialog.getByRole("button", { name: "確定", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(row).toContainText("3.1%");
  await page.reload();
  await expect(row).toContainText("3.1%");
  const versions = await page.evaluate(
    (key) =>
      JSON.parse(localStorage.getItem(key)).data.feeVersions.filter(
        (v) => v.target === "credit-card",
      ),
    STORAGE,
  );
  expect(versions.some((v) => v.replacedBy)).toBe(true);
  expect(versions.filter((v) => !v.cancelledAt)).toHaveLength(2);
});

test("store and project fees start from global rates and persist across reloads", async ({page}) => {
  await page.clock.setFixedTime(new Date("2026-10-19T04:00:00Z"));
  await page.goto("/stores.html");
  await app(page).getByRole("button",{name:"\u7ba1\u7406\u624b\u7e8c\u8cbb",exact:true}).first().click();
  await app(page).getByRole("button",{name:"\u65b0\u589e\u624b\u7e8c\u8cbb\u7387",exact:true}).click();
  let dialog = page.getByRole("dialog",{name:"\u65b0\u589e\u624b\u7e8c\u8cbb\u7387",exact:true});
  let credit = dialog.getByRole("row").filter({hasText:"\u570b\u5167\u4fe1\u7528\u5361\u4e00\u6b21\u4ed8\u6e05"});
  await expect(credit.locator(".el-select")).toHaveCount(0);
  await credit.getByRole("spinbutton").fill("2.5");
  await dialog.getByRole("button",{name:"\u78ba\u5b9a",exact:true}).click();
  await expect(dialog).toBeHidden();
  await page.clock.setFixedTime(new Date("2026-10-19T04:02:00Z"));
  await page.goto("/projects.html");
  await app(page).getByRole("button",{name:"\u7ba1\u7406\u624b\u7e8c\u8cbb",exact:true}).first().click();
  await app(page).getByRole("button",{name:"\u65b0\u589e\u624b\u7e8c\u8cbb\u7387",exact:true}).click();
  dialog = page.getByRole("dialog",{name:"\u65b0\u589e\u624b\u7e8c\u8cbb\u7387",exact:true});
  credit = dialog.getByRole("row").filter({hasText:"\u570b\u5167\u4fe1\u7528\u5361\u4e00\u6b21\u4ed8\u6e05"});
  const globalFee = await page.evaluate(() => new window.SystemManagement.SystemManagement(window.SystemManagement.seed()).resolveFee("credit-card").fee);
  await expect(credit.getByRole("spinbutton")).toHaveValue(String(globalFee));
  await expect(credit.locator(".el-select")).toHaveCount(0);
  await credit.getByRole("spinbutton").fill("3");
  await dialog.getByRole("button",{name:"\u78ba\u5b9a",exact:true}).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await app(page).getByRole("button",{name:"\u7ba1\u7406\u624b\u7e8c\u8cbb",exact:true}).first().click();
  await app(page).getByRole("button",{name:"\u7de8\u8f2f",exact:true}).first().click();
  dialog=page.getByRole("dialog",{name:"\u7de8\u8f2f\u624b\u7e8c\u8cbb\u7387",exact:true});
  await expect(dialog.getByRole("row").filter({hasText:"\u570b\u5167\u4fe1\u7528\u5361\u4e00\u6b21\u4ed8\u6e05"}).getByRole("spinbutton")).toHaveValue("3");
  const stored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).data.feeVersions,STORAGE);
  expect(stored.find(v=>v.scope==="project").entries["credit-card"]).toEqual({mode:"custom",fee:"3",enabled:true});
});

test("new payment tools appear in inherited store and project batches", async ({
  page,
}) => {
  await page.goto("/payments.html");
  await app(page).getByRole("button", { name: "新增", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "新增支付工具", exact: true });
  await choose(
    page,
    dialog
      .locator(".el-select")
      .filter({
        has: page.getByRole("combobox", {
          name: "第三方金流平台",
          exact: true,
        }),
      }),
    "街口支付",
  );
  await dialog
    .getByRole("textbox", { name: "* 支付工具名稱", exact: true })
    .fill("街口支付");
  await dialog
    .getByRole("textbox", { name: "付款方式代碼", exact: true })
    .fill("JKOPAY");
  await dialog.getByRole("spinbutton").fill("2.2");
  await dialog.getByRole("button", { name: "確定", exact: true }).click();
  await expect(dialog).toBeHidden();
  for (const [route, name, upper] of [
    ["stores", "教育事業部", "全站"],
    ["projects", "線上商城專案 A", "商店"],
  ]) {
    await page.goto(`/${route}.html`);
    await app(page)
      .locator(".el-table__body tr")
      .filter({ hasText: name })
      .getByRole("button", { name: "管理手續費", exact: true })
      .click();
    await app(page).getByRole("button",{name:"\u65b0\u589e\u624b\u7e8c\u8cbb\u7387",exact:true}).click();
    dialog = page.getByRole("dialog",{name:"\u65b0\u589e\u624b\u7e8c\u8cbb\u7387",exact:true});
    const tool = dialog.getByRole("row").filter({hasText:"\u8857\u53e3\u652f\u4ed8"});
    await expect(tool.locator(".el-select")).toHaveCount(0);
    await expect(tool.getByRole("spinbutton")).toHaveValue("2.2");
  }
});

test("recorded transaction fee snapshots display the saved rate instead of the demo estimate", async ({
  page,
}) => {
  await page.goto("/transactions.html");
  await app(page).locator(".el-table").waitFor();
  await page.evaluate(() =>
    TransactionFees.record({
      id: "202610080050006",
      projectId: "B",
      toolId: "line-pay",
      paidAt: "2026-10-08T15:55:23+08:00",
      amount: "9",
    }),
  );
  await page.goto("/transaction-detail.html?order=202610080050006");
  await expect(app(page)).toContainText("交易手續費");
  await expect(field(page, "payment-summary")).not.toContainText("%");
  expect(await page.evaluate(() => TransactionFees.read("202610080050006").fee)).toBe("1.995");
});

test("scheduled fees become current on an already open payment list", async ({
  page,
}) => {
  const { SystemManagement } = require("../system-model");
  const now = new Date("2026-10-15T00:00:00+08:00");
  const model = new SystemManagement();
  model.saveFeeVersion(
    "global",
    "credit-card",
    {
      effectiveAt: "2026-10-15T00:01",
      entries: { "credit-card": { mode: "custom", fee: "3" } },
    },
    now,
  );
  await page.clock.install({ time: now });
  await page.addInitScript(
    ({ key, data }) =>
      localStorage.setItem(
        key,
        JSON.stringify({ data, currentUserId: "admin", store: "edu" }),
      ),
    { key: STORAGE, data: model.data },
  );
  await page.goto("/payments.html");
  const rows = app(page)
    .locator(".el-table__body tr")
    .filter({ hasText: "國內信用卡一次付清" });
  await expect(
    rows
      .filter({ has: page.locator(".el-tag", { hasText: /^啟用$/ }) })
      .locator("td")
      .nth(2),
  ).toHaveText("2%");
  await expect(
    rows.filter({ hasText: "未啟用" }).locator(".el-tag"),
  ).toHaveText("未啟用");
  await expect(
    rows.filter({ hasText: "未啟用" }).locator("td").nth(2),
  ).toHaveText("3%");
  await page.clock.runFor(61000);
  await expect(
    rows
      .filter({ has: page.locator(".el-tag", { hasText: /^啟用$/ }) })
      .locator("td")
      .nth(2),
  ).toHaveText("3%");
  await expect(
    rows.filter({ hasText: "已停用" }).locator(".el-tag"),
  ).toHaveText("已停用");
  await expect(
    rows.filter({ hasText: "已停用" }).locator("td").nth(2),
  ).toHaveText("2%");
});

test("project profiles and fee versions mirror stores and inherit store rates", async ({page}) => {
  await page.clock.setFixedTime(new Date("2026-10-19T04:00:00Z"));
  await page.goto("/projects.html");
  await page.evaluate(key=>{
    const {SystemManagement:Model,seed} = window.SystemManagement;
    const model = new Model(seed());
    const entries = Object.fromEntries(model.data.paymentTools.map(t=>[t.id,{mode:"custom",fee:t.id === "credit-card" ? "1.25" : "5"}]));
    model.saveFeeVersion("store","edu",{effectiveAt:"2026-10-18T00:00",entries},new Date("2026-10-17T00:00+08:00"));
    localStorage.setItem(key,JSON.stringify({data:model.data,currentUserId:"admin",store:"edu"}));
  },STORAGE);
  await page.reload();
  await app(page).getByRole("button",{name:"新增專案",exact:true}).click();
  const profile = page.getByRole("dialog",{name:"新增專案",exact:true});
  await profile.getByRole("textbox",{name:"專案名稱",exact:true}).fill("繼承商店測試");
  await profile.getByRole("textbox",{name:"專案 ID",exact:true}).fill("INHERIT-TEST");
  await profile.getByRole("button",{name:"確定",exact:true}).click();
  const row = app(page).getByRole("row").filter({hasText:"繼承商店測試"});
  await row.getByRole("button",{name:"編輯專案",exact:true}).click();
  await expect(page.getByRole("dialog",{name:"編輯專案"}).getByRole("textbox",{name:"專案 ID",exact:true})).toHaveValue("INHERIT-TEST");
  await page.getByRole("dialog",{name:"編輯專案"}).getByRole("button",{name:"取消",exact:true}).click();
  await row.getByRole("button",{name:"管理手續費",exact:true}).click();
  await expect(app(page)).toContainText("目前繼承商店費率");
  await app(page).getByRole("button",{name:"新增手續費率",exact:true}).click();
  let dialog = page.getByRole("dialog",{name:"新增手續費率",exact:true});
  const credit = dialog.getByRole("row").filter({hasText:"國內信用卡一次付清"});
  const globalFee = await page.evaluate(() => new window.SystemManagement.SystemManagement(window.SystemManagement.seed()).resolveFee("credit-card").fee);
  await expect(credit.getByRole("spinbutton")).toHaveValue(String(globalFee));
  await expect(credit.locator(".el-select")).toHaveCount(0);
  await expect(credit.getByRole("spinbutton")).toBeEnabled();
  await expect(dialog.getByRole("columnheader", {name:"費率來源", exact:true})).toHaveCount(0);
  await credit.getByRole("spinbutton").fill("1.75");
  await dialog.getByRole("button",{name:"確定",exact:true}).click();
  await expect(app(page)).toContainText("待生效");
  await page.reload();
  await app(page).getByRole("row").filter({hasText:"繼承商店測試"}).getByRole("button",{name:"管理手續費",exact:true}).click();
  await expect(app(page)).toContainText("待生效");
  await app(page).getByRole("button", {name:"編輯", exact:true}).first().click();
  dialog = page.getByRole("dialog", {name:"編輯手續費率", exact:true});
  await expect(dialog.getByRole("columnheader", {name:"費率來源", exact:true})).toHaveCount(0);
  await expect(dialog.getByRole("row").filter({hasText:"國內信用卡一次付清"}).getByRole("spinbutton")).toHaveValue("1.75");
});

test("modal forms share horizontal labels and required markers on desktop and mobile", async ({page}) => {
  for (const [route,button] of [["users","新增"],["roles","新增"],["projects","新增專案"],["stores","新增商店"],["payments","新增"],["products","新增"],["statements","新增"]]) {
    await page.setViewportSize({width:1440,height:1000});
    await page.goto(`/${route}.html`);
    await app(page).getByRole("button",{name:button,exact:true}).click();
    const dialog = page.getByRole("dialog").filter({visible:true}).last();
    await expect(dialog).toBeVisible();
    for (const width of [1440,390]) {
      await page.setViewportSize({width,height:1000});
      await expect.poll(async()=>dialog.locator(".modal-field-label").evaluateAll(labels=>labels.filter(label=>{
        const style = getComputedStyle(label);
        return style.textAlign !== "right" || (label.classList.contains("ep-required") && getComputedStyle(label,"::before").content !== '"*"');
      }).map(label=>label.textContent)),{message:`${route} labels at ${width}px`}).toEqual([]);
      await expect(dialog.locator(".modal-field-label.ep-required").first()).toBeVisible();
      const required = await page.locator('#controller-source dialog[open] input[required],#controller-source dialog[open] select[required],#controller-source dialog[open] textarea[required]').evaluateAll(inputs=>inputs.filter(input=>!input.closest("table")).map(input=>input.id));
      expect(required.length).toBeGreaterThan(0);
    }
  }
});

test("roles use Element switches and partial permission checkboxes", async ({
  page,
}) => {
  await page.goto("/roles.html");
  await app(page).getByRole("button", { name: "新增", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "新增角色" });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("textbox", { name: "角色名稱" })
    .fill("Element 測試角色");
  await dialog.locator('.el-checkbox[aria-label="使用者管理整組勾選"]').click();
  await dialog.locator('.el-checkbox[aria-label="使用者管理新增 / 編輯"]').click();
  await expect(
    dialog.getByRole("checkbox", { name: "使用者管理整組勾選", exact: true }),
  ).toBeChecked({ indeterminate: true });
  await dialog.getByRole("button", { name: "確定", exact: true }).click();
  await expect(app(page)).toContainText("Element 測試角色");
  await page.reload();
  await expect(app(page)).toContainText("Element 測試角色");
});

test("expanded role modal preserves selections across stores and edit, and enforces navigation", async ({ page }) => {
  await page.goto("/roles.html");
  await app(page).getByRole("button", { name:"新增", exact:true }).click();
  let dialog = page.getByRole("dialog", { name:"新增角色" });
  await dialog.getByRole("textbox", { name:"角色名稱", exact:true }).fill("標籤編輯人員");
  await expect(dialog.getByRole("checkbox", {name:"首頁檢視",exact:true})).toHaveCount(0);
  for (const label of ["標籤管理檢視", "標籤管理新增 / 編輯", "對帳單檢視", "對帳單封存"])
    await dialog.locator(`.el-checkbox[aria-label="${label}"]`).click();
  await choose(page, dialog.locator(".el-select").first(), "教育事業部");
  await expect(dialog.getByRole("checkbox", { name:"標籤管理新增 / 編輯", exact:true })).toBeChecked();
  await expect(dialog.locator('.el-checkbox[aria-label="支付工具設定檢視"]')).toBeVisible();
  await dialog.getByRole("button", { name:"確定", exact:true }).click();
  const row = app(page).getByRole("row").filter({hasText:"標籤編輯人員"});
  await row.getByRole("button", {name:"編輯", exact:true}).click();
  dialog = page.getByRole("dialog", {name:"編輯角色"});
  await expect(dialog.getByRole("checkbox", {name:"標籤管理新增 / 編輯",exact:true})).toBeChecked();
  await expect(dialog.getByRole("checkbox", {name:"商品管理檢視",exact:true})).not.toBeChecked();
  await dialog.getByRole("button", {name:"取消",exact:true}).click();
  await page.evaluate(key => {
    const state = JSON.parse(localStorage.getItem(key));
    const role = state.data.roles.find(r=>r.name === "標籤編輯人員");
    state.data.users.push({id:"tags-editor",name:"標籤編輯",login:"tags-editor",grants:{A:role.id}});
    state.currentUserId = "tags-editor";
    state.store = "edu";
    localStorage.setItem(key,JSON.stringify(state));
  }, STORAGE);
  await page.goto("/tags.html");
  await expect(app(page).getByRole("button", {name:"新增",exact:true})).toBeVisible();
  await expect(app(page).getByRole("button", {name:"編輯",exact:true}).first()).toBeVisible();
  await expect(app(page).locator('.platform-menu .el-menu-item').filter({hasText:"商品管理"})).toHaveCount(0);
  await page.goto("/products.html");
  await expect(app(page)).toContainText("無存取權限");
  await page.goto("/index.html");
  await expect(app(page)).not.toContainText("無存取權限");
  await page.goto("/statements.html");
  await expect(app(page).getByRole("button", {name:"新增對帳單",exact:true})).toHaveCount(0);
  await expect(app(page).getByRole("button", {name:"封存",exact:true}).first()).toBeVisible();
});

test("new user grants save through Element selects and retain role data", async ({
  page,
}) => {
  await page.goto("/users.html");
  await app(page).getByRole("button", { name: "新增", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "新增使用者" });
  await dialog
    .getByRole("textbox", { name: "姓名", exact: true })
    .fill("Element 使用者");
  await dialog
    .getByRole("textbox", { name: "Email 帳號", exact: true })
    .fill("element-test@gmail.com");
  await choose(
    page,
    dialog.locator(".ep-user-grant-draft .el-select").nth(0),
    "教育事業部",
  );
  await choose(
    page,
    dialog.locator(".ep-user-grant-draft .el-select").nth(1),
    "線上商城專案 A",
  );
  await choose(
    page,
    dialog.locator(".ep-user-grant-draft .el-select").nth(2),
    "交易檢視角色",
  );
  await dialog.getByRole("button", { name: "加入授權", exact: true }).click();
  await dialog.getByRole("button", { name: "確定", exact: true }).click();
  await expect(app(page).locator(".el-table")).toContainText(
    "element-test@gmail.com",
  );
  await page.reload();
  await expect(app(page).locator(".el-table")).toContainText(
    "element-test@gmail.com",
  );
});

test("tags inline editor retains save and cancel behavior", async ({
  page,
}) => {
  await page.goto("/tags.html");
  await app(page).getByRole("button", { name: "新增", exact: true }).click();
  await app(page)
    .getByRole("textbox", { name: "標籤名稱", exact: true })
    .fill("Element 標籤");
  await app(page)
    .getByRole("textbox", { name: "標籤說明", exact: true })
    .fill("元件遷移驗證");
  await app(page).getByRole("button", { name: "確定", exact: true }).click();
  await expect(app(page).locator(".el-table")).toContainText("Element 標籤");
  await page.reload();
  await expect(app(page).locator(".el-table")).toContainText("Element 標籤");
});

test("product dialog uses actual date pickers, cancel and delete confirmation", async ({
  page,
}) => {
  await page.goto("/products.html");
  await app(page).getByRole("button", { name: "新增", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "新增商品" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".el-date-editor")).toHaveCount(2);
  await dialog.getByRole("button", { name: "不限", exact: true }).click();
  await expect(
    dialog.locator(".el-date-editor").last().getByRole("combobox"),
  ).toHaveValue("2999-12-31 23:59:59");
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await app(page)
    .getByRole("button", { name: "刪除", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "取消", exact: true })
    .click();
});

test("payment link options, switches and links persist per product", async ({
  page,
}) => {
  await page.goto("/products.html");
  await app(page)
    .getByRole("button", { name: "付款連結管理", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "付款連結管理" });
  await dialog.locator('.el-checkbox[aria-label="Line Pay"]').click();
  await dialog
    .getByRole("textbox", { name: "交易結果返回頁" })
    .fill("https://example.com/result");
  await dialog.locator(".ep-payment-invoice-field .el-switch").click();
  await dialog.getByRole("button", { name: "新增付款連結" }).click();
  await expect(dialog.locator(".el-table")).toContainText(
    "https://example.com/result",
  );
  await expect(dialog.locator(".el-table").getByRole("switch")).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await dialog.locator(".el-table .el-switch").click();
  await expect(dialog.locator(".el-table").getByRole("switch")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.keyboard.press("Escape");
  await page.reload();
  await app(page)
    .getByRole("button", { name: "付款連結管理", exact: true })
    .first()
    .click();
  await expect(dialog.locator(".el-table")).toContainText(
    "https://example.com/result",
  );
});

test("statement editing, locked archive dates, report tabs and CSV download", async ({
  page,
}) => {
  await page.goto("/statements.html");
  const row = app(page).locator(".el-table__body tr").first();
  await row.getByRole("link").click();
  const edit = page.getByRole("dialog", { name: "編輯對帳單" });
  await expect(edit).toBeVisible();
  await edit
    .getByRole("textbox", { name: "備註", exact: true })
    .fill("Element 備註");
  await edit.getByRole("button", { name: "確定", exact: true }).click();
  await expect(row).toContainText("Element 備註");
  await row.getByRole("button", { name: "封存", exact: true }).click();
  await row.getByRole("link").click();
  await expect(edit.locator(".el-date-editor input")).toHaveCount(2);
  for (const input of await edit.locator(".el-date-editor input").all())
    await expect(input).toBeDisabled();
  await edit.getByRole("button", { name: "取消", exact: true }).click();
  await row.getByRole("button", { name: "檢視 / 匯出" }).click();
  const report = page.getByRole("dialog", { name: "交易與退款紀錄" });
  await expect(report.locator(".el-table__body tr")).toHaveCount(6);
  await expect(report.locator(".el-table__footer")).toContainText("總計");
  await report.getByRole("tab", { name: "退款V2", exact: true }).click();
  await expect(
    report.getByRole("tab", { name: "退款V2", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(report.locator(".el-table__body tr")).toHaveCount(4);
  const downloaded = page.waitForEvent("download");
  await report.getByRole("button", { name: "匯出", exact: true }).click();
  expect((await downloaded).suggestedFilename()).toContain("退款V2.csv");
});

test("refund invoice processing, confirmation and persistence work with Element dialogs", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-15T04:00:00Z"));
  await page.goto("/transaction-detail.html?order=202610080050006");
  await app(page).getByRole("button", { name: "退款", exact: true }).click();
  const refund = page.getByRole("dialog", { name: "退款", exact: true });
  await refund.getByRole("spinbutton", { name: "退款金額" }).fill("9");
  await refund
    .getByRole("button", { name: "折讓 / 作廢", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "確認作廢 / 折讓?" })
    .getByRole("button", { name: "確定", exact: true })
    .click();
  await expect(
    refund.getByRole("button", { name: "已作廢", exact: true }),
  ).toBeDisabled();
  await refund.getByRole("button", { name: "確定退款", exact: true }).click();
  await page
    .getByRole("dialog", { name: "確認退款?" })
    .getByRole("button", { name: "確定", exact: true })
    .click();
  await expect(refund).toBeHidden();
  await expect(field(page, "payment-summary")).toContainText("取消交易");
  await page.reload();
  await expect(
    app(page).getByRole("button", { name: "已退款", exact: true }),
  ).toBeDisabled();
  await app(page).getByRole("link", { name: "返回所有交易紀錄" }).click();
  const row = app(page)
    .locator(".el-table__body tr")
    .filter({ hasText: "202610080050006" });
  await expect(row).toContainText("取消交易");
  await row.getByRole("link", { name: "IJ00000008", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "發票明細" })).toBeVisible();
});
