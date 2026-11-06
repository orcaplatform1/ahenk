const { test, before, after } = require('node:test'); const assert = require('node:assert/strict');
const h = require('../lib/h'); const { api, prisma } = h; let C;
const reg = (phone, o = {}) => ({ email: `${Math.random().toString(36).slice(2)}@e2e.test`, password: 'Test1234!', firstName: 'Ece', lastName: 'Kaya', acceptTerms: true, phoneNumber: phone, occupationSector: 'Teknoloji', gender: 'FEMALE', birthDate: '1995-03-01', primaryCityId: C['İstanbul'], district: 'Kadıköy', ...o });
async function phoneToken(phone) { assert.equal((await api('POST', '/auth/register/send-otp', { body: { phone } })).status, 200); const code = await h.otpFor(phone); const v = await api('POST', '/auth/register/verify-otp', { body: { phone, code } }); assert.equal(v.status, 200); return v.json.phoneToken; }
const wrong = (code) => (code === '000000' ? '000001' : '000000');
before(async () => { await h.resetDomain(); C = await h.cities(); });
after(async () => { await h.prisma.$disconnect(); });

test('2.1 şehir ve ilçe listeleri herkese açık', async () => {
  const c = await api('GET', '/auth/cities'); assert.equal(c.status, 200); assert.ok(c.json.length >= 1); assert.ok(c.json.every((x) => x.id && x.name));
  const d = await api('GET', '/auth/districts'); assert.equal(d.status, 200); assert.ok(d.json['İstanbul']?.includes('Kadıköy'));
});
test('2.1 kayıt: OTP + kayıt, DB kayıtları, onay logları', async () => {
  const phone = h.uniquePhone(); const phoneTokenV = await phoneToken(phone);
  const body = reg(phone, { phoneToken: phoneTokenV }); const r = await api('POST', '/auth/register', { body });
  assert.equal(r.status, 201); assert.ok(r.json.accessToken); assert.equal(r.json.user.passwordHash, undefined);
  const u = await prisma.user.findUnique({ where: { email: body.email }, include: { profile: true, consents: true } });
  assert.equal(u.phone, phone); assert.equal(u.phoneVerified, true); assert.equal(u.profile.district, 'Kadıköy'); assert.equal(u.consents.length, 2); assert.notEqual(u.passwordHash, body.password);
  assert.ok(r.cookies.some((c) => c.startsWith('refresh_token=') && /HttpOnly/i.test(c)));
});
test('2.1 kayıt: telefon anahtarı olmadan reddedilir', async () => { const r = await api('POST', '/auth/register', { body: reg(h.uniquePhone(), { phoneToken: 'sahte' }) }); assert.equal(r.status, 400); });
test('2.1 kayıt: phoneToken tek kullanımlık', async () => {
  const phone = h.uniquePhone(); const t = await phoneToken(phone);
  assert.equal((await api('POST', '/auth/register', { body: reg(phone, { phoneToken: t }) })).status, 201);
  assert.equal((await api('POST', '/auth/register', { body: reg(phone, { phoneToken: t }) })).status, 409);
});
test('2.1 OLUMSUZ yanlış OTP kalan hak sayısını döner', async () => {
  const phone = h.uniquePhone(); await api('POST', '/auth/register/send-otp', { body: { phone } }); const code = await h.otpFor(phone);
  const r = await api('POST', '/auth/register/verify-otp', { body: { phone, code: wrong(code) } }); assert.equal(r.status, 400); assert.match(r.json.message, /Kalan deneme hakkı: 2/);
});
test('2.1 OLUMSUZ 3 yanlış denemede kod iptal olur, doğru kod da çalışmaz', async () => {
  const phone = h.uniquePhone(); await api('POST', '/auth/register/send-otp', { body: { phone } }); const code = await h.otpFor(phone);
  for (let i = 0; i < 3; i++) await api('POST', '/auth/register/verify-otp', { body: { phone, code: wrong(code) } });
  const r = await api('POST', '/auth/register/verify-otp', { body: { phone, code } }); assert.equal(r.status, 400);
});
test('2.1 OLUMSUZ süresi geçmiş OTP (Redis TTL 5 dk doğrulanır + silinince red)', async () => {
  const phone = h.uniquePhone(); await api('POST', '/auth/register/send-otp', { body: { phone } }); const code = await h.otpFor(phone);
  const Redis = h.bk('ioredis'); const R = new Redis(process.env.REDIS_URL); const ttl = await R.ttl(`otp:${phone}`); assert.ok(ttl > 280 && ttl <= 300, 'ttl=' + ttl);
  await R.expire(`otp:${phone}`, 0); await R.quit();
  const r = await api('POST', '/auth/register/verify-otp', { body: { phone, code } }); assert.equal(r.status, 400); assert.match(r.json.message, /süresi doldu/);
});
test('2.1 OLUMSUZ 60 sn dolmadan ikinci kod istenemez', async () => {
  const phone = h.uniquePhone(); await api('POST', '/auth/register/send-otp', { body: { phone } });
  const r = await api('POST', '/auth/register/send-otp', { body: { phone } }); assert.equal(r.status, 400); assert.match(r.json.message, /saniye bekleyin/);
});
test('2.1 OLUMSUZ aynı telefonla ikinci kayıt', async () => { const u = await h.user(); const r = await api('POST', '/auth/register/send-otp', { body: { phone: u.phone } }); assert.equal(r.status, 409); });
test('2.1 OLUMSUZ 18 yaş altı kayıt API tarafında reddedilmeli', async () => {
  const phone = h.uniquePhone(); const t = await phoneToken(phone); const by = new Date().getFullYear() - 16;
  const r = await api('POST', '/auth/register', { body: reg(phone, { phoneToken: t, birthDate: `${by}-01-01` }) }); assert.equal(r.status, 400, 'beklenen 400, gelen ' + r.status);
});
for (const [name, patch] of [['doğum tarihi', { birthDate: undefined }], ['cinsiyet', { gender: undefined }], ['şehir', { primaryCityId: undefined, district: undefined }]])
  test(`2.1 OLUMSUZ eksik alan API tarafında reddedilmeli: ${name}`, async () => { const phone = h.uniquePhone(); const t = await phoneToken(phone); const r = await api('POST', '/auth/register', { body: reg(phone, { phoneToken: t, ...patch }) }); assert.equal(r.status, 400, 'gelen ' + r.status); });
test('2.1 OLUMSUZ geçersiz cinsiyet 500 değil 400 dönmeli', async () => { const phone = h.uniquePhone(); const t = await phoneToken(phone); const r = await api('POST', '/auth/register', { body: reg(phone, { phoneToken: t, gender: 'XYZ' }) }); assert.equal(r.status, 400, 'gelen ' + r.status); });
test('2.1 OLUMSUZ geçersiz doğum tarihi 500 değil 400 dönmeli', async () => { const phone = h.uniquePhone(); const t = await phoneToken(phone); const r = await api('POST', '/auth/register', { body: reg(phone, { phoneToken: t, birthDate: 'abc' }) }); assert.equal(r.status, 400, 'gelen ' + r.status); });
test('2.1 OLUMSUZ ilçesiz kayıt', async () => { const phone = h.uniquePhone(); const t = await phoneToken(phone); const r = await api('POST', '/auth/register', { body: reg(phone, { phoneToken: t, district: undefined }) }); assert.equal(r.status, 400); assert.match(r.json.message, /İlçe/); });
test('2.1 OLUMSUZ pasif şehir ve geçersiz ilçe', async () => {
  const phone = h.uniquePhone(); const t = await phoneToken(phone);
  assert.equal((await api('POST', '/auth/register', { body: reg(phone, { phoneToken: t, primaryCityId: C['Adana'] }) })).status, 400);
  assert.equal((await api('POST', '/auth/register', { body: reg(phone, { phoneToken: t, district: 'Yokİlçe' }) })).status, 400);
});
test('2.1 OLUMSUZ şartlar kabul edilmeden, şifre ve telefon biçimi', async () => {
  const phone = h.uniquePhone(); const t = await phoneToken(phone);
  assert.equal((await api('POST', '/auth/register', { body: reg(phone, { phoneToken: t, acceptTerms: false }) })).status, 400);
  assert.equal((await api('POST', '/auth/register', { body: reg(phone, { phoneToken: t, password: '123' }) })).status, 400);
  assert.equal((await api('POST', '/auth/register/send-otp', { body: { phone: '05551234567' } })).status, 400);
});
test('2.1 OLUMSUZ fazladan alan reddedilir (role yükseltme denemesi)', async () => { const phone = h.uniquePhone(); const t = await phoneToken(phone); const r = await api('POST', '/auth/register', { body: reg(phone, { phoneToken: t, role: 'SUPERADMIN' }) }); assert.equal(r.status, 400); });
test('2.1 giriş, yanlış şifre, olmayan e-posta aynı mesaj', async () => {
  const u = await h.user(); const ok = await h.login(u); assert.equal(ok.status, 200); assert.ok(ok.json.accessToken);
  const a = await api('POST', '/auth/login', { body: { email: u.email, password: 'yanlis12' } }); const b = await api('POST', '/auth/login', { body: { email: 'yok@e2e.test', password: 'yanlis12' } });
  assert.equal(a.status, 401); assert.equal(b.status, 401); assert.equal(a.json.message, b.json.message);
});
test('2.1 /auth/me Bearer ile, hassas alan yok', async () => {
  const u = await h.user({ kyc: 'APPROVED', city: C['İstanbul'] }); const r = await api('GET', '/auth/me', { token: u.token }); assert.equal(r.status, 200);
  assert.equal(r.json.passwordHash, undefined); assert.equal(r.json.isKycVerified, true); assert.equal(r.json.profile.primaryCity.name, 'İstanbul');
  assert.equal((await api('GET', '/auth/me')).status, 401);
});
test('2.1 refresh: rotation, eski token ikinci kullanımda red ve tüm oturumlar iptal', async () => {
  const u = await h.user(); const l = await h.login(u); const rt = l.cookies.find((c) => c.startsWith('refresh_token=')).split(';')[0];
  const r1 = await api('POST', '/auth/refresh', { cookie: rt, headers: { origin: process.env.APP_URL } }); assert.equal(r1.status, 200); const rt2 = r1.cookies.find((c) => c.startsWith('refresh_token=')).split(';')[0]; assert.notEqual(rt, rt2);
  await h.sleep(200); // REFRESH_REUSE_GRACE_MS test ortamında 100 ms
  assert.equal((await api('POST', '/auth/refresh', { cookie: rt, headers: { origin: process.env.APP_URL } })).status, 401);
  assert.equal((await api('POST', '/auth/refresh', { cookie: rt2, headers: { origin: process.env.APP_URL } })).status, 401, 'yeniden kullanım tespitinde zincir iptal edilmeli');
});
test('2.1 logout refresh tokenı iptal eder, çerez silinir', async () => {
  const u = await h.user(); const l = await h.login(u); const rt = l.cookies.find((c) => c.startsWith('refresh_token=')).split(';')[0];
  const o = await api('POST', '/auth/logout', { cookie: rt, headers: { origin: process.env.APP_URL } }); assert.equal(o.status, 200); assert.ok(o.cookies.some((c) => c.startsWith('refresh_token=;')));
  assert.equal((await api('POST', '/auth/refresh', { cookie: rt, headers: { origin: process.env.APP_URL } })).status, 401);
});
test('2.1 logout access tokenı anında geçersiz kılar mı (bilgi)', async () => { const u = await h.user(); const l = await h.login(u); const rt = l.cookies.find((c) => c.startsWith('refresh_token=')).split(';')[0]; await api('POST', '/auth/logout', { cookie: rt, headers: { origin: process.env.APP_URL } }); const m = await api('GET', '/auth/me', { token: l.json.accessToken }); assert.equal(m.status, 401, 'çıkıştan sonra access token hâlâ geçerli'); });
test('2.1 login-otp başarı ve yanlış kod', async () => {
  const u = await h.user(); assert.equal((await api('POST', '/auth/send-login-otp', { body: { phone: u.phone } })).status, 200); const code = await h.otpFor(u.phone);
  assert.equal((await api('POST', '/auth/verify-login-otp', { body: { phone: u.phone, code: wrong(code) } })).status, 400);
  const r = await api('POST', '/auth/verify-login-otp', { body: { phone: u.phone, code } }); assert.equal(r.status, 200); assert.ok(r.json.accessToken);
});
test('2.1 OLUMSUZ kayıtsız numara login-otp hesap varlığını sızdırmamalı', async () => { const r = await api('POST', '/auth/send-login-otp', { body: { phone: h.uniquePhone() } }); assert.equal(r.status, 200, 'gelen ' + r.status + ': hesap varlığı anlaşılıyor'); });
test('2.1 forgot/reset password, eski oturumlar kapanır', async () => {
  const u = await h.user(); const l = await h.login(u); const rt = l.cookies.find((c) => c.startsWith('refresh_token=')).split(';')[0];
  assert.equal((await api('POST', '/auth/forgot-password', { body: { phone: u.phone } })).status, 200); const code = await h.otpFor(u.phone);
  assert.equal((await api('POST', '/auth/reset-password', { body: { phone: u.phone, code, newPassword: 'Yeni1234' } })).status, 200);
  assert.equal((await api('POST', '/auth/login', { body: { email: u.email, password: h.PW } })).status, 401);
  assert.equal((await api('POST', '/auth/login', { body: { email: u.email, password: 'Yeni1234' } })).status, 200);
  assert.equal((await api('POST', '/auth/refresh', { cookie: rt, headers: { origin: process.env.APP_URL } })).status, 401);
});
test('2.1 OLUMSUZ forgot-password kayıtsız numarada varlığı sızdırmamalı', async () => { const r = await api('POST', '/auth/forgot-password', { body: { phone: h.uniquePhone() } }); assert.equal(r.status, 200, 'gelen ' + r.status + ': hesap varlığı anlaşılıyor'); });
test('2.1 OLUMSUZ bot hesabı forgot-password 200 döner, kod gitmez', async () => { const b = await h.user({ bot: true, phone: h.uniquePhone() }); const mk = h.outboxMark(); assert.equal((await api('POST', '/auth/forgot-password', { body: { phone: b.phone } })).status, 200); await h.sleep(200); assert.equal(h.outboxSince(mk).filter((e) => e.channel === 'whatsapp-otp' && e.params.phone === b.phone).length, 0); });
test('2.1 OLUMSUZ JWT send-otp başkasının numarasına doğrulama kodu üretememeli', async () => { const a = await h.user(), b = await h.user(); await prisma.user.update({ where: { id: b.id }, data: { phoneVerified: false } }); const s = await api('POST', '/auth/send-otp', { token: a.token, body: { phone: b.phone } }); assert.notEqual(s.status, 200, 'A kullanıcısı B numarasına kod gönderebildi'); });
test('2.1 OLUMSUZ verify-otp başkasının telefonunu doğrulanmış yapamaz', async () => {
  const a = await h.user(), b = await h.user(); await prisma.user.update({ where: { id: b.id }, data: { phoneVerified: false } });
  const R = new (h.bk('ioredis'))(process.env.REDIS_URL); await R.set(`otp:${b.phone}`, JSON.stringify({ code: '123456', attempts: 0 }), 'EX', 60); await R.quit();
  await api('POST', '/auth/verify-otp', { token: a.token, body: { phone: b.phone, code: '123456' } });
  const fresh = await prisma.user.findUnique({ where: { id: b.id } }); assert.equal(fresh.phoneVerified, false, 'A, B hesabının telefonunu doğrulanmış yaptı');
});
test('2.1 yaptırım: askı ve ban girişte 403 ve neden, kalkınca otomatik ACTIVE', async () => {
  const u = await h.user({ status: 'SUSPENDED' }); const s = await prisma.userSanction.create({ data: { userId: u.id, type: 'SUSPENSION', reason: 'Test', expiresAt: new Date(Date.now() + 864e5) } });
  const r = await h.login(u); assert.equal(r.status, 403); assert.equal(r.json.type, 'SUSPENSION'); assert.equal(r.json.reason, 'Test');
  await prisma.userSanction.update({ where: { id: s.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await h.login(u)).status, 200); assert.equal((await prisma.user.findUnique({ where: { id: u.id } })).status, 'ACTIVE');
});
test('2.1 yaptırımlı kullanıcının mevcut tokenı reddedilir', async () => { const u = await h.user(); await prisma.user.update({ where: { id: u.id }, data: { status: 'BANNED' } }); assert.equal((await api('GET', '/auth/me', { token: u.token })).status, 401); });
test('2.1 silinmiş hesap giremez', async () => { const u = await h.user({ status: 'DELETED' }); assert.equal((await h.login(u)).status, 403); });
test('2.1 CSRF: çerezli ve yabancı Origin POST 403', async () => { const u = await h.user(); const l = await h.login(u); const ck = l.cookies.find((c) => c.startsWith('refresh_token=')).split(';')[0]; const r = await api('POST', '/auth/refresh', { cookie: ck, headers: { origin: 'https://evil.example' } }); assert.equal(r.status, 403); });
test('2.1 CORS: izinli ve yabancı Origin', async () => {
  const ok = await api('GET', '/auth/cities', { headers: { origin: process.env.APP_URL } }); assert.equal(ok.headers.get('access-control-allow-origin'), process.env.APP_URL);
  const bad = await api('GET', '/auth/cities', { headers: { origin: 'https://evil.example' } }); assert.equal(bad.status, 403);
});
test('2.1 tarayıcı girişinde (Origin var) token gövdeye yazılmaz', async () => { const u = await h.user(); const r = await api('POST', '/auth/login', { body: { email: u.email, password: h.PW }, headers: { origin: process.env.APP_URL } }); assert.equal(r.status, 200); assert.equal(r.json.accessToken, undefined); assert.ok(r.cookies.some((c) => /Secure/i.test(c))); });
test('2.1 rate limit: login dakikada 10 sonrası 429', async () => { const ip = '10.250.0.1'; let last; const codes = []; for (let i = 0; i < 12; i++) { last = await api('POST', '/auth/login', { ip, body: { email: 'yok@e2e.test', password: 'yanlis12' } }); codes.push(last.status); } assert.equal(last.status, 429, codes.join(',')); });
test('2.1 rate limit: send-otp dakikada 5 sonrası 429', async () => { const ip = '10.250.0.2'; let last; for (let i = 0; i < 7; i++) last = await api('POST', '/auth/register/send-otp', { ip, body: { phone: h.uniquePhone() } }); assert.equal(last.status, 429); });
