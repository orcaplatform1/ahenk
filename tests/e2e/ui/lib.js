const fs = require('fs'); const ART = process.env.AHENK_TEST_ARTIFACTS || '/root/ahenk-test-artifacts'; const SHOT = ART + '/screenshots'; fs.mkdirSync(SHOT, { recursive: true });
const seed = () => JSON.parse(fs.readFileSync(ART + '/ui-seed.json', 'utf8'));
const VP = { mobil: { width: 390, height: 844 }, masaustu: { width: 1440, height: 900 } };
const rip = () => `10.77.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const log = (o) => fs.appendFileSync(ART + '/ui-findings.jsonl', JSON.stringify(o) + '\n');
// Dış istekler kesilir: test dışarı çıkmaz (Nominatim, Google, Meta). Gidenler kaydedilir.
async function guard(page, externals = []) {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': rip() });
  const errs = []; page.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|ERR_BLOCKED|net::|Failed to fetch RSC payload|localhost:3104|kyc\/admin\/file|status of 404/.test(m.text())) errs.push('console: ' + m.text().slice(0, 200)); });
  page.on('response', (r) => { const u = r.url(); if (r.status() >= 400 && u.includes('127.0.0.1') && !u.includes('/auth/me') && !u.includes('/auth/refresh') && !u.includes('/kyc/admin/file')) errs.push(`http ${r.status()} ${u.replace(/^https?:\/\/[^/]+/, '')}`); });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => { externals.push(route.request().url()); route.abort(); });
  return errs;
}
async function layout(page) { return page.evaluate(() => { const o = []; const dw = document.documentElement.scrollWidth - window.innerWidth; if (dw > 1) o.push('yatay taşma ' + dw + 'px'); for (const el of document.querySelectorAll('h1,h2,h3,button,a,label')) { const s = getComputedStyle(el); if (!el.offsetWidth || s.visibility === 'hidden') continue; if (el.scrollWidth > el.clientWidth + 2 && ['hidden', 'clip'].includes(s.overflowX) && s.textOverflow !== 'ellipsis') o.push('kesilen: ' + (el.textContent || '').trim().slice(0, 40)); const r = el.getBoundingClientRect(); if (r.width > 0 && r.right > window.innerWidth + 2 && s.position !== 'fixed') { let a = el, c = false; while ((a = a.parentElement)) { const st = getComputedStyle(a); if (['auto', 'scroll', 'hidden'].includes(st.overflowX)) { c = true; break; } } if (!c) o.push('ekran dışı: ' + (el.textContent || '').trim().slice(0, 40)); } } return [...new Set(o)].slice(0, 8); }); }
const slug = (s) => s.replace(/^\//, '').replace(/[^a-zA-Z0-9]+/g, '_') || 'anasayfa';
async function visit(page, path, name) { const res = {}; for (const [vp, size] of Object.entries(VP)) { await page.setViewportSize(size); await page.goto(path, { waitUntil: 'load' }); await page.waitForTimeout(900); await page.waitForLoadState('load'); await page.screenshot({ path: `${SHOT}/${slug(name || path)}_${vp}.png`, fullPage: true }); res[vp] = await layout(page).catch(() => []); } return res; }
async function login(context, page, email, pw) { const r = await context.request.post('http://127.0.0.1:4100/api/v1/auth/login', { data: { email, password: pw }, headers: { origin: 'http://127.0.0.1:3104', 'x-forwarded-for': rip() } }); if (!r.ok()) throw new Error('login ' + r.status() + ' ' + email); }
module.exports = { seed, VP, log, guard, layout, visit, login, SHOT, ART };
