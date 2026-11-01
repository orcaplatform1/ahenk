const { test, expect } = require('@playwright/test'); const { seed, guard, login, ART } = require('./lib');
const h = require('../lib/h'); const { prisma } = h;
const shot = (page, n) => page.screenshot({ path: `${ART}/screenshots/r38_${n}.png`, fullPage: false });
async function offer(o = {}) { const u = await h.user({ kyc: 'APPROVED', ...o }); await prisma.winbackOffer.create({ data: { userId: u.id } }); return u; }
test('3.9 indirim ekranı: başlık, sayaç, halka, paket, buton, rozet, Paketim', async ({ page, context }) => {
  const errs = await guard(page); await page.addInitScript(() => localStorage.setItem('cookie-consent', 'essential')); const u = await offer(); await login(context, page, u.email, h.PW);
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/dashboard');
  await expect(page.getByText('SANA ÖZEL İNDİRİM')).toBeVisible({ timeout: 15000 }); await expect(page.getByRole('heading', { name: 'Uyumlu bir masa?' })).toBeVisible();
  await expect(page.getByText('TEKLİFİN BİTMESİNE')).toBeVisible(); await expect(page.locator('.wb-clock')).toHaveText(/^00:59:\d\d|^01:00:00/); await expect(page.getByText('Halkalara dokun, indirimini ortaya çıkar.')).toBeVisible();
  await expect(page.getByText('PAKETİNİ SEÇ')).toHaveCount(0); await expect(page.getByRole('button', { name: 'İndirimi Uygula' })).toHaveCount(0); await shot(page, 'ekran1');
  await page.locator('.wb-rings').click(); await expect(page.getByText('İndirimin tanımlandı, şimdi eşleşme zamanı.')).toBeVisible(); await expect(page.locator('.wb-amt b')).toHaveText('100₺'); await page.waitForTimeout(1300); await shot(page, 'ekran2');
  await expect(page.getByText('Önce paketini seç')).toBeVisible(); await expect(page.getByRole('button', { name: 'İndirimi Uygula' })).toBeDisabled();
  await expect(page.locator('.wb-card')).toHaveCount(2); await page.locator('.wb-card').first().click(); await expect(page.getByText('Önce paketini seç')).toHaveCount(0); await expect(page.getByRole('button', { name: 'İndirimi Uygula' })).toBeEnabled(); await shot(page, 'ekran3');
  await page.getByLabel('Kapat').click(); const badge = page.getByRole('button', { name: /100₺ indirimin · \d\d:\d\d/ }); await expect(badge).toBeVisible(); await badge.click(); await expect(page.getByText('SANA ÖZEL İNDİRİM')).toBeVisible(); await page.getByLabel('Kapat').click();
  const exp = (await prisma.winbackOffer.findUnique({ where: { userId: u.id } })).expiresAt; await page.reload(); await expect(page.getByRole('button', { name: /100₺ indirimin/ })).toBeVisible({ timeout: 15000 }); await expect(page.getByText('SANA ÖZEL İNDİRİM')).toHaveCount(0); assert_eq((await prisma.winbackOffer.findUnique({ where: { userId: u.id } })).expiresAt.getTime(), exp.getTime());
  await page.goto('/profil?tab=paket'); await expect(page.getByText(/İndirim bitimine \d\d:\d\d/).first()).toBeVisible({ timeout: 15000 });
  expect(errs).toEqual([]);
});
const assert_eq = (a, b) => { if (a !== b) throw new Error(`${a} != ${b}`); };
test('3.9 KYC onaysız: etiket, buton KYC sayfasına, sayaç başlamaz; paketi bitmiş başlık', async ({ page, context }) => {
  await guard(page); await page.addInitScript(() => localStorage.setItem('cookie-consent', 'essential')); const u = await h.user({ kyc: 'PENDING', plan: 'MASADA', sub: { status: 'EXPIRED' } }); await prisma.winbackOffer.create({ data: { userId: u.id } }); await login(context, page, u.email, h.PW);
  await page.goto('/dashboard'); await expect(page.getByRole('heading', { name: 'Birkaç masa daha?' })).toBeVisible({ timeout: 15000 }); await expect(page.locator('.wb-clock')).toHaveText('01:00:00'); await page.waitForTimeout(1500); await expect(page.locator('.wb-clock')).toHaveText('01:00:00');
  await page.locator('.wb-rings').click(); await expect(page.getByText('Kimlik doğrulamanız onaylanana kadar indiriminizi koruyoruz.')).toBeVisible(); await page.locator('.wb-card').first().click(); await page.getByRole('button', { name: 'İndirimi Uygula' }).click(); await expect(page).toHaveURL(/tab=kyc/);
  assert_eq((await prisma.winbackOffer.findUnique({ where: { userId: u.id } })).expiresAt, null);
});
test('3.9 Profilim: tüm cihazlardan çıkış ve hesap silme modalı', async ({ page, context }) => {
  await guard(page); await page.addInitScript(() => localStorage.setItem('cookie-consent', 'essential')); const u = await h.user({ kyc: 'APPROVED' }); await login(context, page, u.email, h.PW);
  await page.goto('/profil'); const del = page.getByRole('button', { name: 'Hesabımı Sil' }); await expect(del).toBeVisible({ timeout: 15000 }); await del.click();
  await expect(page.getByText(/Hesabını silmek üzeresin\. Bu işlem geri alınamaz\./)).toBeVisible(); await expect(page.getByRole('button', { name: 'Vazgeç' })).toBeVisible(); await shot(page, 'silme'); await page.getByRole('button', { name: 'Onaylıyorum' }).click();
  await expect(page.getByText(/Hesap silme talebin alındı/)).toBeVisible(); assert_eq(await prisma.accountDeletionRequest.count({ where: { userId: u.id, status: 'PENDING' } }), 1);
  await page.getByRole('button', { name: 'Tüm cihazlardan çıkış yap' }).click(); await expect(page).toHaveURL(/giris/, { timeout: 15000 });
});
test('3.9 hesap silme: aktif masası olanda uyarı', async ({ page, context }) => {
  await guard(page); await page.addInitScript(() => localStorage.setItem('cookie-consent', 'essential')); const u = await h.user({ kyc: 'APPROVED' }); await h.meeting({ users: [u] }); await login(context, page, u.email, h.PW);
  await page.goto('/profil'); await page.getByRole('button', { name: 'Hesabımı Sil' }).click(); await page.getByRole('button', { name: 'Onaylıyorum' }).click(); await expect(page.getByText(/Buluşma bitene kadar/)).toBeVisible();
});
test('3.9 admin: fiyat sayfası indirim ayarı, Silme Talepleri sekmesi, sonuçlandırma sayfası', async ({ page, context }) => {
  const errs = await guard(page); await page.addInitScript(() => localStorage.setItem('cookie-consent', 'essential')); const s = seed(); await login(context, page, s.sup, h.PW);
  const t = await h.user({ firstName: 'Silme', lastName: 'Talebi' }); await prisma.accountDeletionRequest.create({ data: { userId: t.id } });
  const d = await prisma.payment.create({ data: { userId: t.id, plan: 'MASADA', amountKurus: 12300, status: 'DUPLICATE', platform: 'WEB' } });
  await page.goto('/admin/fiyatlar'); await expect(page.getByText('Geri Kazanım İndirimi')).toBeVisible({ timeout: 15000 }); await expect(page.getByRole('checkbox', { name: 'İçerde' })).toBeChecked(); await expect(page.getByRole('checkbox', { name: 'Masada' })).not.toBeChecked();
  await page.goto('/admin/users'); await page.getByRole('button', { name: 'Silme Talepleri' }).click(); await expect(page.getByText('Silme Talebi')).toBeVisible(); await expect(page.getByRole('button', { name: 'Onayla' }).first()).toBeVisible();
  await page.goto('/admin/sonuclandirma'); await expect(page.getByText('İade Bekleyen Fazla Ödemeler')).toBeVisible({ timeout: 15000 }); await expect(page.getByText('Silme Talebi')).toBeVisible(); await page.getByRole('button', { name: 'İade Edildi' }).click(); await expect(page.getByText('Silme Talebi')).toHaveCount(0); assert_eq((await prisma.payment.findUnique({ where: { id: d.id } })).status, 'REFUNDED');
  expect(errs).toEqual([]);
});
