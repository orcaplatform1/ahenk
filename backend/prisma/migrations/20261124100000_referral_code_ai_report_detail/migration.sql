-- AlterTable
ALTER TABLE "MeetingAiReport" ADD COLUMN     "detail" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "referralCode" TEXT;

-- CreateTable
CREATE TABLE "ShareTeaser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareTeaser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeaserCursor" (
    "userId" TEXT NOT NULL,
    "type" "MeetingType" NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TeaserCursor_pkey" PRIMARY KEY ("userId","type")
);

-- CreateTable
CREATE TABLE "ReferralReward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "SubscriptionPlan",
    "subscriptionId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralReward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShareTeaser_userId_meetingId_key" ON "ShareTeaser"("userId", "meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralReward_subscriptionId_key" ON "ReferralReward"("subscriptionId");

-- CreateIndex
CREATE INDEX "ReferralReward_userId_idx" ON "ReferralReward"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- AddForeignKey
ALTER TABLE "ShareTeaser" ADD CONSTRAINT "ShareTeaser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareTeaser" ADD CONSTRAINT "ShareTeaser_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeaserCursor" ADD CONSTRAINT "TeaserCursor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Mevcut kullanıcılara kalıcı kişisel davet kodu (8 karakter, benzersiz)
DO $$
DECLARE r RECORD; c TEXT;
BEGIN
  FOR r IN SELECT id FROM "User" WHERE "referralCode" IS NULL LOOP
    LOOP
      c := upper(substr(md5(r.id || random()::text || clock_timestamp()::text), 1, 8));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM "User" WHERE "referralCode" = c);
    END LOOP;
    UPDATE "User" SET "referralCode" = c WHERE id = r.id;
  END LOOP;
END $$;
