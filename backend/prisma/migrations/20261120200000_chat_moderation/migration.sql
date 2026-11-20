-- Masa sohbeti: otomatik engel, şikâyet nedeni, admin kararı; yaptırım kaynağı
CREATE TYPE "ChatReportReason" AS ENUM ('INSULT_THREAT', 'HARASSMENT_SEXUAL', 'VENUE_CHANGE', 'CONTACT_SHARE', 'DRUGS', 'FRAUD_MONEY', 'ADVERTISING', 'DISCRIMINATION', 'FAKE_PROFILE', 'OTHER');

ALTER TABLE "ChatMessage" ADD COLUMN "blockedAt" TIMESTAMP(3);

ALTER TABLE "ChatReport" ALTER COLUMN "reporterId" DROP NOT NULL;
ALTER TABLE "ChatReport" ADD COLUMN "reason" "ChatReportReason",
ADD COLUMN "note" TEXT,
ADD COLUMN "auto" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "decision" TEXT,
ADD COLUMN "decisionDays" INTEGER,
ADD COLUMN "decidedAt" TIMESTAMP(3),
ADD COLUMN "decidedById" TEXT;

ALTER TABLE "UserSanction" ADD COLUMN "source" TEXT;
