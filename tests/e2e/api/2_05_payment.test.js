const { test, before, after, beforeEach } = require('node:test'); const assert = require('node:assert/strict');
const h = require('../lib/h'); const { api, prisma } = h;
const { encryptIdentityNumber } = require(h.BACK + '/dist/src/kyc/identity-number');
const { computePrices } = require(h.BACK + '/dist/src/payment/pricing');
let sup, admin;
async function buyer(o = {}) { const u = await h.user({ kyc: 'APPROVED', ...o }); await prisma.userIdentity.create({ data: { userId: u.id, identityNumberEnc: encryptIdentityNumber('10000000146', process.env.IDENTITY_ENC_KEY) } }); return u; }
const init = (u, plan = 'MASADA', extra = {}) => api('POST', '/payment/init', { token: u.token, body: { plan, platform: 'WEB', ...extra } });
const cb = (token) => api('POST', `/payment/callback?token=${encodeURIComponent(token)}`);
async function pay(u, plan, extra) { const r = await init(u, plan, extra); assert.equal(r.status, 201, r.text); const c = await cb(r.json.token); assert.equal(c.status, 303); assert.match(c.headers.get('location'), /basarili/); return r; }
async function paidSub(plan, patch) { const u = await buyer(); await pay(u, plan); const s = await prisma.subscription.findFirst({ where: { userId: u.id } }); if (patch) await prisma.subscription.update({ where: { id: s.id }, data: patch }); return { u, s }; }
before(async () => { await h.resetDomain(); sup = await h.user({ role: 'SUPERADMIN' }); admin = await h.user({ role: 'ADMIN' }); });
beforeEach(() => h.control({}));
after(() => { h.control({}); return h.prisma.$disconnect(); });
test('2.5 /payment/plans herkese açık, 4 paket, fiyat ve haklar', async () => {
  const r = await api('GET', '/payment/plans'); assert.equal(r.status, 200); assert.deepEqual(r.json.map((p) => p.plan).sort(), ['ICERDE', 'KANKAMLA', 'KARSIMDA', 'MASADA']);
  const m = Object.fromEntries(r.json.map((p) => [p.plan, p])); assert.equal(m.MASADA.groupRights, 2); assert.equal(m.KARSIMDA.oneOnOneRights, 1); assert.equal(m.ICERDE.groupRights, 2); assert.equal(m.ICERDE.oneOnOneRights, 1); assert.equal(m.KANKAMLA.kankaRights, 2); assert.equal(m.ICERDE.label, 'Tercih Edilen');
});
test('2.5 fiyat formülü: DB kayıtları web ×1,20, mobil ×1,20÷0,85, indirim ×0,90 (tam TL)', async () => {
  for (const row of await prisma.planPrice.findMany({ distinct: ['plan'], orderBy: { createdAt: 'desc' } })) { const c = computePrices(row.netKurus); for (const k of ['webKurus', 'mobileKurus', 'webDiscountKurus', 'mobileDiscountKurus']) assert.equal(row[k], c[k], `${row.plan}.${k}`); for (const k of ['webKurus', 'mobileKurus', 'webDiscountKurus', 'mobileDiscountKurus']) assert.equal(row[k] % 100, 0); }
  const c = computePrices(10000); assert.deepEqual([c.webKurus, c.mobileKurus, c.webDiscountKurus, c.mobileDiscountKurus], [12000, 14100, 10800, 12700]);
});
test('2.5 admin fiyat değişikliği yeni kayıt, geçmiş, ADMIN 403, sonraki satın almaya yansır', async () => {
  const g = await api('GET', '/admin/prices', { token: sup.token }); assert.equal(g.status, 200); const net = g.json.current.find((c) => c.plan === 'KARSIMDA').netKurus;
  assert.equal((await api('GET', '/admin/prices', { token: admin.token })).status, 403); assert.equal((await api('PATCH', '/admin/prices', { token: admin.token, body: { prices: [] } })).status, 403);
  const body = { prices: [{ plan: 'KARSIMDA', netKurus: net + 10000 }] }; const r = await api('PATCH', '/admin/prices', { token: sup.token, body }); assert.equal(r.status, 200, r.text);
  const u = await buyer(); const i = await init(u, 'KARSIMDA'); assert.equal(i.json.plan.amountKurus, computePrices(net + 10000).webKurus);
  await api('PATCH', '/admin/prices', { token: sup.token, body: { prices: [{ plan: 'KARSIMDA', netKurus: net }] } });
});
for (const [plan, chk] of [['MASADA', (s) => s.groupRights === 2], ['KARSIMDA', (s) => s.groupRights === 0 && !s.usedAt], ['ICERDE', (s) => s.groupRights === 2], ]) {
  test(`2.5 ödeme başarılı: ${plan}`, async () => {
    const u = await buyer({ gender: 'MALE' }); const m = h.outboxMark(); const r = await init(u, plan); assert.equal(r.status, 201, r.text); assert.ok(r.json.checkoutFormContent);
    const price = await prisma.planPrice.findFirst({ where: { plan }, orderBy: { createdAt: 'desc' } }); assert.equal(r.json.plan.amountKurus, price.webKurus); assert.ok(h.outboxSince(m).some((e) => e.channel === 'iyzico' && e.template === 'init'));
    assert.equal((await prisma.payment.findFirst({ where: { userId: u.id } })).status, 'PENDING');
    const c = await cb(r.json.token); assert.match(c.headers.get('location'), /\/odeme\/basarili$/); const p = await prisma.payment.findFirst({ where: { userId: u.id }, include: { subscription: true } }); assert.equal(p.status, 'SUCCESS'); assert.ok(p.paidAt); assert.ok(chk(p.subscription));
    const s = await api('GET', '/payment/subscriptions', { token: u.token }); assert.equal(s.json.subscriptions.length, 1); assert.equal(s.json.subscriptions[0].paid, true); assert.equal(s.json.packageCycles, 4);
    assert.equal((await api('GET', '/auth/me', { token: u.token })).json.activePlan, plan);
  });
}
test('2.5 ödeme başarılı: KANKAMLA ve kanka zorunlu', async () => {
  const a = await buyer({ gender: 'MALE' }), b = await buyer({ gender: 'MALE' }); assert.equal((await init(a, 'KANKAMLA')).status, 400);
  await prisma.kankaLink.create({ data: { userAId: a.id, userBId: b.id } }); const r = await pay(a, 'KANKAMLA'); assert.ok(r.json.token); const s = await prisma.subscription.findFirst({ where: { userId: a.id } }); assert.equal(s.kankaRights, 2);
  assert.equal((await init(b, 'KANKAMLA')).status, 409);
  const me = await api('GET', '/auth/me', { token: b.token }); assert.equal(me.json.kankamla.role, 'KANKA');
});
test('2.5 sahte callback başarısız: FAILED, abonelik yok, başarısız sayfası', async () => { const u = await buyer(); const r = await init(u); h.control({ iyzicoRetrieve: 'failure' }); const c = await cb(r.json.token); assert.match(c.headers.get('location'), /\/odeme\/basarisiz$/); const p = await prisma.payment.findFirst({ where: { userId: u.id } }); assert.equal(p.status, 'FAILED'); assert.ok(p.failureReason); assert.equal(await prisma.subscription.count({ where: { userId: u.id } }), 0); });
test('2.5 init başarısız 400, FAILED', async () => { h.control({ iyzicoInit: 'failure' }); const u = await buyer(); const r = await init(u); assert.equal(r.status, 400); assert.equal((await prisma.payment.findFirst({ where: { userId: u.id } })).status, 'FAILED'); });
test('2.5 OLUMSUZ tekrar callback ikinci abonelik açmaz (idempotent)', async () => { const u = await buyer(); const r = await pay(u, 'MASADA'); await cb(r.json.token); await cb(r.json.token); assert.equal(await prisma.subscription.count({ where: { userId: u.id } }), 1); });
test('2.5 OLUMSUZ eşzamanlı callback tek abonelik', async () => { const u = await buyer(); const r = await init(u); await Promise.all([cb(r.json.token), cb(r.json.token), cb(r.json.token)]); assert.equal(await prisma.subscription.count({ where: { userId: u.id } }), 1); });
test('2.5 OLUMSUZ bilinmeyen token başarısız sayfasına', async () => { const c = await cb('fake_bilinmeyen'); assert.match(c.headers.get('location'), /basarisiz/); const c2 = await api('POST', '/payment/callback'); assert.match(c2.headers.get('location'), /basarisiz/); });
test('2.5 OLUMSUZ iyzico tutar/sepet uyuşmazlığı reddedilir', async () => { const u = await buyer(); const r = await init(u); const d = JSON.parse(Buffer.from(r.json.token.slice(5), 'base64url')); const bad = 'fake_' + Buffer.from(JSON.stringify({ ...d, price: '1.00' })).toString('base64url'); await prisma.payment.updateMany({ where: { userId: u.id }, data: { iyzicoToken: bad } }); await cb(bad); assert.equal((await prisma.payment.findFirst({ where: { userId: u.id } })).status, 'REFUNDED'); assert.equal(await prisma.subscription.count({ where: { userId: u.id } }), 0); });
test('2.5 iki sekme: ilk ödeme tamamlanırsa para alınmış ödeme kaybolmamalı', async () => { const u = await buyer(); const a = await init(u); await init(u); const c = await cb(a.json.token); assert.match(c.headers.get('location'), /basarili/, 'ilk sekmede para çekildi ama PENDING kaydı silindiği için abonelik yok'); });
test('2.5 OLUMSUZ guard: test yok, KYC yok, oturum yok', async () => {
  const noTest = await buyer({ ocean: false }); assert.equal((await init(noTest)).status, 403); const noKyc = await h.user(); assert.equal((await init(noKyc)).status, 403); const pend = await h.user({ kyc: 'PENDING' }); assert.equal((await init(pend)).status, 403); assert.equal((await api('POST', '/payment/init', { body: { plan: 'MASADA', platform: 'WEB' } })).status, 401);
});
test('2.5 OLUMSUZ TC kaydı yoksa ödeme başlamaz', async () => { const u = await h.user({ kyc: 'APPROVED' }); assert.equal((await init(u)).status, 400); });
test('2.5 OLUMSUZ geçersiz plan ve platform', async () => { const u = await buyer(); assert.equal((await init(u, 'XX')).status, 400); assert.equal((await init(u, 'MASADA', { platform: 'X' })).status, 400); });
test('2.5 iOS stub döner', async () => { const u = await buyer(); const r = await init(u, 'MASADA', { platform: 'IOS' }); assert.equal(r.json.stub, true); assert.equal(await prisma.payment.count({ where: { userId: u.id } }), 0); });
test('2.5 ANDROID platformu mobil fiyatı kullanmalı', async () => { const u = await buyer(); const r = await init(u, 'MASADA', { platform: 'ANDROID' }); const p = await prisma.planPrice.findFirst({ where: { plan: 'MASADA' }, orderBy: { createdAt: 'desc' } }); assert.equal(r.json.plan.amountKurus, p.mobileKurus, 'ANDROID web fiyatıyla başladı'); });
test('2.5 satın alma kuralları: aktif Masada varken Masada/İçerde alınamaz, Karşımda alınır', async () => {
  const { u } = await paidSub('MASADA'); assert.equal((await init(u, 'MASADA')).status, 409); assert.equal((await init(u, 'ICERDE')).status, 409); assert.equal((await init(u, 'KARSIMDA')).status, 201);
  const { u: v } = await paidSub('ICERDE'); for (const p of ['MASADA', 'KARSIMDA', 'ICERDE']) assert.equal((await init(v, p)).status, 409, p);
});
test('2.5 hak bitince aynı paket yeniden alınır', async () => { const { u } = await paidSub('MASADA', { groupRights: 0 }); assert.equal((await init(u, 'MASADA')).status, 201); });
test('2.5 döngü: 4 döngü dolunca paket EXPIRED, Masada 2 hak 1 düşer', async () => {
  const { closeGroupCycle } = require(h.BACK + '/dist/src/payment/package-rights'); const { u, s } = await paidSub('MASADA', { createdAt: new Date(Date.now() - 864e5) });
  const m = await h.meeting({ scheduledAt: new Date(Date.now() + 864e5), status: 'ACTIVE', users: [u], cycleId: (await prisma.matchingCycle.create({ data: { weekNumber: 1, year: 2031 } })).id });
  await closeGroupCycle(prisma, m.cycleId); let f = await prisma.subscription.findUnique({ where: { id: s.id } }); assert.equal(f.groupRights, 1); assert.equal(f.groupCycles, 1);
  await closeGroupCycle(prisma, m.cycleId); f = await prisma.subscription.findUnique({ where: { id: s.id } }); assert.equal(f.groupRights, 1, 'aynı masa için ikinci hak düşmez'); await closeGroupCycle(prisma, null); await closeGroupCycle(prisma, null); f = await prisma.subscription.findUnique({ where: { id: s.id } }); assert.equal(f.groupCycles, 4); assert.equal(f.status, 'EXPIRED');
});
test('2.5 son 15 dk alınan paket o döngüye sayılmaz', async () => { const { closeGroupCycle } = require(h.BACK + '/dist/src/payment/package-rights'); const { s } = await paidSub('MASADA'); await closeGroupCycle(prisma, null); assert.equal((await prisma.subscription.findUnique({ where: { id: s.id } })).groupCycles, 0); });
test('2.5 iade: 4 döngü dolmadan red, sonra talep; tekrar 409; onay iyzico, iptal', async () => {
  const { u, s } = await paidSub('MASADA'); const q = () => api('POST', '/payment/refund-request', { token: u.token, body: { refundType: 'GROUP' } }); assert.equal((await q()).status, 400);
  await prisma.subscription.update({ where: { id: s.id }, data: { groupCycles: 4, status: 'EXPIRED' } }); const r = await q(); assert.equal(r.status, 201, r.text); assert.equal((await q()).status, 409);
  const m = h.outboxMark(); const a = await api('PATCH', `/admin/refunds/${r.json.refundRequestId}`, { token: sup.token, body: { status: 'APPROVED' } }); assert.equal(a.status, 200, a.text); const paid = (await prisma.payment.findFirst({ where: { userId: u.id } })).amountKurus; assert.equal(h.outboxSince(m).find((e) => e.template === 'refund').params.amountKurus, paid);
  assert.equal((await prisma.subscription.findUnique({ where: { id: s.id } })).status, 'CANCELLED'); assert.equal((await prisma.refundRequest.findUnique({ where: { id: r.json.refundRequestId } })).refundedKurus, paid);
  assert.equal((await api('PATCH', `/admin/refunds/${r.json.refundRequestId}`, { token: sup.token, body: { status: 'APPROVED' } })).status, 400);
});
test('2.5 iade: masa kurulduysa red', async () => { const { u, s } = await paidSub('MASADA', { groupCycles: 4 }); await h.meeting({ users: [u], status: 'COMPLETED' }); assert.equal((await api('POST', '/payment/refund-request', { token: u.token, body: { refundType: 'GROUP' } })).status, 400); assert.ok(s); });
test('2.5 iade: İçerde tek kısım yarım tutar, ikinci kısım kalan, FULL sonra red', async () => {
  const { u, s } = await paidSub('ICERDE', { groupCycles: 4 }); const r = await api('POST', '/payment/refund-request', { token: u.token, body: { refundType: 'GROUP' } }); assert.equal(r.status, 201); const a = await api('PATCH', `/admin/refunds/${r.json.refundRequestId}`, { token: sup.token, body: { status: 'APPROVED' } }); const paid = (await prisma.payment.findFirst({ where: { userId: u.id } })).amountKurus; assert.equal(a.json.refundedKurus, Math.round(paid / 2));
  assert.equal((await prisma.subscription.findUnique({ where: { id: s.id } })).groupRights, 0); await prisma.subscription.update({ where: { id: s.id }, data: { oneOnOneCycles: 4 } }); assert.equal((await api('POST', '/payment/refund-request', { token: u.token, body: { refundType: 'FULL' } })).status, 400);
});
test('2.5 iade: admin onayı iyzico hatasında talep PENDING kalır', async () => { const { u } = await paidSub('MASADA', { groupCycles: 4 }); const r = await api('POST', '/payment/refund-request', { token: u.token, body: { refundType: 'GROUP' } }); h.control({ iyzicoRefund: 'failure' }); const a = await api('PATCH', `/admin/refunds/${r.json.refundRequestId}`, { token: sup.token, body: { status: 'APPROVED' } }); assert.equal(a.status, 400); assert.equal((await prisma.refundRequest.findUnique({ where: { id: r.json.refundRequestId } })).status, 'PENDING'); });
test('2.5 iade: admin red kaydı', async () => { const { u } = await paidSub('MASADA', { groupCycles: 4 }); const r = await api('POST', '/payment/refund-request', { token: u.token, body: { refundType: 'GROUP' } }); const a = await api('PATCH', `/admin/refunds/${r.json.refundRequestId}`, { token: sup.token, body: { status: 'REJECTED', adminNote: 'hayır' } }); assert.equal(a.status, 200, a.text); assert.equal((await prisma.refundRequest.findUnique({ where: { id: r.json.refundRequestId } })).status, 'REJECTED'); });
test('2.5 iade: eşzamanlı iki admin onayı tek iade yapmalı', async () => { const { u } = await paidSub('MASADA', { groupCycles: 4 }); const r = await api('POST', '/payment/refund-request', { token: u.token, body: { refundType: 'GROUP' } }); const m = h.outboxMark(); await Promise.all([1, 2, 3].map(() => api('PATCH', `/admin/refunds/${r.json.refundRequestId}`, { token: sup.token, body: { status: 'APPROVED' } }))); const n = h.outboxSince(m).filter((e) => e.template === 'refund').length; assert.equal(n, 1, `iyzico iadesi ${n} kez çağrıldı`); });
test('2.5 iade: banlı kullanıcıya onay red', async () => { const { u } = await paidSub('MASADA', { groupCycles: 4 }); const r = await api('POST', '/payment/refund-request', { token: u.token, body: { refundType: 'GROUP' } }); await prisma.user.update({ where: { id: u.id }, data: { status: 'BANNED' } }); assert.equal((await api('PATCH', `/admin/refunds/${r.json.refundRequestId}`, { token: sup.token, body: { status: 'APPROVED' } })).status, 400); });
test('2.5 admin paket atama: SUPERADMIN, ücretsiz abonelik, çakışan iptal; ADMIN 403', async () => {
  const u = await h.user({ kyc: 'APPROVED', plan: 'MASADA' }); assert.equal((await api('POST', `/admin/users/${u.id}/free-subscription`, { token: admin.token, body: { plan: 'ICERDE' } })).status, 403); const r = await api('POST', `/admin/users/${u.id}/free-subscription`, { token: sup.token, body: { plan: 'ICERDE' } }); assert.equal(r.status, 201, r.text);
  const subs = await prisma.subscription.findMany({ where: { userId: u.id } }); assert.equal(subs.find((s) => s.plan === 'MASADA').status, 'CANCELLED'); assert.equal(subs.find((s) => s.plan === 'ICERDE').status, 'ACTIVE'); assert.equal((await api('GET', '/payment/subscriptions', { token: u.token })).json.subscriptions[0].paid, false);
});
test('2.5 ücretsiz paket iade edilemez', async () => { const u = await h.user({ plan: 'MASADA', sub: { groupCycles: 4 } }); assert.equal((await api('POST', '/payment/refund-request', { token: u.token, body: { refundType: 'GROUP' } })).status, 404); });
test('2.5 hediye rol: SUPERADMIN rol değiştirir, ADMIN yapamaz', async () => { const u = await h.user(); assert.equal((await api('PATCH', `/admin/users/${u.id}/role`, { token: admin.token, body: { role: 'ADMIN' } })).status, 403); const r = await api('PATCH', `/admin/users/${u.id}/role`, { token: sup.token, body: { role: 'COACH' } }); assert.equal(r.status, 200, r.text); });
test('2.5 Öncü rozeti aç/kapat, kota', async () => { const u = await h.user(); const r = await api('POST', `/admin/users/${u.id}/pioneer`, { token: admin.token }); assert.ok([200, 201].includes(r.status), r.text); assert.equal((await prisma.profile.findUnique({ where: { userId: u.id } })).isPioneer, true); const q = await api('GET', '/admin/pioneer/quota', { token: admin.token }); assert.equal(q.json.max, 500); assert.equal(q.json.used, 1); await api('POST', `/admin/users/${u.id}/pioneer`, { token: admin.token }); assert.equal((await prisma.profile.findUnique({ where: { userId: u.id } })).isPioneer, false); });
test('2.5 bakım modu: init 503', async () => { await prisma.appConfig.update({ where: { key: 'MAINTENANCE_MODE' }, data: { value: 'true' } }); const u = await buyer(); const r = await init(u); await prisma.appConfig.update({ where: { key: 'MAINTENANCE_MODE' }, data: { value: 'false' } }); assert.equal(r.status, 503); });
test('2.5 IDOR: abonelik listesi sadece kendisi', async () => { const { u } = await paidSub('MASADA'); const o = await h.user(); assert.equal((await api('GET', '/payment/subscriptions', { token: o.token })).json.subscriptions.length, 0); assert.ok(u); });
