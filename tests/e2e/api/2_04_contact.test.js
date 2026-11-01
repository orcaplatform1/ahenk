const { test, before, after } = require('node:test'); const assert = require('node:assert/strict'); const crypto = require('crypto');
const c = require('../lib/clock'); const h = require('../lib/h'); const { api, prisma } = h; let C;
const IST = () => C['İstanbul'];
const elig = (o) => h.user({ city: IST(), kyc: 'APPROVED', ...o });
before(async () => { await h.resetDomain(); C = await h.cities(); await c.boot(); c.setNow('2027-01-04T11:00:00'); });
after(() => c.shutdown());
async function sameTable(a, b) { const ms = await prisma.meetingParticipant.findMany({ where: { userId: { in: [a.id, b.id] }, meeting: { status: { in: ['PENDING', 'ACTIVE'] } } } }); const set = ms.map((m) => m.meetingId); return new Set(set).size < set.length; }
test('2.4 sync, liste, tekil silme, başkasının kaydı', async () => {
  const a = await h.user(), b = await h.user(); assert.equal((await api('POST', '/contact-blocks/sync', { token: a.token, body: { hashedPhones: ['0532 111 22 33'] } })).status, 201);
  const l = await api('GET', '/contact-blocks', { token: a.token }); assert.equal(l.json.count, 1); assert.equal(l.json.items[0].hashedPhone, '+905321112233');
  assert.equal((await api('DELETE', `/contact-blocks/${l.json.items[0].id}`, { token: b.token })).status, 403); assert.equal((await api('DELETE', `/contact-blocks/${l.json.items[0].id}`, { token: a.token })).status, 200);
});
test('2.4 sınır 50, 51 red', async () => { const a = await h.user(); const nums = Array.from({ length: 51 }, (_, i) => `+90532${String(i).padStart(7, '0')}`); assert.equal((await api('POST', '/contact-blocks/sync', { token: a.token, body: { hashedPhones: nums } })).status, 400); assert.equal((await api('POST', '/contact-blocks/sync', { token: a.token, body: { hashedPhones: nums.slice(0, 50) } })).status, 201); assert.equal((await api('POST', '/contact-blocks/sync', { token: a.token, body: { hashedPhones: ['+905550000000'] } })).status, 400); });
test('2.4 aynı numaraları tekrar sync etmek sınırı aşmaz (kayıttaki senkron tekrarı)', async () => { const a = await h.user(); const nums = Array.from({ length: 30 }, (_, i) => `+90533${String(i).padStart(7, '0')}`); await api('POST', '/contact-blocks/sync', { token: a.token, body: { hashedPhones: nums } }); const r = await api('POST', '/contact-blocks/sync', { token: a.token, body: { hashedPhones: nums } }); assert.equal(r.status, 201, 'aynı 30 numara tekrar gönderilince gelen ' + r.status); });
test('2.4 S-5: web\'in gönderdiği açık numara eşleştirmede eşleşir (grup masası ayrı)', async () => {
  const a = await elig({ gender: 'MALE', plan: 'MASADA' }), b = await elig({ gender: 'FEMALE', plan: 'MASADA' });
  await api('POST', '/contact-blocks/sync', { token: a.token, body: { hashedPhones: [b.phone.replace('+90', '0')] } });
  await c.svc('matching/matching.service', 'MatchingService').scanPool(); assert.equal(await sameTable(a, b), false, 'engelli çift aynı masada');
  assert.equal(await prisma.meetingParticipant.count({ where: { userId: { in: [a.id, b.id] } } }), 2);
});
test('2.4 S-5: ters yön de engeller (B engelledi, A atanırken)', async () => {
  await prisma.meeting.deleteMany(); const a = await elig({ gender: 'MALE', plan: 'MASADA' }), b = await elig({ gender: 'FEMALE', plan: 'MASADA' });
  await prisma.subscription.updateMany({ where: { userId: { notIn: [a.id, b.id] } }, data: { status: 'CANCELLED' } });
  await api('POST', '/contact-blocks/sync', { token: b.token, body: { hashedPhones: [a.phone] } }); await c.svc('matching/matching.service', 'MatchingService').scanPool(); assert.equal(await sameTable(a, b), false);
});
test('2.4 S-5: SHA-256 gönderilirse (eski istemci) engel çalışmaz (uyumsuzluk kaydı)', async () => {
  await prisma.meeting.deleteMany(); const a = await elig({ gender: 'MALE', plan: 'MASADA' }), b = await elig({ gender: 'FEMALE', plan: 'MASADA' });
  await prisma.subscription.updateMany({ where: { userId: { notIn: [a.id, b.id] } }, data: { status: 'CANCELLED' } });
  const sha = crypto.createHash('sha256').update(b.phone).digest('hex'); await api('POST', '/contact-blocks/sync', { token: a.token, body: { hashedPhones: [sha] } });
  await c.svc('matching/matching.service', 'MatchingService').scanPool(); assert.equal(await sameTable(a, b), true, 'SHA gönderimi bile engelledi');
});
test('2.4 /api/hash-phones ucu test backend ve web\'de yok', async () => { const r = await fetch('http://127.0.0.1:3104/api/hash-phones', { method: 'POST' }); assert.equal(r.status, 404); });
