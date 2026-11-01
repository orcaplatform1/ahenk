const { test, expect } = require('@playwright/test'); const { seed, guard, visit } = require('./lib');
const P = ['/mekan/panel', '/mekan/panel/masalar', '/mekan/panel/kontenjan', '/mekan/panel/bilgiler', '/mekan/panel/abonelik', '/mekan/panel/hesap'];
async function vlogin(page) { const s = seed(); await page.goto('/mekan/giris'); await page.locator('input[type=email], input[name=email]').first().fill('venue@e2e.test'); await page.locator('input[type=password]').first().fill(s.PW); await page.locator('button[type=submit]').first().click(); await page.waitForURL(/mekan\/panel/, { timeout: 8000 }); }
test('3.8 mekân girişi arayüzden', async ({ page }) => { await guard(page); await vlogin(page); });
for (const p of P) test(`3.8 ${p}`, async ({ page }) => { const errs = await guard(page); await vlogin(page); const ly = await visit(page, p, 'mekan' + p); expect([...errs, ...ly.mobil, ...ly.masaustu]).toEqual([]); });
test('3.8 oturumsuz panel girişe döner', async ({ page }) => { await guard(page); await page.goto('/mekan/panel'); await page.waitForTimeout(1500); expect(page.url()).toMatch(/mekan\/giris/); });
