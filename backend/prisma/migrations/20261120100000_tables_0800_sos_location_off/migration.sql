-- Yola Çıktım kaldırıldı
ALTER TABLE "MeetingParticipant" DROP COLUMN "onMyWayAt";

-- Seçim iptalinden sonra 24 saat yeni seçim yapılamaz
ALTER TABLE "User" ADD COLUMN "selectionCancelledAt" TIMESTAMP(3);

-- Acil yardım: açık talepte konum kesintisi bildirimi (kesinti başına bir kez)
ALTER TABLE "SosReport" ADD COLUMN "locationOffNotifiedAt" TIMESTAMP(3);
