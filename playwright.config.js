const { defineConfig, devices } = require("@playwright/test");

// ───────────────────────── 1. 基礎設定 ─────────────────────────
const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// ───────────────────────── 2. Playwright 設定檔 ─────────────────────────
module.exports = defineConfig({
  // 測試檔案目錄與比對規則
  testDir: "./tests",
  testMatch: ["**/element-ui.spec.js", "**/authorization-ui.spec.js"],

  // 執行設定 (預留並行與重試機制)
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // 測試報告格式
  reporter: "list",

  // 全局測試選項
  use: {
    baseURL: BASE_URL,
    headless: true,
    trace: "on-first-retry", // 失敗時自動記錄 Trace，便於除錯
  },

  // 本地開發伺服器自動啟動
  webServer: {
    command: "npm start",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI, // CI 環境下強制重啟，本地開發則複用
    timeout: 120 * 1000,
  },
});
