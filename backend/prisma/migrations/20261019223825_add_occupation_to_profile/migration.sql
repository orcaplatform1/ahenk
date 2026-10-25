-- AlterEnum
ALTER TYPE "AdminAlertType" ADD VALUE 'SOS_ALERT';

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "occupation" TEXT;
