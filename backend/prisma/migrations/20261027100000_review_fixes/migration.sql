-- DropForeignKey
ALTER TABLE "RefundRequest" DROP CONSTRAINT "RefundRequest_subscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "SosReport" DROP CONSTRAINT "SosReport_meetingId_fkey";

-- DropForeignKey
ALTER TABLE "SosReport" DROP CONSTRAINT "SosReport_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserSanction" DROP CONSTRAINT "UserSanction_adminId_fkey";

-- AlterTable
ALTER TABLE "SosReport" ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "meetingId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "UserSanction" ALTER COLUMN "adminId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "ContactBlock_hashedPhone_idx" ON "ContactBlock"("hashedPhone");

-- CreateIndex
CREATE INDEX "Referral_referredId_idx" ON "Referral"("referredId");

-- CreateIndex
CREATE INDEX "User_phoneHash_idx" ON "User"("phoneHash");

-- AddForeignKey
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSanction" ADD CONSTRAINT "UserSanction_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SosReport" ADD CONSTRAINT "SosReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SosReport" ADD CONSTRAINT "SosReport_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

