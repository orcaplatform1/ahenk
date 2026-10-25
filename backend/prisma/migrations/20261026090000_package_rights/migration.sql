-- Tek seferlik paketler: hak ve döngü sayaçları
ALTER TABLE "Subscription" ADD COLUMN "groupRights" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Subscription" ADD COLUMN "groupCycles" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Subscription" ADD COLUMN "oneOnOneCycles" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MeetingParticipant" ADD COLUMN "groupRightSubId" TEXT;

-- Mevcut aktif grup paketlerine (Masada / İçerde) 2 grup hakkı
UPDATE "Subscription" SET "groupRights" = 2 WHERE "status" = 'ACTIVE' AND "plan" IN ('MASADA', 'ICERDE');

-- Otomatik yenilenen abonelik (iyzico Abonelik API) kaldırıldı: tüm paketler tek seferlik
-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_recurringId_fkey";

-- DropForeignKey
ALTER TABLE "RecurringSubscription" DROP CONSTRAINT "RecurringSubscription_userId_fkey";

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_recurringId_fkey";

-- DropIndex
DROP INDEX "Payment_iyzicoOrderRef_key";

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "iyzicoOrderRef",
DROP COLUMN "recurringId";

-- AlterTable
ALTER TABLE "PlanPrice" DROP COLUMN "iyzicoDiscountPlanRef",
DROP COLUMN "iyzicoPlanRef";

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "recurringId";

-- DropTable
DROP TABLE "RecurringSubscription";

-- DropEnum
DROP TYPE "RecurringStatus";


-- iyzico abonelik ürün kodları artık kullanılmıyor
DELETE FROM "AppConfig" WHERE "key" LIKE 'IYZICO_PRODUCT_%';
