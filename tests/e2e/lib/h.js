// Ortak test yardımcıları. Sadece ahenk_test üzerinde çalışır.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = '/root/ahenk-test', BACK = ROOT + '/backend', ART = process.env.AHENK_TEST_ARTIFACTS || '/root/ahenk-test-artifacts';
for (const l of fs.readFileSync(BACK + '/.env.test', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (!m) continue;
  if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}
if (!process.env.DATABASE_URL.includes('ahenk_test') || process.env.AHENK_TEST_MODE !== '1') throw new Error('Test ortamı değil, durduruldu');
const bk = (m) => require(require.resolve(m, { paths: [BACK] }));
const { PrismaClient } = require(BACK + '/dist/src/generated/prisma/client');
const { PrismaPg } = bk('@prisma/adapter-pg');
const bcrypt = bk('bcryptjs');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const PW = 'Test1234!';
const PW_HASH = bcrypt.hashSync(PW, 4);
const eps = JSON.parse(fs.readFileSync(ART + '/endpoints.json', 'utf8'));
const matchers = eps.map((e) => ({ m: e.m, p: e.p, re: new RegExp('^' + e.p.replace(/:[A-Za-z]+/g, '[^/]+') + '$') }));
matchers.sort((a, b) => (a.p.match(/:/g) || []).length - (b.p.match(/:/g) || []).length);
function covered(method, url, status, bearer) {
  const p = url.split('?')[0]; const hit = matchers.find((x) => x.m === method && x.re.test(p));
  fs.appendFileSync(ART + '/coverage.jsonl', JSON.stringify({ ep: hit ? `${hit.m} ${hit.p}` : `? ${method} ${p}`, status, bearer: !!bearer }) + '\n');
}
let ipSeq = Math.floor(Math.random() * 60000);
const nextIp = () => { ipSeq++; return `10.${(process.pid % 200) + 1}.${(ipSeq >> 8) & 255}.${ipSeq & 255}`; };
let base = 'http://127.0.0.1:4100';
const setBase = (b) => { base = b; };
async function api(method, url, { token, body, headers = {}, ip, form, cookie, redirect = 'manual' } = {}) {
  const h = { 'x-forwarded-for': ip || nextIp(), ...headers };
  if (token) h.authorization = `Bearer ${token}`;
  if (cookie) h.cookie = cookie;
  let payload;
  if (form) payload = form; else if (body !== undefined) { h['content-type'] = 'application/json'; payload = JSON.stringify(body); }
  const full = url.startsWith('/api') ? url : '/api/v1' + url;
  const r = await fetch(base + full, { method, headers: h, body: payload, redirect });
  const text = await r.text(); let json; try { json = JSON.parse(text); } catch { json = undefined; }
  covered(method, full, r.status, !!token);
  return { status: r.status, json, text, headers: r.headers, cookies: r.headers.getSetCookie?.() ?? [] };
}
const control = (c) => fs.writeFileSync(ART + '/fake-control.json', JSON.stringify(c));
const outbox = () => { try { return fs.readFileSync(ART + '/outbox.log', 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
const outboxMark = () => outbox().length;
const outboxSince = (mark) => outbox().slice(mark);
async function otpFor(phone, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const hit = outbox().reverse().find((e) => e.channel === 'whatsapp-otp' && e.params.phone === phone);
    if (hit) return hit.params.code;
    await sleep(50);
  }
  throw new Error('OTP outbox\'ta yok: ' + phone);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let phoneSeq = 0;
const runTag = (Date.now() % 100000).toString().padStart(5, '0') + (process.pid % 10);
function uniquePhone() { phoneSeq++; return `+9059${runTag.slice(-5)}${phoneSeq.toString().padStart(3, '0')}`.slice(0, 13); }
async function cities() { return Object.fromEntries((await prisma.city.findMany()).map((c) => [c.name, c.id])); }
const signAccess = (u) => new (bk('@nestjs/jwt').JwtService)({}).sign({ sub: u.id, email: u.email, role: u.role, tv: u.tokenVersion ?? 0 }, { secret: process.env.JWT_SECRET, expiresIn: '6h' });
const OCEAN = { openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 50, neuroticism: 50 };
// Kullanıcıyı doğrudan DB'de kurar. opts: gender,city(id),district,age,ocean(false=yok),kyc,plan,role,bot,status,sector,venuePreference,sub(ek alan)
async function user(opts = {}) {
  const phone = opts.phone ?? (opts.bot ? null : uniquePhone());
  const tag = crypto.randomBytes(4).toString('hex');
  const age = opts.age ?? 30;
  const birthDate = new Date(Date.now() - age * 365.25 * 864e5);
  const u = await prisma.user.create({ data: {
    email: opts.email ?? `${tag}@e2e.test`, phone, passwordHash: PW_HASH, role: opts.role ?? 'USER', status: opts.status ?? 'ACTIVE',
    phoneVerified: true, isBot: !!opts.bot, occupationSector: opts.sector ?? 'Teknoloji', fcmToken: opts.fcm === false ? null : `fcm-${tag}`,
    profile: { create: { firstName: opts.firstName ?? 'Ada', lastName: opts.lastName ?? 'Test', gender: opts.gender === undefined ? 'MALE' : opts.gender, birthDate,
      primaryCity: opts.city ?? null, district: opts.district ?? null, venuePreference: opts.venuePreference ?? 'NO_PREFERENCE' } },
    ...(opts.ocean === false ? {} : { oceanScore: { create: { ...OCEAN, ...(opts.ocean || {}) } } }),
    ...(opts.kyc ? { kyc: { create: { idFrontKey: 'x', idBackKey: 'x', livenessKey: 'x', status: opts.kyc } } } : {}),
    ...(opts.plan ? { subscriptions: { create: subData(opts.plan, opts.sub) } } : {}),
  }, include: { profile: true } });
  u.password = PW; u.token = signAccess(u);
  return u;
}
function subData(plan, extra = {}) {
  const base = { plan, status: 'ACTIVE', ...extra };
  if (plan === 'MASADA') return { groupRights: 2, ...base };
  if (plan === 'ICERDE') return { groupRights: 2, ...base };
  if (plan === 'KANKAMLA') return { kankaRights: 2, ...base };
  return base;
}
// ahenk_test'i temiz başlangıca alır (bütün kullanıcı işlem verisi silinir, şehir/soru/fiyat kalır)
async function resetDomain() {
  const [{ db }] = await prisma.$queryRaw`select current_database() as db`;
  if (db !== 'ahenk_test') throw new Error('yanlış veritabanı: ' + db);
  for (const t of ['AdminActionLog','KycSubmission','MatchingWaitlist','SosReport','Referral','RefundRequest','Payment','Subscription','Meeting','MatchingCycle','VenueWeeklyCapacity','VenueAccount','PartnershipApplication','CareerApplication','Venue','User'])
    await prisma.$executeRawUnsafe(`DELETE FROM "${t}"`);
  await prisma.appConfig.updateMany({ where: { key: 'MATCHING_ENABLED' }, data: { value: 'true' } });
  await prisma.appConfig.updateMany({ where: { key: 'BOT_SYSTEM_ACTIVE' }, data: { value: 'true' } });
  await prisma.appConfig.updateMany({ where: { key: 'MAINTENANCE_MODE' }, data: { value: 'false' } });
  control({});
}
async function login(u) { const r = await api('POST', '/auth/login', { body: { email: u.email, password: PW } }); return r; }
const part = (meetingId, userId, extra = {}) => prisma.meetingParticipant.create({ data: { meetingId, userId, status: 'INVITED', ...extra } });
async function meeting(opts) { // {type,city,scheduledAt,status,users[],...}
  const { users = [], type = 'GROUP', city, ...rest } = opts;
  const m = await prisma.meeting.create({ data: { type, title: 'E2E ' + type, cityId: city, scheduledAt: new Date(Date.now() + 864e5), status: 'ACTIVE', maxParticipants: type === 'GROUP' ? 6 : type === 'KANKA' ? 4 : 2, ...rest } });
  for (const u of users) await part(m.id, u.id);
  return m;
}
module.exports = { api, prisma, user, cities, control, outbox, outboxMark, outboxSince, otpFor, sleep, uniquePhone, resetDomain, login, setBase, signAccess, meeting, part, subData, PW, PW_HASH, ART, ROOT, BACK, bk, nextIp, OCEAN };
