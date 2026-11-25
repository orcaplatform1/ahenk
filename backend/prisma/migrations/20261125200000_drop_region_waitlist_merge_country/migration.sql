-- "Haber ver" bekleme listesi kaldırıldı (tablo ve kayıtları)
DROP TABLE "RegionWaitlist";

-- Ülke alanları birleşti: isteğe bağlı "country" kaldırıldı, zorunlu "countryCode" (varsayılan TR) kullanılır
ALTER TABLE "City" DROP COLUMN "country";

UPDATE "City" SET "countryCode" = 'AE' WHERE "name" = 'Dubai';
UPDATE "City" SET "countryCode" = 'TH' WHERE "name" = 'Bangkok';
UPDATE "City" SET "countryCode" = 'HK' WHERE "name" = 'Hong Kong';
UPDATE "City" SET "countryCode" = 'SG' WHERE "name" = 'Singapur';
UPDATE "City" SET "countryCode" = 'JP' WHERE "name" = 'Tokyo';
UPDATE "City" SET "countryCode" = 'TR' WHERE "name" NOT IN ('Dubai', 'Bangkok', 'Hong Kong', 'Singapur', 'Tokyo');
