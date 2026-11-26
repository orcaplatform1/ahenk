-- Canlı destek: kötüye kullanım kısıtlama sebebi + temsilci mola kayıtları
ALTER TABLE "SupportRestriction" ADD COLUMN "reason" TEXT;

CREATE TABLE "SupportBreak" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "SupportBreak_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportBreak_agentId_startedAt_idx" ON "SupportBreak"("agentId", "startedAt");
CREATE INDEX "SupportBreak_startedAt_idx" ON "SupportBreak"("startedAt");
