-- Gelmedi bildirimi admin paneline düşer
ALTER TYPE "AdminAlertType" ADD VALUE 'NO_SHOW_REPORTED';

-- Acil durum kişisi
ALTER TABLE "User" ADD COLUMN "emergencyContactName" TEXT,
ADD COLUMN "emergencyContactPhone" TEXT;

ALTER TABLE "SosReport" ADD COLUMN "emergencyNotifiedAt" TIMESTAMP(3),
ADD COLUMN "emergencyNotifyFailed" BOOLEAN NOT NULL DEFAULT false;

-- Askı tek model: askı User.status'u değiştirmez. Eski modelde SUSPENDED olan üye hesapları ACTIVE'e döner (botlarda SUSPENDED = pasif, dokunulmaz)
UPDATE "User" SET "status" = 'ACTIVE' WHERE "status" = 'SUSPENDED' AND "isBot" = false;
