const { test, expect } = require('@playwright/test');
const { seed } = require('../system-model');
const STORAGE = 'payment-system-management-v2';
async function useAccount(page, id, store = 'edu') {
  await page.goto('/users.html');
  await page.evaluate(({ id, store, key }) => {
    const saved = JSON.parse(localStorage.getItem(key));
    saved.currentUserId = id; saved.store = store;
    localStorage.setItem(key, JSON.stringify(saved));
  }, { id, store, key: STORAGE });
  await page.reload();
}
test('system pages and editors have no demonstration text or account/reset controls', async ({ page }) => {
  const errors = []; page.on('pageerror', err => errors.push(err.message));
  for (const route of ['users', 'roles', 'projects', 'stores', 'payments']) {
    await page.goto(`/${route}.html`);
    await expect(page.locator('body')).not.toContainText(/demo|示意|模擬|展示|待確認/i);
    await expect(page.locator('#sys-identity,[data-action=reset],.sys-intro')).toHaveCount(0);
    await expect(page.locator('header .version')).toHaveText('v1.4.2');
  }
  await page.goto('/roles.html');
  await page.getByRole('button', { name: '新增', exact: true }).click();
  await expect(page.locator('body')).not.toContainText(/demo|示意|模擬|展示/i);
  await expect(page.locator('[data-group=fees]')).toHaveCount(0);
  await expect(page.locator('[name="fees:edit"]')).toHaveCount(0);
  await page.goto('/users.html');
  await page.getByRole('button', { name: '新增', exact: true }).click();
  await expect(page.locator('body')).not.toContainText(/demo|示意|模擬|展示/i);
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.locator('body')).not.toContainText(/demo|示意|模擬|展示/i);
  await page.goto('/payments.html');
  await page.locator('[data-action=fee-edit][data-key=credit-card]').click();
  await expect(page.locator('body')).not.toContainText(/demo|示意|模擬|展示/i);
  expect(errors).toEqual([]);
});
test('ordinary manager cannot open payment settings or submit fees even with legacy fee permissions', async ({ page }) => {
  await useAccount(page, 'big');
  await expect(page.locator('aside a[href="payments.html"]')).toBeHidden();
  await page.goto('/payments.html');
  await expect(page.locator('#sys-content')).toContainText('無存取權限');
  await expect(page.locator('.payment-table')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '編輯費率' })).toHaveCount(0);
  const state = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE);
  state.data.roles.find(r => r.id === 'large').permissions.fees = ['view', 'edit'];
  await page.evaluate(({ state, key }) => localStorage.setItem(key, JSON.stringify(state)), { state, key: STORAGE });
  await page.reload();
  await expect(page.locator('#sys-content')).toContainText('無存取權限');
  await page.evaluate(() => {
    const form = document.createElement('form'); form.id = 'sys-fee-form'; form.dataset.key = 'credit-card';
    form.innerHTML = '<input name="rate" value="99"><p class="sys-error"></p>';
    document.querySelector('main').append(form); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await expect(page.locator('.sys-error')).toContainText('僅系統管理員');
  const fee = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).data.fees['credit-card'], STORAGE);
  expect(fee).toBe('2');
});
test('one platform fee change is shared across stores/projects and survives reload', async ({ page }) => {
  await page.goto('/payments.html');
  await expect(page.locator('#sys-store,#sys-fee-level,#sys-fee-project')).toHaveCount(0);
  await expect(page.locator('.sys-payment-scope')).toHaveCount(0);
  await page.locator('[data-action=fee-edit][data-key=credit-card]').click();
  await page.locator('[name=rate]').fill('3.5');
  await page.getByRole('button', { name: '確定', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: '國內信用卡一次付清' })).toContainText('3.5');
  await page.locator('[data-action=fee-edit][data-key=atm]').click();
  await expect(page.locator('[name=unit]')).toHaveValue('元');
  await page.locator('[name=rate]').fill('7');
  await page.getByRole('button', { name: '確定', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('row').filter({ hasText: '國內信用卡一次付清' })).toContainText('3.5');
  await expect(page.getByRole('row').filter({ hasText: 'ATM轉帳' })).toContainText('7');
  await page.goto('/stores.html');
  await expect(page.getByRole('row').filter({ hasText: '教育事業部' })).toContainText('3.5%');
  await expect(page.getByRole('row').filter({ hasText: 'U 好學' })).toContainText('3.5%');
  await expect(page.getByRole('row').filter({ hasText: 'U 好學' })).toContainText('7元');
  await page.goto('/projects.html');
  for (const id of ['A', 'B', 'C']) {
    await page.locator('#sys-store').selectOption(id === 'C' ? 'u' : 'edu');
    await page.locator(`[data-action=project-detail][data-id=${id}]`).click();
    await expect(page.locator('#sys-content')).toContainText('3.5%');
    await page.getByRole('button', { name: '返回列表' }).click();
  }
});
test('role matrix and per-project new/existing user grants still work without simulation tools', async ({ page }) => {
  await page.goto('/roles.html');
  await page.getByRole('button', { name: '新增', exact: true }).click();
  await page.locator('[name=name]').fill('只編輯角色');
  await page.getByLabel('使用者管理整組勾選', { exact: true }).check();
  await page.getByLabel('使用者管理新增', { exact: true }).uncheck();
  await expect(page.locator('[data-group=users]')).toHaveJSProperty('indeterminate', true);
  await page.getByRole('button', { name: '儲存設定', exact: true }).click();
  await expect(page.locator('#sys-content')).toContainText('只編輯角色');
  await page.goto('/users.html');
  await page.getByRole('button', { name: '新增', exact: true }).click();
  await page.locator('[name=name]').fill('測試人員');
  await page.locator('[name=login]').fill('new-account@gmail.com');
  await page.getByRole('dialog', { name: '新增使用者' }).getByRole('combobox', { name: '商店', exact: true }).selectOption('edu');
  await page.getByRole('combobox', { name: '專案', exact: true }).selectOption('A');
  await page.getByRole('combobox', { name: '角色', exact: true }).selectOption('viewer');
  await page.getByRole('button', { name: '加入授權', exact: true }).click();
  await page.getByRole('combobox', { name: '專案', exact: true }).selectOption('B');
  await page.getByRole('combobox', { name: '角色', exact: true }).selectOption('refund');
  await page.getByRole('button', { name: '加入授權', exact: true }).click();
  await page.getByRole('button', { name: '確定', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'new-account@gmail.com' })).toContainText('交易退款角色');
  await expect(page.getByRole('row').filter({ hasText: 'david-b' })).toContainText('實體活動專案 B');
});
test('existing browser data migrates while keeping created roles, accounts and rates', async ({ page }) => {
  await page.goto('/users.html');
  const old = seed();
  old.users[0].login = 'demo-admin';
  old.users.find(u => u.id === 'cross').name = '跨商店展示帳號';
  old.roles.find(r => r.id === 'large').permissions.fees = ['view', 'edit'];
  old.roles.push({ id: 'custom', name: '已建立角色', store: '', permissions: { users: ['view', 'edit'] } });
  old.users.push({ id: 'created', name: '已建立使用者', login: 'created', grants: { A: 'custom' } });
  delete old.paymentTools;
  old.fees = { system: '3.9', 'store:edu': '8.8', 'project:A': '9.9' };
  await page.evaluate(old => {
    localStorage.removeItem('payment-system-management-v2');
    localStorage.setItem('payment-system-demo-v1', JSON.stringify({ data: old, identity: 'big', store: 'edu' }));
  }, old);
  await page.reload();
  await expect(page.locator('#sys-content')).toContainText('已建立使用者');
  await expect(page.locator('body')).not.toContainText('展示');
  await page.goto('/payments.html');
  await expect(page.getByRole('row').filter({ hasText: '國內信用卡一次付清' })).toContainText('3.9');
});
test('updated desktop and mobile views retain the original shell', async ({ page }) => {
  for (const route of ['users', 'roles', 'payments']) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/${route}.html`);
    await page.screenshot({ path: `test-results/${route}-desktop.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `test-results/${route}-mobile.png`, fullPage: true });
  }
  await page.goto('/index.html');
  await expect(page.locator('.welcome')).toContainText('歡迎進入');
  await expect(page.locator('#sys-store')).toHaveCount(0);
});

test('payment links edit in a modal and new tools persist with cancel and Escape support', async ({ page }) => {
  await page.goto('/payments.html');
  const link = page.locator('a[data-action=fee-edit][data-key=apple-pay]');
  await link.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[name=code]')).toHaveValue('APPLEPAY');
  await dialog.locator('[name=name]').fill('Apple Pay 更新');
  await dialog.locator('[name=note]').fill('撥款日為D+2');
  await dialog.getByRole('button', { name: '確定', exact: true }).click();
  await expect(page.locator('.payment-table')).toContainText('Apple Pay 更新');
  await page.getByRole('button', { name: '新增', exact: true }).click();
  await expect(dialog.getByRole('heading')).toHaveText('新增支付工具');
  await dialog.locator('[name=platform]').fill('測試金流');
  await dialog.locator('[name=name]').fill('新支付工具');
  await dialog.locator('[name=code]').fill('NEWPAY');
  await dialog.locator('[name=rate]').fill('1.25');
  await dialog.getByRole('button', { name: '確定', exact: true }).click();
  await page.reload();
  await expect(page.locator('.payment-table')).toContainText('新支付工具');
  await page.getByRole('button', { name: '新增', exact: true }).click();
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await link.click();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(link).toBeFocused();
});
