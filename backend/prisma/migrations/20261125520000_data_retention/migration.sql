-- Veri saklama: ödeme anonimleştirme işareti, saklama kilidi, otomatik silme çalışmaları, dışa aktarma kayıtları
ALTER TABLE "Payment" ADD COLUMN "anonymizedAt" TIMESTAMP(3);

CREATE TABLE "RetentionLock" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "category" TEXT,
    "recordId" TEXT,
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    "releasedById" TEXT,
    "releaseReason" TEXT,
    CONSTRAINT "RetentionLock_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RetentionLock_userId_idx" ON "RetentionLock"("userId");
CREATE INDEX "RetentionLock_category_recordId_idx" ON "RetentionLock"("category", "recordId");

CREATE TABLE "RetentionRun" (
    "id" TEXT NOT NULL,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    CONSTRAINT "RetentionRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RetentionRun_ranAt_idx" ON "RetentionRun"("ranAt");

CREATE TABLE "DataExportLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DataExportLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DataExportLog_createdAt_idx" ON "DataExportLog"("createdAt");
