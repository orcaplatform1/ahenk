const { test, before, after } = require('node:test'); const assert = require('node:assert/strict');
const fs = require('fs'); const h = require('../lib/h'); const { api, prisma } = h;
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(200, 2)]);
const TCKN = '10000000146';
function fd({ front = JPG, back = JPG, vid = MP4 } = {}) { const f = new FormData(); if (front) f.append('idFront', new Blob([front], { type: 'image/jpeg' }), 'a.jpg'); if (back) f.append('idBack', new Blob([back]), 'b.jpg'); if (vid) f.append('liveness', new Blob([vid]), 'v.mp4'); return f; }
const up = (u, o) => api('POST', '/kyc/upload', { token: u.token, form: fd(o) });
let admin, sup, other;
before(async () => { await h.resetDomain(); admin = await h.user({ role: 'ADMIN' }); sup = await h.user({ role: 'SUPERADMIN' }); other = await h.user(); });
after(() => h.prisma.$disconnect());
async function pending() { const u = await h.user(); const r = await up(u); assert.equal(r.status, 201, r.text); return { u, id: r.json.id }; }
test('2.3 yükleme: başvuru PENDING, dosyalar kullanıcı dizininde', async () => { const { u, id } = await pending(); const k = await prisma.kycSubmission.findUnique({ where: { id } }); assert.equal(k.status, 'PENDING'); assert.ok(k.idFrontKey.includes(u.id)); assert.ok(fs.existsSync(k.idFrontKey), k.idFrontKey); assert.ok(fs.realpathSync(k.idFrontKey).startsWith('/root/ahenk-test-artifacts/uploads')); });
test('2.3 durum ucu', async () => { const u = await h.user(); assert.equal((await api('GET', '/kyc/status', { token: u.token })).json.status, null); await up(u); assert.equal((await api('GET', '/kyc/status', { token: u.token })).json.status, 'PENDING'); });
test('2.3 OLUMSUZ eksik dosya', async () => { const u = await h.user(); assert.equal((await up(u, { vid: null })).status, 400); });
test('2.3 OLUMSUZ içerik türü başlıktan belirlenir: exe gibi veri jpg adıyla reddedilir', async () => { const u = await h.user(); assert.equal((await up(u, { front: Buffer.from('MZ not an image at all') })).status, 400); assert.equal((await up(u, { vid: JPG })).status, 400); });
test('2.3 OLUMSUZ tekrar başvuru PENDING iken 409', async () => { const { u } = await pending(); assert.equal((await up(u)).status, 409); });
test('2.3 HEIC yükleme JPEG\'e çevrilir', async () => { const u = await h.user(); const r = await up(u, { front: fs.readFileSync(__dirname + '/../fixtures/sample.heic') }); assert.equal(r.status, 201, r.text); assert.match(r.json.idFrontKey, /id-front\.jpg$/); const b = fs.readFileSync(r.json.idFrontKey); assert.equal(b[0], 0xff); assert.equal(b[1], 0xd8); });
test('2.3 OLUMSUZ bozuk HEIC 400', async () => { const u = await h.user(); const bad = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypheic'), Buffer.alloc(100)]); const r = await up(u, { front: bad }); assert.equal(r.status, 400); });
test('2.3 video 99 MB kabul, 101 MB red (413), geçici dosya kalmaz', async () => {
  const u = await h.user(); const big = Buffer.concat([MP4, Buffer.alloc(101 * 1024 * 1024)]); const r = await up(u, { vid: big }); assert.equal(r.status, 413, 'gelen ' + r.status);
  const v = Buffer.concat([MP4, Buffer.alloc(99 * 1024 * 1024)]); const ok = await up(u, { vid: v }); assert.equal(ok.status, 201);
});
const tmpList = () => { const tmp = h.ROOT + '/uploads/kyc/.tmp'; return fs.existsSync(tmp) ? fs.readdirSync(tmp) : []; };
test('2.3 reddedilen yüklemede (eksik dosya) kimlik görseli .tmp içinde kalmamalı', async () => { const n = tmpList().length; const u = await h.user(); await up(u, { vid: null }); assert.equal(tmpList().length, n); });
test('2.3 reddedilen yüklemede (101 MB) kimlik görseli .tmp içinde kalmamalı', async () => { const n = tmpList().length; const u = await h.user(); await up(u, { vid: Buffer.concat([MP4, Buffer.alloc(101 * 1024 * 1024)]) }); await h.sleep(200); assert.equal(tmpList().length, n); });
test('2.3 fotoğraf 51 MB red', async () => { const u = await h.user(); const r = await up(u, { front: Buffer.concat([JPG, Buffer.alloc(51 * 1024 * 1024)]) }); assert.equal(r.status, 400); });
test('2.3 onay: TC şifreli saklanır, yanıtta yok, WhatsApp + FCM + DB, rozet', async () => {
  const { u, id } = await pending(); const m = h.outboxMark();
  const r = await api('PATCH', `/kyc/admin/${id}/review`, { token: admin.token, body: { status: 'APPROVED', identityNumber: TCKN } }); assert.equal(r.status, 200, r.text);
  assert.ok(!r.text.includes(TCKN));
  const enc = (await prisma.userIdentity.findUnique({ where: { userId: u.id } })).identityNumberEnc; assert.ok(!enc.includes(TCKN)); assert.equal(enc.split('.').length, 3);
  const { decryptIdentityNumber } = require(h.BACK + '/dist/src/kyc/identity-number'); assert.equal(decryptIdentityNumber(enc, process.env.IDENTITY_ENC_KEY), TCKN);
  await h.sleep(300); const ob = h.outboxSince(m); assert.ok(ob.some((e) => e.template === 'ahenk_kyc_approved' && e.to === u.phone.slice(-4))); assert.ok(ob.some((e) => e.channel === 'fcm'));
  assert.ok(await prisma.notification.findFirst({ where: { userId: u.id, data: { path: ['event'], equals: 'KYC_APPROVED' } } }));
  assert.equal((await api('GET', '/auth/me', { token: u.token })).json.isKycVerified, true);
  const a = await api('GET', `/kyc/admin/${id}`, { token: sup.token }); assert.equal(a.json.hasIdentityNumber, true); assert.ok(!a.text.includes(TCKN)); assert.ok(!a.text.includes(enc));
});
test('2.3 OLUMSUZ onay TC olmadan veya geçersiz TC', async () => { const { id } = await pending(); assert.equal((await api('PATCH', `/kyc/admin/${id}/review`, { token: admin.token, body: { status: 'APPROVED' } })).status, 400); assert.equal((await api('PATCH', `/kyc/admin/${id}/review`, { token: admin.token, body: { status: 'APPROVED', identityNumber: '12345678901' } })).status, 400); });
test('2.3 red: neden zorunlu, WhatsApp şablonu, yeniden başvuru', async () => {
  const { u, id } = await pending(); assert.equal((await api('PATCH', `/kyc/admin/${id}/review`, { token: admin.token, body: { status: 'REJECTED' } })).status, 400);
  const m = h.outboxMark(); assert.equal((await api('PATCH', `/kyc/admin/${id}/review`, { token: admin.token, body: { status: 'REJECTED', rejectReason: 'Bulanık' } })).status, 200); await h.sleep(200);
  const hit = h.outboxSince(m).find((e) => e.template === 'ahenk_kyc_rejected'); assert.deepEqual(hit.params, ['Bulanık']);
  const old = (await prisma.kycSubmission.findUnique({ where: { id } })).idFrontKey;
  const again = await up(u); assert.equal(again.status, 201); assert.equal(again.json.status, 'PENDING'); assert.equal(again.json.rejectReason, null); assert.ok(old);
});
test('2.3 şüpheli: neden zorunlu, WhatsApp yok, yeniden başvuru açık', async () => { const { u, id } = await pending(); const m = h.outboxMark(); assert.equal((await api('PATCH', `/kyc/admin/${id}/review`, { token: admin.token, body: { status: 'SUSPICIOUS', rejectReason: 'İnceleme' } })).status, 200); await h.sleep(200); assert.equal(h.outboxSince(m).filter((e) => e.channel === 'whatsapp').length, 0); assert.equal((await up(u)).status, 201); });
test('2.3 onay havuza giriş tetikler (assign kuyruğu işi işlenir)', async () => {
  const C = await h.cities(); const u = await h.user({ gender: 'MALE', city: C['İstanbul'], plan: 'MASADA' }); const r = await up(u); const R = new (h.bk('ioredis'))(process.env.REDIS_URL);
  const before = await R.get('ahenk-test:matching-assign:id'); await api('PATCH', `/kyc/admin/${r.json.id}/review`, { token: admin.token, body: { status: 'APPROVED', identityNumber: TCKN } }); await h.sleep(300);
  const after = await R.get('ahenk-test:matching-assign:id'); await R.quit(); assert.ok(Number(after) > Number(before || 0), 'iş eklenmedi');
});
test('2.3 onaylı kullanıcı REJECTED yapılırsa rozet düşer ve havuz dışına çıkar', async () => { const { u, id } = await pending(); await api('PATCH', `/kyc/admin/${id}/review`, { token: admin.token, body: { status: 'APPROVED', identityNumber: TCKN } }); assert.equal((await api('PATCH', `/kyc/admin/${id}/review`, { token: admin.token, body: { status: 'REJECTED', rejectReason: 'Sahte' } })).status, 200); assert.equal((await api('GET', '/auth/me', { token: u.token })).json.isKycVerified, false); });
test('2.3 mevcut TC ekleme ucu: PENDING red, onaylı+TC varsa red', async () => { const { id } = await pending(); assert.equal((await api('PATCH', `/kyc/admin/${id}/identity-number`, { token: admin.token, body: { identityNumber: TCKN } })).status, 400); await prisma.kycSubmission.update({ where: { id }, data: { status: 'APPROVED' } }); assert.equal((await api('PATCH', `/kyc/admin/${id}/identity-number`, { token: admin.token, body: { identityNumber: TCKN } })).status, 200); assert.equal((await api('PATCH', `/kyc/admin/${id}/identity-number`, { token: admin.token, body: { identityNumber: TCKN } })).status, 400); });
test('2.3 dosya erişimi: oturumsuz 401, başka kullanıcı 403, dosya sahibi 403, admin 200 ve no-store', async () => {
  const { u, id } = await pending(); const p = `/kyc/admin/file/${id}/front`; assert.equal((await api('GET', p)).status, 401); assert.equal((await api('GET', p, { token: other.token })).status, 403); assert.equal((await api('GET', p, { token: u.token })).status, 403);
  const a = await api('GET', p, { token: admin.token }); assert.equal(a.status, 200); assert.equal(a.headers.get('cache-control'), 'no-store'); assert.equal((await api('GET', `/kyc/admin/file/${id}/xx`, { token: admin.token })).status, 400);
});
test('2.3 KYC yüklemeleri statik sunulmuyor (media yolundan erişilemez)', async () => { const { u } = await pending(); for (const p of [`/media/venues/${u.id}/id-front.jpg`, `/media/venue-gallery/${u.id}/id-front.jpg`, `/media/venues/..%2Fkyc%2F${u.id}/id-front.jpg`, `/media/venues/..%2F..%2Fkyc/${u.id}%2Fid-front.jpg`]) assert.notEqual((await api('GET', p)).status, 200, p); });
test('2.3 admin liste: ADMIN e-posta görmez, SUPERADMIN görür, USER 403', async () => { await pending(); const a = await api('GET', '/kyc/admin?status=PENDING', { token: admin.token }); assert.equal(a.status, 200); assert.ok(a.json.items.length); assert.equal(a.json.items[0].user.email, undefined, 'ADMIN yanıtında e-posta var'); const s = await api('GET', '/kyc/admin', { token: sup.token }); assert.ok(s.json.items[0].user.email); assert.equal((await api('GET', '/kyc/admin', { token: other.token })).status, 403); });
