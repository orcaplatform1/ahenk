// Eşleştirme testleri ortak kurulumu
const c = require('./clock'); const h = require('./h'); const { prisma } = h;
let C, M, S, V;
async function setup(now = '2027-01-04T11:00:00') { await h.resetDomain(); C = await h.cities(); await c.boot(); c.setNow(now); M = c.svc('matching/matching.service', 'MatchingService'); S = c.svc('matching/matching.scheduler', 'MatchingScheduler'); V = c.svc('venue-panel/venue-assignment.service', 'VenueAssignmentService'); return { C, M, S, V }; }
const ist = () => C['İstanbul'];
const gu = (gender, o = {}) => h.user({ gender, city: ist(), district: 'Kadıköy', kyc: 'APPROVED', plan: 'MASADA', ...o });
const ou = (gender, o = {}) => h.user({ gender, city: ist(), district: 'Kadıköy', kyc: 'APPROVED', plan: 'KARSIMDA', ...o });
const tables = async (type = 'GROUP', status = ['PENDING', 'ACTIVE']) => prisma.meeting.findMany({ where: { type, status: { in: status } }, include: { participants: { where: { status: { notIn: ['CANCELLED', 'DECLINED', 'NO_SHOW'] } }, include: { user: { include: { profile: true } } } } } });
const seatOf = async (u, type = 'GROUP') => (await prisma.meetingParticipant.findFirst({ where: { userId: u.id, meeting: { type, status: { in: ['PENDING', 'ACTIVE'] } }, status: { notIn: ['CANCELLED', 'DECLINED', 'NO_SHOW'] } } }))?.meetingId ?? null;
const genders = (t) => { const g = t.participants.map((p) => p.user.profile.gender); return { m: g.filter((x) => x === 'MALE').length, f: g.filter((x) => x === 'FEMALE').length, n: g.length }; };
async function clean() { await prisma.meeting.deleteMany(); await prisma.matchingWaitlist.deleteMany(); await prisma.matchingCycle.deleteMany(); await prisma.notification.deleteMany(); await prisma.adminAlert.deleteMany(); await prisma.subscription.updateMany({ data: { status: 'CANCELLED' } }); await prisma.userBlock.deleteMany(); await prisma.contactBlock.deleteMany(); }
const bot = (gender, o = {}) => h.user({ bot: true, gender, phone: null, city: ist(), age: 30, ...o });
module.exports = { setup, gu, ou, tables, seatOf, genders, clean, bot, ist, get C() { return C; } };
async function venue(o = {}) { const { city = ist(), district = 'Kadıköy', capacity = 20, venueType = 'NON_ALCOHOLIC', account = 'ACTIVE', isActive = true, name = 'Mekan ' + Math.random().toString(36).slice(2, 6), phone = h.uniquePhone() } = o;
  const v = await prisma.venue.create({ data: { name, category: 'ORTA', cityId: city, district, capacity, venueType, isActive, address: 'Adres 1', locationUrl: 'https://maps.example/x', photos: [] } });
  if (account) { const app = await prisma.partnershipApplication.create({ data: { businessName: name, contactName: 'Y', email: `${v.id}@e2e.test`, phone, city: 'İstanbul', venueType: 'Kafe', capacity } }); await prisma.venueAccount.create({ data: { applicationId: app.id, venueId: v.id, email: `${v.id}@e2e.test`, phone, passwordHash: h.PW_HASH, status: account } }); }
  v.phone = phone; return v; }
Object.assign(module.exports, { venue });
