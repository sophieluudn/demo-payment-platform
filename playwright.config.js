const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests', testMatch: '**/*.spec.js',
  use: { baseURL: 'http://127.0.0.1:4173', headless: true },
  webServer: { command: 'node server.js', url: 'http://127.0.0.1:4173', reuseExistingServer: true }, reporter: 'list'
});
