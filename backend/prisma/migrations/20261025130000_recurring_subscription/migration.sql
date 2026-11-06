-- Otomatik yenilenen abonelik (iyzico Abonelik API)
-- CreateEnum
CREATE TYPE "RecurringStatus" AS ENUM ('PENDING', 'ACTIVE', 'CANCELLED', 'UNPAID');

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "recurringId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "iyzicoOrderRef" TEXT,
ADD COLUMN     "recurringId" TEXT;

-- CreateTable
CREATE TABLE "RecurringSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "status" "RecurringStatus" NOT NULL DEFAULT 'PENDING',
    "discounted" BOOLEAN NOT NULL DEFAULT false,
    "checkoutToken" TEXT,
    "iyzicoSubscriptionRef" TEXT,
    "iyzicoCustomerRef" TEXT,
    "iyzicoPricingPlanRef" TEXT,
    "initialDiscountType" "PaymentDiscountType",
    "platform" "PaymentPlatform" NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecurringSubscription_checkoutToken_key" ON "RecurringSubscription"("checkoutToken");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringSubscription_iyzicoSubscriptionRef_key" ON "RecurringSubscription"("iyzicoSubscriptionRef");

-- CreateIndex
CREATE INDEX "RecurringSubscription_userId_status_idx" ON "RecurringSubscription"("userId", "status");

-- CreateIndex
CREATE INDEX "RecurringSubscription_iyzicoCustomerRef_idx" ON "RecurringSubscription"("iyzicoCustomerRef");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_iyzicoOrderRef_key" ON "Payment"("iyzicoOrderRef");

-- AddForeignKey
ALTER TABLE "RecurringSubscription" ADD CONSTRAINT "RecurringSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_recurringId_fkey" FOREIGN KEY ("recurringId") REFERENCES "RecurringSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recurringId_fkey" FOREIGN KEY ("recurringId") REFERENCES "RecurringSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

