-- Şehir sezonu (gün + ay) ve ülke kodu (ISO 3166-1 alpha-2), isteğe bağlı
ALTER TABLE "City" ADD COLUMN "seasonStartDay" INTEGER,
ADD COLUMN "seasonStartMonth" INTEGER,
ADD COLUMN "seasonEndDay" INTEGER,
ADD COLUMN "seasonEndMonth" INTEGER,
ADD COLUMN "country" TEXT;

-- Sahil şehirleri: sezon 15 Mayıs - 15 Eylül, ülke TR
UPDATE "City" SET "seasonStartDay" = 15, "seasonStartMonth" = 5, "seasonEndDay" = 15, "seasonEndMonth" = 9, "country" = 'TR'
WHERE "name" IN ('Çeşme', 'Bodrum', 'Fethiye', 'Marmaris', 'Kuşadası', 'Ayvalık');

-- Yurt dışı şehirler
UPDATE "City" SET "country" = 'AE' WHERE "name" IN ('Abu Dhabi', 'Dubai');
UPDATE "City" SET "country" = 'TH' WHERE "name" IN ('Bangkok', 'Pattaya');
UPDATE "City" SET "country" = 'HK' WHERE "name" = 'Hong Kong';
UPDATE "City" SET "country" = 'SG' WHERE "name" = 'Singapur';
UPDATE "City" SET "country" = 'JP' WHERE "name" = 'Tokyo';
