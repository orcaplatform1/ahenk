-- AlterEnum
ALTER TYPE "AdminAlertType" ADD VALUE 'BOT_ASSIGNED';

-- AlterTable
ALTER TABLE "AdminAlert" ADD COLUMN "message" TEXT;
