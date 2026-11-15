-- Hesap silme talebi reddi kaldırıldı: durumlar yalnız PENDING / APPROVED (veritabanında REJECTED kayıt yoktu)
-- Kısmi tekil indeks (kişi başına tek bekleyen talep) eski türe bağlı olduğu için önce kaldırılıp sonra aynen yeniden kurulur
BEGIN;
DROP INDEX "AccountDeletionRequest_one_pending";
ALTER TYPE "DeletionRequestStatus" RENAME TO "DeletionRequestStatus_old";
CREATE TYPE "DeletionRequestStatus" AS ENUM ('PENDING', 'APPROVED');
ALTER TABLE "AccountDeletionRequest" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "AccountDeletionRequest" ALTER COLUMN "status" TYPE "DeletionRequestStatus" USING ("status"::text::"DeletionRequestStatus");
ALTER TABLE "AccountDeletionRequest" ALTER COLUMN "status" SET DEFAULT 'PENDING';
DROP TYPE "DeletionRequestStatus_old";
CREATE UNIQUE INDEX "AccountDeletionRequest_one_pending" ON "AccountDeletionRequest"("userId") WHERE "status" = 'PENDING';
COMMIT;
