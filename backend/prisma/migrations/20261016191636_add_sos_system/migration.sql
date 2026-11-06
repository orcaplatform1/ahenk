-- CreateTable
CREATE TABLE "SosReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "threats" TEXT[],
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "participantSnapshot" JSONB NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SosReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SosLocationUpdate" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SosLocationUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SosReport_meetingId_idx" ON "SosReport"("meetingId");

-- CreateIndex
CREATE INDEX "SosReport_userId_idx" ON "SosReport"("userId");

-- CreateIndex
CREATE INDEX "SosReport_createdAt_idx" ON "SosReport"("createdAt");

-- CreateIndex
CREATE INDEX "SosLocationUpdate_reportId_timestamp_idx" ON "SosLocationUpdate"("reportId", "timestamp");

-- AddForeignKey
ALTER TABLE "SosReport" ADD CONSTRAINT "SosReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SosReport" ADD CONSTRAINT "SosReport_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SosLocationUpdate" ADD CONSTRAINT "SosLocationUpdate_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "SosReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
