-- CreateTable
CREATE TABLE "NoShowReport" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoShowReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NoShowReport_reportedId_idx" ON "NoShowReport"("reportedId");

-- CreateIndex
CREATE INDEX "NoShowReport_meetingId_idx" ON "NoShowReport"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "NoShowReport_meetingId_reporterId_reportedId_key" ON "NoShowReport"("meetingId", "reporterId", "reportedId");

-- AddForeignKey
ALTER TABLE "NoShowReport" ADD CONSTRAINT "NoShowReport_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoShowReport" ADD CONSTRAINT "NoShowReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoShowReport" ADD CONSTRAINT "NoShowReport_reportedId_fkey" FOREIGN KEY ("reportedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

