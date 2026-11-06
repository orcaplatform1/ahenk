const { test, before, after, beforeEach } = require('node:test'); const assert = require('node:assert/strict');
const c = require('../lib/clock'); const h = require('../lib/h'); const { api, prisma } = h;
const { encryptIdentityNumber } = require(h.BACK + '/dist/src/kyc/identity-number');
let sup, admin, wb; const MON = '2027-01-11T21:00:00'; // ISO hafta 2
async function buyer(o = {}) { const u = await h.user({ kyc: 'APPROVED', ...o }); await prisma.userIdentity.create({ data: { userId: u.id, identityNumberEnc: encryptIdentityNumber('10000000146', process.env.IDENTITY_ENC_KEY) } }); return u; }
const price = async (plan) => (await api('GET', '/payment/plans')).json.find((p) => p.plan === plan).webTL;
const st = (u) => api('GET', '/payment/winback', { token: u.token }).then((r) => r.json);
const open = (u) => api('POST', '/payment/winback/open', { token: u.token, body: {} }).then((r) => r.json);
const init = (u, plan, extra = {}) => api('POST', '/payment/init', { token: u.token, body: { plan, platform: 'WEB', ...extra } });
const cb = (t) => api('POST', `/payment/callback?token=${encodeURIComponent(t)}`);
before(async () => { c.setNow(MON); await h.resetDomain(); await c.boot(4101); wb = c.svc('payment/winback.service', 'WinbackService'); sup = await h.user({ role: 'SUPERADMIN' }); admin = await h.user({ role: 'ADMIN' }); });
beforeEach(() => { h.control({}); c.setNow(MON); });
after(() => c.shutdown());

// ─── 1A / 1B ───
test('1A ayar: başlangıç 100 TL, İçerde + Kankamla; ADMIN 403; SUPERADMIN günceller', async () => {
  const g = await api('GET', '/admin/winback', { token: sup.token }); assert.equal(g.status, 200); assert.equal(g.json.amountTL, 100); assert.deepEqual(g.json.plans.sort(), ['ICERDE', 'KANKAMLA']);
  assert.equal((await api('GET', '/admin/winback', { token: admin.token })).status, 403); assert.equal((await api('PATCH', '/admin/winback', { token: admin.token, body: { amountTL: 5, plans: [] } })).status, 403);
  const r = await api('PATCH', '/admin/winback', { token: sup.token, body: { amountTL: 150, plans: ['ICERDE'] } }); assert.equal(r.status, 200, r.text); assert.equal(r.json.amountTL, 150);
  assert.equal((await api('PATCH', '/admin/winback', { token: sup.token, body: { amountTL: 99999, plans: ['ICERDE'] } })).status, 400);
  await api('PATCH', '/admin/winback', { token: sup.token, body: { amountTL: 100, plans: ['ICERDE', 'KANKAMLA'] } });
});
test('1B hedef kitle: paketsiz, KYC onaysız dahil; aktif paketli, bot, askıda, kullanmış hariç; sadece FCM', async () => {
  const yes = await h.user({ kyc: 'APPROVED' }), noKyc = await h.user(), pkg = await h.user({ plan: 'MASADA' }), bot = await h.user({ bot: true }), susp = await h.user({ status: 'SUSPENDED' }), used = await h.user(), lapsed = await h.user({ plan: 'MASADA', sub: { status: 'EXPIRED' } });
  await prisma.winbackOffer.create({ data: { userId: used.id, usedAt: new Date() } });
  const mark = h.outboxMark(); await wb.mondayPush(); const out = h.outboxSince(mark);
  const has = async (u) => !!(await prisma.winbackOffer.findUnique({ where: { userId: u.id } }));
  assert.ok(await has(yes)); assert.ok(await has(noKyc)); assert.ok(await has(lapsed)); assert.equal(await has(pkg), false); assert.equal(await has(bot), false); assert.equal(await has(susp), false);
  assert.ok(out.length > 0); assert.ok(out.every((e) => e.channel === 'fcm'), 'WhatsApp gitmemeli'); assert.ok(out.every((e) => !/indirim/i.test(JSON.stringify(e.params))), 'metinde indirim yok');
  assert.ok(out.every((e) => e.params.body === 'Hafta sonu planını hazırladık.'), JSON.stringify(out[0])); // hafta 2 → 2. metin
});
test('1B metinler ISO haftasına göre döner', async () => {
  const texts = []; for (const d of ['2027-01-04', '2027-01-11', '2027-01-18', '2027-01-25', '2027-02-01']) { c.setNow(d + 'T21:00:00'); const m = h.outboxMark(); await wb.mondayPush(); texts.push(h.outboxSince(m)[0]?.params.body); }
  assert.deepEqual(texts, ['Masa eşleşmeleri başladı, sen neredesin?', 'Hafta sonu planını hazırladık.', 'Bu hafta masanda kimler var, merak etmiyor musun?', 'Yeni haftanın masaları kuruluyor.', 'Masa eşleşmeleri başladı, sen neredesin?']);
});
test('1A KYC onaylı: ilk açılışta sayaç başlar, tekrar açmak sıfırlamaz, süre bitince kaybolur, sonraki Pazartesi yeniden', async () => {
  const u = await buyer(); await wb.mondayPush(); let s = await st(u);
  assert.equal(s.active, true); assert.equal(s.autoOpen, true); assert.equal(s.expiresAt, null); assert.equal(s.lapsed, false);
  assert.deepEqual(s.plans.map((p) => p.plan).sort(), ['ICERDE', 'KANKAMLA']); const ic = s.plans.find((p) => p.plan === 'ICERDE'); assert.equal(ic.discountedTL, await price('ICERDE') - 100);
  s = await open(u); const exp = new Date(s.expiresAt).getTime(); assert.equal(exp, Date.now() + 36e5); assert.equal(s.autoOpen, false);
  c.setNow(new Date(Date.now() + 10 * 6e4)); assert.equal(new Date((await open(u)).expiresAt).getTime(), exp, 'sıfırlanmamalı');
  c.setNow(new Date(exp + 1000)); assert.equal((await st(u)).active, false);
  await wb.mondayPush(); s = await st(u); assert.equal(s.active, true); assert.equal(s.expiresAt, null); assert.equal(s.autoOpen, true);
});
test('1A KYC onaysız: ekran çıkar, sayaç başlamaz; onaydan sonraki ilk açılışta başlar', async () => {
  const u = await h.user({ kyc: 'PENDING' }); await wb.mondayPush(); let s = await st(u); assert.equal(s.autoOpen, true); assert.equal(s.kycApproved, false);
  s = await open(u); assert.equal(s.expiresAt, null); assert.equal(s.autoOpen, false);
  await prisma.kycSubmission.update({ where: { userId: u.id }, data: { status: 'APPROVED' } }); s = await st(u); assert.equal(s.autoOpen, true); assert.equal(s.kycApproved, true);
  s = await open(u); assert.ok(s.expiresAt);
});
test('1A ödeme: seçili pakete indirim, referansla birleşmez, başarılı ödemede harcanır, bir daha hak kazanmaz', async () => {
  const u = await buyer(); await prisma.user.update({ where: { id: u.id }, data: { referralDiscountAvailable: true } }); await wb.mondayPush(); await open(u);
  const r = await init(u, 'ICERDE', { useDiscount: 'INVITEE' }); assert.equal(r.status, 201, r.text); assert.equal(r.json.plan.amountKurus, (await price('ICERDE') - 100) * 100);
  const p = await prisma.payment.findUnique({ where: { id: r.json.paymentId } }); assert.equal(p.discountType, 'WINBACK');
  assert.match((await cb(r.json.token)).headers.get('location'), /basarili/);
  const o = await prisma.winbackOffer.findUnique({ where: { userId: u.id } }); assert.ok(o.usedAt); assert.equal((await prisma.user.findUnique({ where: { id: u.id } })).referralDiscountAvailable, true, 'referans hakkı harcanmaz');
  await prisma.subscription.updateMany({ where: { userId: u.id }, data: { status: 'EXPIRED' } }); await wb.mondayPush(); assert.ok((await prisma.winbackOffer.findUnique({ where: { userId: u.id } })).usedAt); assert.equal((await st(u)).active, false);
});
test('1A seçili olmayan pakette ve sayaç başlamadan indirim yok; aktif paket teklifi gizler', async () => {
  const u = await buyer(); await wb.mondayPush();
  let r = await init(u, 'ICERDE'); assert.equal(r.json.plan.amountKurus, await price('ICERDE') * 100, 'sayaç başlamadı'); await open(u);
  r = await init(u, 'MASADA'); assert.equal(r.json.plan.amountKurus, await price('MASADA') * 100, 'seçili değil');
  assert.match((await cb(r.json.token)).headers.get('location'), /basarili/); assert.equal((await st(u)).active, false);
});
test('1A süresi biten teklifte tam fiyat', async () => {
  const u = await buyer(); await wb.mondayPush(); await open(u); c.setNow(new Date(Date.now() + 36e5 + 1000));
  const r = await init(u, 'ICERDE'); assert.equal(r.json.plan.amountKurus, await price('ICERDE') * 100);
});
test('1A hatırlatma: bitişe 15 dk kala bir kez, sadece push', async () => {
  const u = await buyer(); await wb.mondayPush(); await open(u); let m = h.outboxMark(); await wb.expiryReminders(); assert.equal(h.outboxSince(m).filter((e) => e.to === u.fcmToken.slice(-4)).length, 0);
  c.setNow(new Date(Date.now() + 46 * 6e4)); m = h.outboxMark(); await wb.expiryReminders(); await wb.expiryReminders(); const out = h.outboxSince(m).filter((e) => e.to === u.fcmToken.slice(-4)); assert.equal(out.length, 1); assert.equal(out[0].channel, 'fcm');
});
test('1A daha önce paketi olan kullanıcı "Birkaç masa daha" başlığı alır (lapsed)', async () => {
  const u = await h.user({ plan: 'MASADA', sub: { status: 'EXPIRED' } }); await wb.mondayPush(); assert.equal((await st(u)).lapsed, true);
});

// ─── 1C ───
const O = { origin: 'http://127.0.0.1:3104' };
const cookieOf = (r, n) => r.cookies.find((x) => x.startsWith(n + '='))?.split(';')[0];
test('1C refresh çerezi maxAge 365 gün, yenilemede kayar, DB bitişi 365 gün', async () => {
  const u = await h.user(); const r = await h.login(u); assert.equal(r.status, 200);
  const rc = r.cookies.find((x) => x.startsWith('refresh_token=')); assert.match(rc, /Max-Age=31536000/);
  const t1 = await prisma.refreshToken.findFirst({ where: { userId: u.id }, orderBy: { createdAt: 'desc' } }); assert.ok(Math.abs(t1.expiresAt - Date.now() - 365 * 864e5) < 6e4);
  c.setNow(new Date(Date.now() + 864e5)); const n = await api('POST', '/auth/refresh', { headers: O, cookie: cookieOf(r, 'refresh_token') }); assert.equal(n.status, 200, n.text); assert.match(n.cookies.find((x) => x.startsWith('refresh_token=')), /Max-Age=31536000/);
  const t2 = await prisma.refreshToken.findFirst({ where: { userId: u.id, revoked: false } }); assert.ok(t2.expiresAt > t1.expiresAt);
});
test('1C kullanılmış token tekrar gelince tüm token\'lar iptal', async () => {
  const u = await h.user(); const a = await h.login(u); await h.login(u); const ck = cookieOf(a, 'refresh_token');
  assert.equal((await api('POST', '/auth/refresh', { headers: O, cookie: ck })).status, 200);
  c.setNow(new Date(Date.now() + 60000)); assert.equal((await api('POST', '/auth/refresh', { headers: O, cookie: ck })).status, 401);
  assert.equal(await prisma.refreshToken.count({ where: { userId: u.id, revoked: false } }), 0);
});
test('1C tüm cihazlardan çıkış: token\'lar iptal, erişim token\'ı düşer', async () => {
  const u = await h.user(); const a = await h.login(u); await h.login(u); assert.equal((await api('POST', '/auth/logout-all', { token: a.json.accessToken, body: {} })).status, 200);
  assert.equal(await prisma.refreshToken.count({ where: { userId: u.id, revoked: false } }), 0); assert.equal((await api('GET', '/auth/me', { token: a.json.accessToken })).status, 401);
});
test('1C ban ve karantina tüm token\'ları iptal eder', async () => {
  for (const ep of ['ban', 'quarantine']) { const u = await h.user(); await h.login(u); const r = await api('POST', `/admin/users/${u.id}/${ep}`, { token: sup.token, body: {} }); assert.ok(r.status < 300, r.text); assert.equal(await prisma.refreshToken.count({ where: { userId: u.id, revoked: false } }), 0, ep); }
});
test('1C şifre sıfırlama tüm token\'ları iptal eder', async () => {
  const u = await h.user(); await h.login(u); await api('POST', '/auth/forgot-password', { body: { phone: u.phone } }); const code = await h.otpFor(u.phone);
  const r = await api('POST', '/auth/reset-password', { body: { phone: u.phone, code, newPassword: 'Yeni1234!' } }); assert.equal(r.status, 200, r.text); assert.equal(await prisma.refreshToken.count({ where: { userId: u.id, revoked: false } }), 0);
});

// ─── 1D ───
test('1D aktif masası olan talep veremez', async () => {
  const u = await h.user(); const m = await h.meeting({ users: [u] }); const r = await api('POST', '/users/me/deletion-request', { token: u.token, body: {} }); assert.equal(r.status, 400); assert.match(r.json.message, /masan var/);
  await prisma.meeting.update({ where: { id: m.id }, data: { status: 'COMPLETED' } }); assert.equal((await api('POST', '/users/me/deletion-request', { token: u.token, body: {} })).status, 200);
  assert.equal((await api('POST', '/users/me/deletion-request', { token: u.token, body: {} })).status, 409); assert.ok((await api('GET', '/users/me/deletion-request', { token: u.token })).json.request.id);
});
test('1D yetki: ADMIN görür, onaylayamaz; SUPERADMIN reddeder, kayıt düşer', async () => {
  const u = await h.user(); const q = (await api('POST', '/users/me/deletion-request', { token: u.token, body: {} })).json;
  assert.equal((await api('GET', '/admin/deletion-requests', { token: admin.token })).status, 200); assert.equal((await api('PATCH', `/admin/deletion-requests/${q.id}`, { token: admin.token, body: { status: 'APPROVED' } })).status, 403);
  assert.equal((await api('GET', '/admin/deletion-requests', { token: u.token })).status, 403);
  assert.equal((await api('PATCH', `/admin/deletion-requests/${q.id}`, { token: sup.token, body: { status: 'REJECTED' } })).status, 200); assert.equal((await prisma.user.findUnique({ where: { id: u.id } })).status, 'ACTIVE');
  assert.equal(await prisma.adminActionLog.count({ where: { targetUserId: u.id, action: 'ACCOUNT_DELETION_REJECT' } }), 1);
});
test('1D onay: kişisel veri silinir, ödeme/abonelik/onay kalır, masa ve değerlendirme bağı kopar', async () => {
  const other = await h.user(); const u = await buyer({ plan: 'MASADA', firstName: 'Silinecek' }); const uid = u.id;
  const m = await h.meeting({ users: [u, other], status: 'COMPLETED' }); await prisma.meetingReview.create({ data: { meetingId: m.id, reviewerId: uid, rating: 5, comment: 'iyi' } });
  await prisma.chatMessage.create({ data: { meetingId: m.id, senderId: uid, content: 'selam' } }); await prisma.contactBlock.create({ data: { userId: uid, hashedPhone: '+905551112233' } }); await prisma.userBlock.create({ data: { blockerId: other.id, blockedId: uid } });
  await prisma.notification.create({ data: { userId: uid, type: 'IN_APP', title: 'x', body: 'y' } }); await prisma.consentLog.create({ data: { userId: uid, type: 'TERMS_OF_SERVICE', accepted: true } });
  await prisma.payment.create({ data: { userId: uid, plan: 'MASADA', amountKurus: 100, status: 'SUCCESS', platform: 'WEB' } }); await h.login(u);
  const q = (await api('POST', '/users/me/deletion-request', { token: u.token, body: {} })).json; const r = await api('PATCH', `/admin/deletion-requests/${q.id}`, { token: sup.token, body: { status: 'APPROVED' } }); assert.equal(r.status, 200, r.text);
  const d = await prisma.user.findUnique({ where: { id: uid }, include: { profile: true, oceanScore: true, kyc: true, identity: true } });
  assert.equal(d.status, 'DELETED'); assert.equal(d.phone, null); assert.equal(d.fcmToken, null); assert.equal(d.phoneHash, null); assert.notEqual(d.email, u.email); for (const k of ['profile', 'oceanScore', 'kyc', 'identity']) assert.equal(d[k], null, k);
  for (const [t, w] of [['contactBlock', { userId: uid }], ['userBlock', { blockedId: uid }], ['chatMessage', { senderId: uid }], ['notification', { userId: uid }], ['refreshToken', { userId: uid }]]) assert.equal(await prisma[t].count({ where: w }), 0, t);
  assert.equal(await prisma.payment.count({ where: { userId: uid } }), 1); assert.equal(await prisma.consentLog.count({ where: { userId: uid } }), 1); assert.equal((await prisma.subscription.findFirst({ where: { userId: uid } })).status, 'CANCELLED');
  assert.equal(await prisma.meetingParticipant.count({ where: { meetingId: m.id } }), 2); assert.equal(await prisma.meetingParticipant.count({ where: { meetingId: m.id, userId: uid } }), 0); const rv = await prisma.meetingReview.findFirst({ where: { meetingId: m.id } }); assert.ok(rv); assert.notEqual(rv.reviewerId, uid);
  assert.equal((await api('POST', '/auth/login', { body: { email: u.email, password: h.PW } })).status, 401); assert.equal(await prisma.adminActionLog.count({ where: { targetUserId: uid, action: 'ACCOUNT_DELETION_APPROVE' } }), 1);
  assert.equal((await api('GET', '/admin/users?search=silinmis-masa', { token: sup.token })).json.total, 0);
});
test('1D banlıda phoneHash kalır, numara tekrar kayıt olamaz; yaptırım kimliği sadece SUPERADMIN görür', async () => {
  const u = await h.user(); const q = (await api('POST', '/users/me/deletion-request', { token: u.token, body: {} })).json; const adminView = u.firstName;
  await api('POST', `/admin/users/${u.id}/ban`, { token: sup.token, body: {} });
  assert.equal((await api('PATCH', `/admin/deletion-requests/${q.id}`, { token: sup.token, body: { status: 'APPROVED' } })).status, 200);
  const d = await prisma.user.findUnique({ where: { id: u.id } }); assert.ok(d.phoneHash); assert.equal(d.phone, null);
  assert.equal((await api('POST', '/auth/register/send-otp', { body: { phone: u.phone } })).status, 403);
  const su = (await api('GET', '/admin/deletion-requests', { token: sup.token })).json.find((x) => x.id === q.id); assert.equal(su.retainedIdentity.phone, u.phone);
  const ad = (await api('GET', '/admin/deletion-requests', { token: admin.token })).json.find((x) => x.id === q.id); assert.equal(ad.retainedIdentity, undefined);
});

// ─── İş 2 ───
async function proc() { const u = await h.user({ plan: 'MASADA' }); const s = await prisma.subscription.findFirst({ where: { userId: u.id } }); await prisma.payment.create({ data: { userId: u.id, subscriptionId: s.id, plan: 'MASADA', amountKurus: 40000, status: 'SUCCESS', platform: 'WEB', iyzicoPaymentId: 'py1' } }); return { u, s, r: await prisma.refundRequest.create({ data: { userId: u.id, subscriptionId: s.id, refundType: 'GROUP', status: 'PROCESSING', idempotencyKey: `refund:${s.id}:GROUP` } }) }; }
test('2 liste ve yetki: sadece SUPERADMIN', async () => {
  const { r } = await proc(); const u = await h.user(); const p = await prisma.payment.create({ data: { userId: u.id, plan: 'MASADA', amountKurus: 100, status: 'DUPLICATE', platform: 'WEB' } });
  assert.equal((await api('GET', '/admin/settlements', { token: admin.token })).status, 403); assert.equal((await api('PATCH', `/admin/settlements/refunds/${r.id}`, { token: admin.token, body: { status: 'APPROVED' } })).status, 403);
  const g = await api('GET', '/admin/settlements', { token: sup.token }); assert.ok(g.json.refunds.some((x) => x.id === r.id)); assert.ok(g.json.payments.some((x) => x.id === p.id));
});
test('2 iade APPROVED: paket kapanır, tutar yazılır, log; ikinci işlem 400', async () => {
  const { r, s } = await proc(); const a = await api('PATCH', `/admin/settlements/refunds/${r.id}`, { token: sup.token, body: { status: 'APPROVED', note: 'panelden baktım' } }); assert.equal(a.status, 200, a.text);
  const n = await prisma.refundRequest.findUnique({ where: { id: r.id } }); assert.equal(n.status, 'APPROVED'); assert.equal(n.refundedKurus, 40000); assert.equal((await prisma.subscription.findUnique({ where: { id: s.id } })).status, 'CANCELLED');
  assert.equal(await prisma.adminActionLog.count({ where: { action: 'REFUND_SETTLE', targetUserId: r.userId } }), 1); assert.equal((await api('PATCH', `/admin/settlements/refunds/${r.id}`, { token: sup.token, body: { status: 'REJECTED' } })).status, 400);
});
test('2 iade REJECTED: paket kalır, anahtar temizlenir', async () => {
  const { r, s } = await proc(); assert.equal((await api('PATCH', `/admin/settlements/refunds/${r.id}`, { token: sup.token, body: { status: 'REJECTED' } })).status, 200);
  const n = await prisma.refundRequest.findUnique({ where: { id: r.id } }); assert.equal(n.status, 'REJECTED'); assert.equal(n.idempotencyKey, null); assert.equal((await prisma.subscription.findUnique({ where: { id: s.id } })).status, 'ACTIVE');
});
test('2 DUPLICATE ödeme REFUNDED ve FAILED, log; yeni enum yok', async () => {
  for (const status of ['REFUNDED', 'FAILED']) { const u = await h.user(); const p = await prisma.payment.create({ data: { userId: u.id, plan: 'MASADA', amountKurus: 100, status: 'DUPLICATE', platform: 'WEB' } }); assert.equal((await api('PATCH', `/admin/settlements/payments/${p.id}`, { token: sup.token, body: { status } })).status, 200); assert.equal((await prisma.payment.findUnique({ where: { id: p.id } })).status, status); assert.equal(await prisma.adminActionLog.count({ where: { action: 'PAYMENT_SETTLE', targetUserId: u.id } }), 1); }
  const u = await h.user(); const p = await prisma.payment.create({ data: { userId: u.id, plan: 'MASADA', amountKurus: 100, status: 'DUPLICATE', platform: 'WEB' } }); assert.equal((await api('PATCH', `/admin/settlements/payments/${p.id}`, { token: sup.token, body: { status: 'SUCCESS' } })).status, 400);
});
