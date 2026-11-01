const { test, before, after } = require('node:test'); const assert = require('node:assert/strict');
const h = require('../lib/h'); const { api, prisma } = h; let Q;
const ans = (fn) => Q.map((q, i) => ({ questionId: q.id, score: fn(q, i) }));
before(async () => { await h.resetDomain(); Q = await prisma.oceanQuestion.findMany({ where: { active: true }, orderBy: { orderNum: 'asc' } }); });
after(() => h.prisma.$disconnect());
test('2.2 sorular herkese açık, 19 soru, boyut bilgisi gizli', async () => {
  const r = await api('GET', '/test/questions'); assert.equal(r.status, 200); assert.equal(r.json.totalQuestions, 19);
  const all = r.json.sections.flatMap((s) => s.questions); assert.equal(all.length, 19); assert.equal(all[0].dimension, undefined); assert.equal(all[0].reversed, undefined);
});
test('2.2 skor hesabı formülle aynı (ters sorular dahil)', async () => {
  const u = await h.user({ ocean: false }); const pick = (q, i) => (i % 5) + 1; const r = await api('POST', '/test/submit', { token: u.token, body: { answers: ans(pick) } }); assert.equal(r.status, 201);
  const exp = {}; Q.forEach((q, i) => { const k = q.dimension.toLowerCase(); (exp[k] ??= []).push(q.reversed ? 6 - pick(q, i) : pick(q, i)); });
  for (const [k, v] of Object.entries(exp)) assert.equal(r.json.scores[k], Math.round(((v.reduce((a, b) => a + b, 0) / v.length - 1) / 4) * 100), k);
  assert.equal(await prisma.oceanAnswer.count({ where: { userId: u.id } }), 19);
});
test('2.2 uç değerler 0 ve 100', async () => {
  const u = await h.user({ ocean: false }); const r = await api('POST', '/test/submit', { token: u.token, body: { answers: ans((q) => (q.reversed ? 1 : 5)) } }); for (const v of Object.values(r.json.scores)) assert.equal(v, 100);
  const u2 = await h.user({ ocean: false }); const r2 = await api('POST', '/test/submit', { token: u2.token, body: { answers: ans((q) => (q.reversed ? 5 : 1)) } }); for (const v of Object.values(r2.json.scores)) assert.equal(v, 0);
});
test('2.2 /test/my-score ucu (talimatta geçen) var mı', async () => { const u = await h.user(); const r = await api('GET', '/test/my-score', { token: u.token }); assert.equal(r.status, 200, 'uç yok, gerçek uç /test/result'); });
test('2.2 /test/result tamamlanmış ve tamamlanmamış', async () => {
  const u = await h.user({ ocean: false }); const a = await api('GET', '/test/result', { token: u.token }); assert.equal(a.json.completed, false);
  const b = await h.user(); const r = await api('GET', '/test/result', { token: b.token }); assert.equal(r.json.completed, true); assert.equal(r.json.canRetakeNow, false); assert.ok(r.json.retakeAvailableAt); assert.equal(typeof r.json.profile, 'string');
});
test('2.2 OLUMSUZ eksik cevap (18), tekrar soru, geçersiz id, aralık dışı puan', async () => {
  const u = await h.user({ ocean: false }); const sub = (answers) => api('POST', '/test/submit', { token: u.token, body: { answers } }); const all = ans(() => 3);
  assert.equal((await sub(all.slice(0, 18))).status, 400, 'eksik');
  assert.equal((await sub([...all.slice(0, 18), all[0]])).status, 400, 'tekrar');
  assert.equal((await sub([...all.slice(0, 18), { questionId: 'x', score: 3 }])).status, 400, 'id');
  assert.equal((await sub(all.map((a, i) => (i ? a : { ...a, score: 6 })))).status, 400, 'puan');
  assert.equal(await prisma.oceanScore.count({ where: { userId: u.id } }), 0);
});
test('2.2 OLUMSUZ 180 gün kilidi', async () => { const u = await h.user(); const r = await api('POST', '/test/submit', { token: u.token, body: { answers: ans(() => 3) } }); assert.equal(r.status, 409); assert.match(r.json.message, /gün sonra/); });
test('2.2 180 gün dolunca yeniden yapılır', async () => { const u = await h.user(); await prisma.oceanScore.update({ where: { userId: u.id }, data: { completedAt: new Date(Date.now() - 181 * 864e5) } }); assert.equal((await api('POST', '/test/submit', { token: u.token, body: { answers: ans(() => 4) } })).status, 201); });
test('2.2 admin kilidi açar, test bitince kilit geri gelir', async () => {
  const u = await h.user(), a = await h.user({ role: 'ADMIN' }); const r = await api('PATCH', `/test/admin/${u.id}/reset-lock`, { token: a.token }); assert.equal(r.status, 200); assert.equal(r.json.adminCanReset, true);
  assert.equal((await api('POST', '/test/submit', { token: u.token, body: { answers: ans(() => 2) } })).status, 201); assert.equal((await prisma.oceanScore.findUnique({ where: { userId: u.id } })).adminCanReset, false);
  assert.equal((await api('PATCH', `/test/admin/${u.id}/reset-lock`, { token: u.token })).status, 403);
});
test('2.2 admin: testi olmayan kullanıcı 400', async () => { const u = await h.user({ ocean: false }), a = await h.user({ role: 'ADMIN' }); assert.equal((await api('PATCH', `/test/admin/${u.id}/reset-lock`, { token: a.token })).status, 400); });
test('2.2 oturumsuz gönderim 401', async () => { assert.equal((await api('POST', '/test/submit', { body: { answers: [] } })).status, 401); });
