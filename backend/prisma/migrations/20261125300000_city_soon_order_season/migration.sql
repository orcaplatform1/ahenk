-- Yakında şehirlerin grup içi sırası (Sezon Masaları 🇹🇷 / 🌐) ve sahil şehirleri sezonu 1 Haziran - 15 Eylül
UPDATE "City" SET "sortOrder" = 10 WHERE "name" = 'Çeşme';
UPDATE "City" SET "sortOrder" = 11 WHERE "name" = 'Bodrum';
UPDATE "City" SET "sortOrder" = 12 WHERE "name" = 'Fethiye';
UPDATE "City" SET "sortOrder" = 13 WHERE "name" = 'Marmaris';
UPDATE "City" SET "sortOrder" = 14 WHERE "name" = 'Kuşadası';
UPDATE "City" SET "sortOrder" = 15 WHERE "name" = 'Ayvalık';
UPDATE "City" SET "sortOrder" = 20 WHERE "name" = 'Dubai';
UPDATE "City" SET "sortOrder" = 21 WHERE "name" = 'Hong Kong';
UPDATE "City" SET "sortOrder" = 22 WHERE "name" = 'Singapur';
UPDATE "City" SET "sortOrder" = 23 WHERE "name" = 'Bangkok';
UPDATE "City" SET "sortOrder" = 24 WHERE "name" = 'Tokyo';

UPDATE "City" SET "seasonStartDay" = 1, "seasonStartMonth" = 6, "seasonEndDay" = 15, "seasonEndMonth" = 9
WHERE "name" IN ('Çeşme', 'Bodrum', 'Fethiye', 'Marmaris', 'Kuşadası', 'Ayvalık');
