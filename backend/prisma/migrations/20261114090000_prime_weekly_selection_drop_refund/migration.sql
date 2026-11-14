-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SubscriptionPlan" ADD VALUE 'PRIME_1M';
ALTER TYPE "SubscriptionPlan" ADD VALUE 'PRIME_3M';
ALTER TYPE "SubscriptionPlan" ADD VALUE 'PRIME_6M';
ALTER TYPE "SubscriptionPlan" ADD VALUE 'PRIME_12M';

-- DropForeignKey
ALTER TABLE "RefundRequest" DROP CONSTRAINT "RefundRequest_subscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "RefundRequest" DROP CONSTRAINT "RefundRequest_userId_fkey";

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "isRenewal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "storeTransactionId" TEXT;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "autoRenew" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "iyzicoSubscriptionRef" TEXT,
ADD COLUMN     "renewCancelledAt" TIMESTAMP(3),
ADD COLUMN     "rightsResetAt" TIMESTAMP(3),
ADD COLUMN     "storeOriginalTransactionId" TEXT,
ADD COLUMN     "storePlatform" "PaymentPlatform";

-- DropTable
DROP TABLE "RefundRequest";

-- DropEnum
DROP TYPE "RefundStatus";

-- DropEnum
DROP TYPE "RefundType";

-- CreateTable
CREATE TABLE "WeeklySelection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "type" "MeetingType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklySelection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklySelection_year_weekNumber_type_idx" ON "WeeklySelection"("year", "weekNumber", "type");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklySelection_userId_year_weekNumber_type_key" ON "WeeklySelection"("userId", "year", "weekNumber", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_storeTransactionId_key" ON "Payment"("storeTransactionId");

-- AddForeignKey
ALTER TABLE "WeeklySelection" ADD CONSTRAINT "WeeklySelection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

