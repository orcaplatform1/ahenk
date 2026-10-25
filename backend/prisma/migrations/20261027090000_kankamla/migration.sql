-- Kankamla: KANKA masa türü, KANKAMLA paketi, kanka daveti ve kankalık
-- CreateEnum
CREATE TYPE "KankaInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "AdminAlertType" ADD VALUE 'MISSED_KANKA_CYCLES';

-- AlterEnum
ALTER TYPE "MeetingType" ADD VALUE 'KANKA';

-- AlterEnum
ALTER TYPE "RefundType" ADD VALUE 'KANKA';

-- AlterEnum
ALTER TYPE "SubscriptionPlan" ADD VALUE 'KANKAMLA';

-- AlterTable
ALTER TABLE "MeetingParticipant" ADD COLUMN     "kankaPartnerId" TEXT,
ADD COLUMN     "kankaRightSubId" TEXT;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "kankaCycles" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "kankaRights" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "missedKankaCycles" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "KankaInvite" (
    "id" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "invitedPhone" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "KankaInviteStatus" NOT NULL DEFAULT 'PENDING',
    "acceptedById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KankaInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KankaLink" (
    "id" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endReason" TEXT,

    CONSTRAINT "KankaLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KankaInvite_token_key" ON "KankaInvite"("token");

-- CreateIndex
CREATE INDEX "KankaInvite_invitedPhone_status_idx" ON "KankaInvite"("invitedPhone", "status");

-- CreateIndex
CREATE INDEX "KankaInvite_inviterId_status_idx" ON "KankaInvite"("inviterId", "status");

-- CreateIndex
CREATE INDEX "KankaLink_userAId_endedAt_idx" ON "KankaLink"("userAId", "endedAt");

-- CreateIndex
CREATE INDEX "KankaLink_userBId_endedAt_idx" ON "KankaLink"("userBId", "endedAt");

-- AddForeignKey
ALTER TABLE "KankaInvite" ADD CONSTRAINT "KankaInvite_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KankaLink" ADD CONSTRAINT "KankaLink_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KankaLink" ADD CONSTRAINT "KankaLink_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
