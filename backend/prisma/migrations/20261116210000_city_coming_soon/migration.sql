-- Şehir durumu: Aktif / Pasif / Yakında
ALTER TABLE "City" ADD COLUMN "isComingSoon" BOOLEAN NOT NULL DEFAULT false;

-- Mevcut Türkiye dışı pasif bölgeler (Dubai Marina, JLT, Downtown Dubai) Yakında
UPDATE "City" SET "isComingSoon" = true WHERE "isActive" = false AND "countryCode" <> 'TR';
