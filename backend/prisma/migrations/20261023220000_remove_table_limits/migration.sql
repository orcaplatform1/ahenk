-- Masa sınırları kaldırıldı (şehir bazında + genel haftalık)
ALTER TABLE "City" DROP COLUMN "weeklyTableLimit";

DELETE FROM "AppConfig" WHERE "key" = 'WEEKLY_TABLE_LIMIT';
