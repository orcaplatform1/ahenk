-- Mekân ilçesi, mekâna masa bildirimi takibi, mekânsız masa uyarısı
ALTER TABLE "Venue" ADD COLUMN "district" TEXT;
ALTER TABLE "PartnershipApplication" ADD COLUMN "district" TEXT;
ALTER TABLE "Meeting"
  ADD COLUMN "venueNotifiedId" TEXT,
  ADD COLUMN "venueMissingAlertAt" TIMESTAMP(3);
