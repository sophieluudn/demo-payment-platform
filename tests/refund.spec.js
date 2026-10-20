const { test, expect } = require("@playwright/test");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const detail =
  pathToFileURL(path.resolve(__dirname, "../transaction-detail.html")).href +
  "?order=202609080050001";
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-14T04:00:00Z") });
});

test("full refund validates amount, processes invoice and completes refund", async ({
  page,
}) => {
  await page.goto(detail);
  await page.getByRole("button", { name: "退款", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "退款", exact: true });
  const amount = modal.getByRole("spinbutton", { name: "退款金額" });
  const process = modal.getByRole("button", { name: "折讓 / 作廢" });
  await expect(process).toBeDisabled();
  for (const value of ["-1", "251", "1.5"]) {
    await amount.fill(value);
    await expect(process).toBeDisabled();
    await expect(modal.locator("#refund-error")).toBeVisible();
  }
  await amount.fill("250");
  await expect(modal.locator("#refund-total")).toHaveText("250");
  await expect(process).toBeEnabled();
  await page.screenshot({ path: "test-results/refund-entered.png" });
  await process.click();
  const confirmation = page.getByRole("dialog", { name: "確認作廢 / 折讓?" });
  await confirmation.getByRole("button", { name: "取消", exact: true }).click();
  await expect(amount).toBeEnabled();
  await process.click();
  await confirmation.getByRole("button", { name: "確定", exact: true }).click();
  await expect(modal.locator(".refund-settings")).toBeVisible();
  await expect(amount).toBeDisabled();
  await expect(modal.getByRole("button", { name: "已折讓" })).toBeDisabled();
  await expect(page.locator(".refund-notice")).toContainText(
    "發票折讓開立成功",
  );
  await page.screenshot({ path: "test-results/refund-invoice-completed.png" });
  await modal.getByRole("button", { name: "關閉退款視窗" }).click();
  await page.getByRole("button", { name: "退款", exact: true }).click();
  await expect(modal.locator(".refund-settings")).toBeVisible();
  await modal.getByRole("button", { name: "確定", exact: true }).click();
  const refundConfirm = page.getByRole("dialog", { name: "確認退款?" });
  await refundConfirm
    .getByRole("button", { name: "取消", exact: true })
    .click();
  await expect(modal).toBeVisible();
  await modal.getByRole("button", { name: "確定", exact: true }).click();
  await refundConfirm
    .getByRole("button", { name: "確定", exact: true })
    .click();
  await expect(modal).not.toBeVisible();
  await expect(page.locator(".refund-notice")).toContainText("退款成功");
  await expect(page.locator("#payment-summary")).toContainText("取消交易");
  await expect(
    page.getByRole("button", { name: "已退款", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(page.locator("#payment-summary")).toContainText("取消交易");
  await expect(page.locator("#order-history tr")).toHaveCount(9);
  await expect(page.locator("#order-history tr").nth(6)).toContainText(
    "發票折讓開立成功",
  );
  await expect(page.locator("#order-history tr").nth(6)).toContainText(
    "折讓後剩餘發票金額：NT$0",
  );
  await expect(page.locator("#order-history tr").last()).toContainText(
    "退款成功",
  );
  await expect(page.locator("#order-history tr").last()).toContainText(
    "退款原因：買家反悔",
  );
  await page
    .getByRole("link", { name: "返回所有交易紀錄", exact: true })
    .click();
  const listRow = page
    .locator(".transaction-table tbody tr")
    .filter({ hasText: "202609080050001" });
  await expect(listRow.locator("td:nth-child(9)")).toHaveText("取消交易");
  await listRow.getByRole("link", { name: "IJ00000002", exact: true }).click();
  const allowanceModal = page.getByRole("dialog", { name: "發票明細" });
  await expect(allowanceModal).toContainText("已開立折讓單");
  await expect(allowanceModal).toContainText("折讓單號");
  await expect(
    allowanceModal.locator("tr").filter({ hasText: "折讓後剩餘發票金額" }),
  ).toContainText("NT$0");
  await page.keyboard.press("Escape");
  await listRow.locator("td:first-child a").click();
  await expect(page.locator("#order-history tr")).toHaveCount(9);
  await expect(page.locator("#payment-summary")).toContainText("取消交易");
});

for (const value of ["9", "3"]) {
  test(
    "current month refund " + value + " updates both invoice views",
    async ({ page }) => {
      await page.goto(detail.replace("202609080050001", "202610080050006"));
      await page.getByRole("button", { name: "退款", exact: true }).click();
      const modal = page.getByRole("dialog", { name: "退款", exact: true });
      await modal.getByRole("spinbutton", { name: "退款金額" }).fill(value);
      await modal.getByRole("button", { name: "折讓 / 作廢" }).click();
      await page
        .getByRole("dialog", { name: "確認作廢 / 折讓?" })
        .getByRole("button", { name: "確定", exact: true })
        .click();
      await expect(
        modal.getByRole("button", { name: "已作廢" }),
      ).toBeDisabled();
      await modal.getByRole("button", { name: "確定", exact: true }).click();
      await page
        .getByRole("dialog", { name: "確認退款?" })
        .getByRole("button", { name: "確定", exact: true })
        .click();
      await expect(modal).not.toBeVisible();
      const expectedStatus = value === "9" ? "取消交易" : "部份退款";
      await expect(page.locator("#payment-summary")).toContainText(
        expectedStatus,
      );
      const invoices = page.locator(
        "#payment-summary dd:last-child .transaction-invoice-row",
      );
      await expect(invoices).toHaveCount(value === "9" ? 1 : 2);
      await expect(invoices.first()).toContainText("發票作廢成功");
      if (value === "3") {
        await expect(invoices.last()).toContainText("開發票成功");
        await invoices.last().getByRole("link").click();
        const invoiceModal = page.getByRole("dialog", { name: "發票明細" });
        await expect(invoiceModal).toContainText("NT$6");
        await expect(invoiceModal).toContainText("IJ00000009");
        await page.keyboard.press("Escape");
      }
      await page.reload();
      await expect(invoices).toHaveCount(value === "9" ? 1 : 2);
      await expect(page.locator("#order-history")).toContainText("作廢發票");
      if (value === "3")
        await expect(page.locator("#order-history")).toContainText("重開發票");
      await page
        .getByRole("link", { name: "返回所有交易紀錄", exact: true })
        .click();
      const row = page
        .locator(".transaction-table tbody tr")
        .filter({ hasText: "202610080050006" });
      await expect(row.locator("td:nth-child(9)")).toHaveText(expectedStatus);
      await expect(row.locator("td:nth-child(11) a")).toHaveCount(
        value === "9" ? 1 : 2,
      );
      await expect(row.locator("td:nth-child(12)")).toContainText(
        "發票作廢成功",
      );
      await row.getByRole("link", { name: "IJ00000008", exact: true }).click();
      await expect(
        page
          .getByRole("dialog", { name: "發票明細" })
          .locator("tr")
          .filter({ hasText: "發票備註" })
          .locator("td"),
      ).toHaveText("已作廢 不索取");
      await page.keyboard.press("Escape");
      if (value === "3") {
        await expect(row.locator("td:nth-child(12)")).toContainText(
          "開發票成功",
        );
        await row
          .getByRole("link", { name: "IJ00000009", exact: true })
          .click();
        await expect(
          page.getByRole("dialog", { name: "發票明細" }),
        ).toContainText("NT$6");
      }
    },
  );
}

test("partial refund, other reason visibility and mobile layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(detail);
  await page.getByRole("button", { name: "退款", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "退款", exact: true });
  await modal.getByRole("spinbutton", { name: "退款金額" }).fill("100");
  await modal.getByRole("button", { name: "折讓 / 作廢" }).click();
  await page
    .getByRole("dialog", { name: "確認作廢 / 折讓?" })
    .getByRole("button", { name: "確定", exact: true })
    .click();
  await expect(modal.getByRole("button", { name: "已折讓" })).toBeDisabled();
  await expect(page.locator(".refund-notice")).toContainText(
    "發票折讓開立成功",
  );
  const reason = modal.getByRole("combobox", { name: "退款原因" });
  await expect(reason.locator("option")).toHaveText([
    "買家反悔",
    "不慎誤購",
    "重複訂購",
    "詐欺訂單",
    "其他原因",
  ]);
  const other = modal.locator("#refund-other-reason");
  await expect(other).not.toBeVisible();
  await reason.selectOption("其他原因");
  await expect(other).toBeVisible();
  await other.fill("活動取消");
  await reason.selectOption("不慎誤購");
  await expect(other).not.toBeVisible();
  await expect(other).toBeDisabled();
  await reason.selectOption("其他原因");
  await expect(other).toHaveValue("活動取消");
  await modal.getByRole("textbox", { name: "電子公文文號" }).fill("DEMO-001");
  const bounds = await modal.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "test-results/refund-mobile.png" });
  await modal.getByRole("button", { name: "確定", exact: true }).click();
  await page
    .getByRole("dialog", { name: "確認退款?" })
    .getByRole("button", { name: "確定", exact: true })
    .click();
  await expect(modal).not.toBeVisible();
  await expect(page.locator("#payment-summary")).toContainText("部份退款");
  await expect(page.locator("#order-history tr").last()).toContainText(
    "退款成功，金額 NT$100",
  );
  await expect(page.locator("#order-history tr").last()).toContainText(
    "其他原因：活動取消",
  );
  await expect(page.locator("#order-history")).toContainText(
    "折讓後剩餘發票金額：NT$150",
  );
  await page
    .getByRole("link", { name: "返回所有交易紀錄", exact: true })
    .click();
  const listRow = page
    .locator(".transaction-table tbody tr")
    .filter({ hasText: "202609080050001" });
  await expect(listRow.locator("td:nth-child(9)")).toHaveText("部份退款");
  await listRow.getByRole("link", { name: "IJ00000002", exact: true }).click();
  await expect(
    page
      .getByRole("dialog", { name: "發票明細" })
      .locator("tr")
      .filter({ hasText: "折讓金額" })
      .filter({ hasNotText: "剩餘" }),
  ).toContainText("NT$100");
  await page.keyboard.press("Escape");
  await listRow.locator("td:first-child a").click();
  await expect(page.locator("#payment-summary")).toContainText("部份退款");
});
