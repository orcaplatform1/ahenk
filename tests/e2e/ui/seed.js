// UI testi verisi: gerçek saatli test API'si için. Tüm kimlikler artifacts/ui-seed.json'a yazılır.
const fs = require('fs'); const h = require('../lib/h'); const { prisma } = h;
module.exports = async () => {
  await h.resetDomain(); h.control({}); const C = await h.cities(); const ist = C['İstanbul'];
  const mk = (o) => h.user({ city: ist, district: 'Kadıköy', firstName: 'Deniz', lastName: 'Yıldız', ...o });
  const sup = await mk({ role: 'SUPERADMIN', email: 'sup@e2e.test' }), adm = await mk({ role: 'ADMIN', email: 'adm@e2e.test' });
  const fresh = await mk({ ocean: false, email: 'fresh@e2e.test' });
  const noPkg = await mk({ kyc: 'APPROVED', email: 'nopkg@e2e.test' }), kycWait = await mk({ plan: 'MASADA', kyc: 'PENDING', email: 'kyc@e2e.test' });
  const scan = await mk({ kyc: 'APPROVED', plan: 'ICERDE', email: 'scan@e2e.test' });
  const kankaWait = await mk({ kyc: 'APPROVED', plan: 'KANKAMLA', email: 'kw@e2e.test' });
  await prisma.subscription.updateMany({ where: { userId: scan.id }, data: { createdAt: new Date('2026-10-25T10:00:00Z') } }); await prisma.kycSubmission.updateMany({ where: { userId: scan.id }, data: { reviewedAt: new Date('2026-10-25T10:00:00Z') } });
  const u = await mk({ kyc: 'APPROVED', plan: 'ICERDE', gender: 'FEMALE', email: 'table@e2e.test' });
  const others = []; for (let i = 0; i < 3; i++) others.push(await mk({ kyc: 'APPROVED', plan: 'MASADA', firstName: ['Mert', 'Ayşe', 'Can'][i], lastName: 'Aksu', gender: i % 2 ? 'FEMALE' : 'MALE' }));
  const soon = new Date(Date.now() + 4 * 36e5);
  const app = await prisma.partnershipApplication.create({ data: { businessName: 'Petra Kahve', contactName: 'Ece', email: 'venue@e2e.test', phone: h.uniquePhone(), city: 'İstanbul', venueType: 'Kafe', capacity: 30, status: 'APPROVED' } });
  const venue = await prisma.venue.create({ data: { name: 'Petra Kahve', category: 'ORTA', cityId: ist, district: 'Kadıköy', address: 'Bağdat Cad. No:12', capacity: 30, locationUrl: 'https://maps.google.com/?q=1', photos: [] } });
  await prisma.venueAccount.create({ data: { applicationId: app.id, venueId: venue.id, email: 'venue@e2e.test', phone: app.phone, passwordHash: h.PW_HASH, status: 'ACTIVE' } });
  const live = await h.meeting({ city: ist, scheduledAt: soon, status: 'ACTIVE', users: [u, ...others], venueId: venue.id, locationText: venue.name, venueAddress: venue.address, locationUrl: venue.locationUrl });
  const past = await h.meeting({ city: ist, scheduledAt: new Date(Date.now() - 2 * 864e5), status: 'COMPLETED', users: [u, others[0]], locationText: 'Eski Mekan', venueAddress: 'Adres' });
  await prisma.meetingParticipant.updateMany({ where: { meetingId: past.id }, data: { status: 'ATTENDED', matchScore: 80 } });
  const sos = await prisma.sosReport.create({ data: { userId: u.id, meetingId: live.id, threats: ['HARASSMENT'], lat: 41, lng: 29, participantSnapshot: [] } });
  await prisma.adminAlert.create({ data: { userId: u.id, alertType: 'SOS_ALERT' } });
  const inv = await prisma.kankaInvite.create({ data: { inviterId: noPkg.id, invitedPhone: h.uniquePhone(), token: 'e2etoken123', expiresAt: new Date(Date.now() + 864e5) } });
  fs.writeFileSync(h.ART + '/ui-seed.json', JSON.stringify({ sup: sup.email, adm: adm.email, fresh: fresh.email, noPkg: noPkg.email, kycWait: kycWait.email, scan: scan.email, kankaWait: kankaWait.email, table: u.email, live: live.id, past: past.id, sos: sos.id, kankaToken: inv.token, PW: h.PW }));
  await prisma.$disconnect();
};
